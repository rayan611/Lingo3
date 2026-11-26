#!/usr/bin/env python3
"""Builds public/reading/vocab.json from the 8000-word vocabulary workbook.

Usage: python3 scripts/build-reading-vocab.py Vocabulary_Bank_EN_SV_DE_8000_v2.xlsx [SE-EN-DE.xlsx]

The optional second workbook is the owner's own list; words it holds that the
bank lacks are added with level 'X' (own list).

One entry per word: id (overall rank), sv (headword as written), en, de,
l (CEFR level), t (type), f (Swedish forms), x ([sv, en, de] example).
"""
import json, re, sys
from pathlib import Path
import openpyxl

SRC = sys.argv[1]
OUT = Path(__file__).resolve().parent.parent / 'public/reading/vocab.json'
TYPES = {'Nouns': 'noun', 'Verbs': 'verb', 'Adjectives': 'adj', 'Adverbs': 'adv', 'Prepositions': 'prep',
         'Pronouns & Determiners': 'pron', 'Function Words': 'func', 'Numbers': 'num'}
FORM_COLS = {
    'Nouns': ['SV Singular (indef.)', 'SV Singular (def.)', 'SV Plural (indef.)', 'SV Plural (def.)'],
    'Verbs': ['SV Infinitive', 'SV Present', 'SV Past', 'SV Perfect (har + supine)', 'SV Participle', 'SV Passive (s-form)'],
    'Adjectives': ['SV en-form', 'SV ett-form', 'SV Plural/Definite', 'SV Comparative', 'SV Superlative'],
}
def clean(v):
    if v is None: return ''
    v = str(v).strip()
    return '' if v in ('–', '-', '—') else v

wb = openpyxl.load_workbook(SRC, read_only=True)
rows = {}
for sheet in TYPES:
    it = wb[sheet].iter_rows(values_only=True)
    head = next(it)
    ix = {h: i for i, h in enumerate(head)}
    for r in it:
        if r[0] is None: continue
        g = lambda c: clean(r[ix[c]]) if c in ix else ''
        forms = [g(c) for c in FORM_COLS.get(sheet, [])]
        e = {'id': int(r[ix['Overall Rank']]), 'sv': g('Swedish'), 'en': g('English'), 'de': g('German'),
             'l': g('Level (approx.)'), 't': TYPES[sheet]}
        if any(forms): e['f'] = [f for f in forms if f]
        x = [g('Example SV'), g('Example EN'), g('Example DE')]
        if x[0]: e['x'] = x
        if e['sv']: rows[e['id']] = e
out = [rows[k] for k in sorted(rows)]

if len(sys.argv) > 2:  # the owner's own workbook: add what the bank lacks
    have = {w.strip().lower() for e in out for w in re.split(r'[/,]', re.sub(r'^(en|ett)\s+', '', e['sv']))}
    own = openpyxl.load_workbook(sys.argv[2], read_only=True)
    def cells(row, n): return [clean(c) if not str(c or '').startswith('=') else '' for c in (list(row) + [None] * n)[:n]]
    extra, nid = [], 100000
    def add(sv, en, de, t, forms=()):
        global nid
        sv = sv.strip().rstrip('!').strip()
        if not sv or not en or sv.lower() in have or len(sv) > 40: return
        have.add(sv.lower()); nid += 1
        e = {'id': nid, 'sv': sv, 'en': en.strip(), 'de': de.strip(), 'l': 'X', 't': t}
        f = [x.strip().rstrip('!').strip() for x in forms if x and x.strip() not in ('', '-', '--')]
        if f: e['f'] = f
        extra.append(e)
    for r in list(own['Verbs'].iter_rows(values_only=True))[3:]:
        c = cells(r, 11); add(c[10], c[2], '', 'verb', [c[10], c[6], c[7], c[8]])
    for r in list(own['Noun'].iter_rows(values_only=True))[3:]:
        c = cells(r, 5)
        if c[0] and c[1] and c[0][0].isupper(): add(c[1], c[0], '', 'noun', [c[1], c[2]])
    for r in list(own['Adj&Adv'].iter_rows(values_only=True))[3:]:
        c = cells(r, 8)
        if c[0] and c[1] and c[2] != 'None': add(c[1], c[0], c[4], 'adj', [c[1], c[2], c[3]])
    out += extra
    print(len(extra), 'extra words from the own list')
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
from collections import Counter
print(len(out), 'words', OUT.stat().st_size // 1024, 'KB', Counter(e['l'] for e in out))
