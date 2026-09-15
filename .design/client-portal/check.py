#!/usr/bin/env python3
"""Mechanical check over the client-portal canvas.

Written after the same off-palette colour was typed twice by hand. The house
design system says its own test "enforces mechanically most of what follows,
and it is not optional"; this is that idea for this canvas.

Run:  python3 .design/client-portal/check.py
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)

# Counter's nineteen. Direction pages are judged against their own sets.
COUNTER = {'#FFFFFF','#F4F1EA','#FAF8F4','#F7F5F0','#EDE8DF','#1A1714','#6B635A','#9A9187',
           '#B6AC9E','#E3DDD3','#EFEAE2','#DDD6CA','#C7BFB2','#14594A','#0E3F35','#14392F',
           '#EDF3F0','#C9D7D1','#9B3A22'}
# The house palette, verbatim from .claude/skills/ow-design section 2, plus the rail-only three.
HOUSE = {'#14171B','#252A31','#8A939C','#DCE0E4','#E9EBED','#FFFFFF','#F7F9FB','#B23A26','#8E2C1C',
         '#C9573F','#F6E7E3','#1C6B58','#E2EFEB','#B0700A','#FBEFD9','#FEFAF2','#7A4A02','#7F1D1A',
         '#F7E4E2','#59626B','#CFD5DA','#E3E7EA','#C7CFD8','#7C8894'}
SHOPFRONT = {'#FFFFFF','#F6F4F1','#171514','#6E6660','#A29A93','#E9E4DE','#EFEAE5','#F0EBE6',
             '#B23A26','#8E2C1C','#F6E7E3','#F6D8D2','#D9A99E','#E0BFB7','#E4F0EC','#155546',
             '#FBEFD9','#7A4A02','#2E2A27','#BDB5AE','#C6BDB6'}
# The two low-fi direction sketches are deliberate greyscale.
SKETCH = None

def palette_for(f):
    if f.startswith('Console'):  return HOUSE, 'house'
    if f.startswith('Shop'):     return SHOPFRONT, 'shopfront'
    if f.startswith('Direction'):return SKETCH, 'sketch'
    return COUNTER, 'counter'

# Screens that must carry no money at all: the people who do not get prices.
NO_MONEY = {'Storekeeper', 'DeskStorekeeper', 'DeliveryPhoto'}

fails = []
canvas = json.load(open('canvas.json'))
listed = {a['file'] for a in canvas['artboards']}
on_disk = {f for f in os.listdir('.') if f.endswith('.dc.html')}

for f in sorted(listed - on_disk): fails.append(f'canvas.json lists a missing file: {f}')
for f in sorted(on_disk - listed): fails.append(f'file is not on the canvas: {f}')

pages = {p['id'] for p in canvas['pages']}
for a in canvas['artboards']:
    if a['page'] not in pages: fails.append(f'{a["file"]}: unknown page {a["page"]}')
for p in pages:
    ab = [a for a in canvas['artboards'] if a['page'] == p]
    for i, A in enumerate(ab):
        for B in ab[i+1:]:
            if not (A['x']+A['w']+80 <= B['x'] or B['x']+B['w']+80 <= A['x']
                    or A['y']+A['h']+120 <= B['y'] or B['y']+B['h']+120 <= A['y']):
                fails.append(f'artboards overlap on {p}: {A["file"]} and {B["file"]}')

for f in sorted(on_disk & listed):
    src = open(f).read()
    stem = f.replace('.dc.html', '')
    if src.count('<div') != src.count('</div>'):
        fails.append(f'{stem}: {src.count("<div")} <div> vs {src.count("</div>")} </div>')
    body = src.split('</helmet>')[1] if '</helmet>' in src else src

    pal, kind = palette_for(f)
    if pal is not None:
        bad = sorted({h.upper() for h in re.findall(r'#[0-9A-Fa-f]{6}', body)} - pal)
        if bad: fails.append(f'{stem}: off-{kind} colour {bad}')

    if kind == 'counter':
        n = len(re.findall(r'background:#14594A', body))
        if n > 1: fails.append(f'{stem}: {n} filled accents — the accent appears once')
    if kind == 'house':
        n = len(re.findall(r'btn-accent', body))
        if n > 1: fails.append(f'{stem}: {n} accents — the house rule is once per screen')

    if stem in NO_MONEY:
        figs = re.findall(r'\b\d{1,3}(?:,\d{3})+\b', body)
        words = [w for w in re.findall(r'UGX|shilling|VAT|invoice|total', body, re.I)]
        if figs:  fails.append(f'{stem}: carries a money figure {figs} — this screen shows no prices')
        if words: fails.append(f'{stem}: carries currency words {words} — this screen shows no prices')

print(f'{len(listed)} artboards, {len(pages)} pages')
if fails:
    print()
    for x in fails: print('  FAIL', x)
    sys.exit(1)
print('ok — palettes clean, accent used once, no money on the price-free screens, canvas consistent')
