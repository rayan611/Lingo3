#!/usr/bin/env python3
"""Build an auditable vocabulary source from the supplied Lexin ZIP and core pack.

Lexin contains Swedish-only dictionary data. It is kept separate from ready
multilingual concepts so a Swedish headword is never mistaken for a full card.
"""

import argparse
import collections
import gzip
import hashlib
import json
import re
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


POS = {
    "subst.": "noun", "substantiv": "noun", "verb": "verb",
    "adj.": "adjective", "adj": "adjective", "adv.": "adverb",
    "prep.": "preposition", "pron.": "pronoun", "konj.": "conjunction",
    "interj.": "interjection", "räkn.": "numeral", "namn": "proper_noun",
    "förk.": "abbreviation", "förled": "prefix", "efterled": "suffix",
}


def clean(s):
    return unicodedata.normalize("NFC", " ".join((s or "").split()))


def word_key(lemma, pos):
    return clean(lemma).casefold() + "\x1f" + pos


def stable_id(prefix, key):
    return prefix + "." + hashlib.sha256(key.encode("utf-8")).hexdigest()[:20]


def parse_lexin(path):
    words = {}
    skipped = collections.Counter()
    with zipfile.ZipFile(path) as archive, archive.open("LEXIN.xml") as source:
        for _, element in ET.iterparse(source, events=("end",)):
            if element.tag != "lemma-entry":
                continue
            raw_form = clean(element.findtext("form"))
            lemma = re.sub(r"\s+[1-9]$", "", raw_form)
            raw_pos = clean(element.findtext("pos"))
            pos = POS.get(raw_pos)
            if not lemma or not pos:
                skipped[raw_pos or "empty"] += 1
                element.clear()
                continue
            key = word_key(lemma, pos)
            if key not in words:
                words[key] = {
                    "id": stable_id("lexin", key), "lemma": lemma,
                    "pos": pos, "source": "lexin-2",
                    "raw_forms": [], "pronunciation": [], "inflection_raw": [],
                    "senses": [],
                }
            word = words[key]
            for field, value in (("raw_forms", raw_form),
                                 ("pronunciation", clean(element.findtext("pronunciation"))),
                                 ("inflection_raw", clean(element.findtext("inflection")))):
                if value and value not in word[field]:
                    word[field].append(value)
            for lex in element.findall("lexeme"):
                sense = {
                    "number": clean(lex.findtext("lexnr")),
                    "definition_sv": clean(lex.findtext("definition")),
                    "usage_sv": clean(lex.findtext("usage")),
                    "comment_sv": clean(lex.findtext("comment")),
                    "valency_sv": clean(lex.findtext("valency")),
                    "examples_sv": [clean(x.text) for x in lex.findall("example") if clean(x.text)],
                    "idioms_sv": [clean(x.text) for x in lex.findall("idiom") if clean(x.text)],
                    "compounds_sv": [clean(x.text) for x in lex.findall("compound") if clean(x.text)],
                }
                sense["id"] = stable_id("lexin-sense", key + "\x1f" + str(len(word["senses"])) + "\x1f" + sense["definition_sv"])
                word["senses"].append(sense)
            element.clear()
    return list(words.values()), skipped


def parse_core(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    assert data["format"] == "lingo3-vocab/1"
    assert data["n"] == len(data["concepts"])
    concepts = []
    ids = set()
    for item in data["concepts"]:
        assert item["id"] not in ids
        ids.add(item["id"])
        assert set(item["e"]) == set(data["langs"])
        assert item["p"] in {"noun", "verb", "adjective", "adverb"}
        for lang, entry in item["e"].items():
            assert clean(entry.get("h")) and clean(entry.get("x")), (item["id"], lang)
            if "f" in entry:
                assert entry["f"]["kind"] == item["p"], (item["id"], lang)
        concepts.append(item)
    return concepts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("lexin_zip", type=Path)
    parser.add_argument("core_json", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    words, skipped = parse_lexin(args.lexin_zip)
    core = parse_core(args.core_json)
    index = {word_key(w["lemma"], w["pos"]): w for w in words}
    linked = 0
    for concept in core:
        key = word_key(concept["e"]["sv"]["h"], concept["p"])
        if key in index:
            # A spelling/POS match is only a candidate: homographs may have
            # different senses, so importing must not silently merge them.
            concept["lexin_candidate_word_id"] = index[key]["id"]
            linked += 1
    result = {
        "format": "lingo3-shared-vocab/1",
        "attribution": {
            "source": "Svenska ord/LEXIN, 2nd edition, Språkbanken Text",
            "url": "https://www.sprakbanken.se/resurser/lexin",
            "license": "CC BY 4.0 (current official catalogue metadata)",
            "note": "The ZIP also contains a provisional 2002 license; verify licensing before public release.",
        },
        "lexin_words": words,
        "ready_multilingual_concepts": core,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(args.output, "wt", encoding="utf-8", compresslevel=9) as out:
        json.dump(result, out, ensure_ascii=False, separators=(",", ":"))
    print(json.dumps({
        "lexin_words": len(words), "lexin_senses": sum(len(w["senses"]) for w in words),
        "core_concepts": len(core), "core_linked_to_lexin": linked,
        "lexin_without_core": len(words) - linked,
        "lexin_with_examples": sum(bool(s["examples_sv"]) for w in words for s in w["senses"]),
        "skipped_entries": sum(skipped.values()),
        "skipped_pos_types": len(skipped),
        "output_bytes": args.output.stat().st_size,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
