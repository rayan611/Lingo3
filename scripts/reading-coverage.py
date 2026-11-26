#!/usr/bin/env python3
"""Checks the reading library against the vocabulary.

  python3 scripts/reading-coverage.py            report: per story and per level
  python3 scripts/reading-coverage.py --unused B1 60   list 60 words of level B1 no story uses yet

A story passes when it has 150+ words, at most 12 % of them outside the vocabulary
(names and numbers aside) and no more than LIMIT_ABOVE come from a level above
its own. The bank's A1 is a workplace list (everyday nouns such as katt or kaffe
sit at A2/B1), so A1 and A2 stories need a wider margin than the rest.
"""
import json, re, sys, glob
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
ORDER = ['A1', 'A2', 'B1', 'B2', 'C1']
LIMIT_ABOVE = {'A1': 0.35, 'A2': 0.30, 'B1': 0.25, 'B2': 0.20, 'C1': 0.15}
vocab = json.loads((ROOT / 'public/reading/vocab.json').read_text())
ART = re.compile(r'^(en|ett|att|har|är|den|det|de)\s+', re.I)

def variants(e):
    out = set()
    for raw in [e['sv']] + e.get('f', []):
        raw = re.sub(r'\(.*?\)', '', raw)
        for part in re.split(r'[/,]', raw):
            part = ART.sub('', part.strip().lower().rstrip('!'))
            part = ART.sub('', part)
            if part: out.add(part)
            if ' ' in part: out.add(part.split(' ')[0])
    return out
index = {}
for e in vocab:
    for v in variants(e): index.setdefault(v, []).append(e)

def lookup(tok):
    for t in (tok, tok[:-1] if tok.endswith('s') else None):
        if t and t in index: return index[t]
    return None

def tokens(sentences):
    for s in sentences:
        first = True
        for m in re.finditer(r"[A-Za-zÅÄÖåäöéÉ]+(?:-[A-Za-zÅÄÖåäöé]+)*", s):
            w = m.group(0)
            if w[0].isupper() and not (first and m.start() == 0 or re.search(r'[.!?]\s+$', s[:m.start()])): yield w, True
            else: yield w.lower(), False
            first = False

stories = []
for f in sorted(glob.glob(str(ROOT / 'public/reading/stories/*.json'))): stories += json.loads(Path(f).read_text())

if len(sys.argv) > 1 and sys.argv[1] == '--unused':
    lv, n = sys.argv[2], int(sys.argv[3])
    used = set()
    for s in stories:
        for w, name in tokens(p['sv'] for p in s['p']):
            for e in lookup(w) or []: used.add(e['id'])
    left = [e for e in vocab if e['l'] == lv and e['id'] not in used]
    step = max(1, len(left) // n)
    print(f'{lv}: {len(left)} unused of {sum(e["l"] == lv for e in vocab)}')
    for e in left[::step][:n]: print(f"{e['sv']} = {e['en']}")
    sys.exit()

used_by_level = {l: set() for l in ORDER}
bad = 0
for s in stories:
    lvl = ORDER.index(s['level']); tot = unk = above = 0; unknown = []
    sv = [p['sv'] for p in s['p']]
    names = {w.lower() for w, n in tokens(sv) if n}
    for w, name in tokens(sv):
        if name or w in names or w.isdigit(): continue
        tot += 1
        hits = lookup(w)
        if not hits: unk += 1; unknown.append(w); continue
        e = min(hits, key=lambda h: ORDER.index(h['l']) if h['l'] in ORDER else 9)
        used_by_level.get(e['l'], set()).add(e['id'])
        if e['l'] in ORDER and ORDER.index(e['l']) > min(lvl, 3): above += 1
    ok = tot >= 150 and unk / tot <= 0.12 and above / tot <= LIMIT_ABOVE[s['level']]
    bad += not ok
    print(f"{'OK ' if ok else 'FIX'} {s['id']:8} {s['level']} words={tot:3} unknown={unk:2} above={above:2}  {' '.join(sorted(set(unknown))[:14])}")
print()
for l in ORDER[:4]:
    n = sum(e['l'] == l for e in vocab)
    print(f'{l}: {len(used_by_level[l])}/{n} words used ({100 * len(used_by_level[l]) // n}%)')
print(len(stories), 'stories;', bad, 'need a fix')
