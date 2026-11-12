# Lay every board out on one canvas: pages = areas, rows = manifest rows,
# each board's title carries its independent score beside the agent screen's.
import json, os, datetime
SX = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
P = os.path.join(SX, 'root', 'project')
AREAS = [('today', 'Today'), ('pack', 'Pack'), ('in', 'Goods in'), ('shelf', 'Shelf'), ('out', 'Out')]
W, H, GAPX, GAPY, TITLE = 360, 800, 80, 120, 260
boards, order, notes, pages = {}, [], {}, [{'id': 'flow', 'name': 'Integration & flow'}]
# integration and flow boards first, on their own page
y = 0
for f in ['IB01Handovers.dc.html', 'IB02StateWords.dc.html', 'FL01Taps.dc.html']:
    src = open(os.path.join(P, f)).read()
    import re
    m = re.search(r'"\$preview":\{"width":(\d+),"height":(\d+)\}', src)
    w, h = int(m.group(1)), int(m.group(2))
    title = {'IB01Handovers.dc.html': 'Integration → every app ↔ Store handover, its push and both apps\' words',
             'IB02StateWords.dc.html': 'Integration → one word per order state, in every app',
             'FL01Taps.dc.html': 'Flow → steps and taps, today against the new Store'}[f]
    boards[f] = {'x': 0, 'y': y, 'w': w, 'h': h, 'title': title, 'page': 'flow'}
    order.append(f)
    y += h + GAPY
notes['flowtitle'] = {'x': 0, 'y': -300, 'text': 'Integration and flow', 'kind': 'title1', 'maxW': 1440, 'page': 'flow'}
summary = []
for area, name in AREAS:
    pages.append({'id': area, 'name': name})
    man = json.load(open(os.path.join(SX, 'manifest', area + '.json')))
    rev = {b['file']: b for b in json.load(open(os.path.join(SX, 'review', area + '.json')))['boards']}
    y = 0
    seen = set()
    for ri, row in enumerate(man['rows']):
        notes[f'{area}r{ri}'] = {'x': 0, 'y': y - TITLE + 20, 'text': row['title'], 'kind': 'title1',
                                 'maxW': max(1, len(row['boards'])) * (W + GAPX) - GAPX, 'page': area}
        for bi, b in enumerate(row['boards']):
            f = b['file']
            if f in seen or not os.path.exists(os.path.join(P, f)):
                continue
            seen.add(f)
            r = rev.get(f)
            if r:
                s, a = r['store']['total'], r['agent']['total']
                mark = '✓' if r['pass'] else '✗'
                score = f" · score {s/5:.1f} vs agent {a/5:.1f} {mark}"
                summary.append((area, f, s, a, r['pass'], r.get('agent_match', '')))
            else:
                score = ' · not scored'
                summary.append((area, f, None, None, False, ''))
            boards[f] = {'x': bi * (W + GAPX), 'y': y, 'w': W, 'h': H, 'title': b['title'] + score, 'page': area}
            order.append(f)
        y += H + TITLE + GAPY
    # anything drawn but missing from the manifest rows
    extra = sorted(x for x in os.listdir(P) if x.startswith(man['prefix']) and x not in seen)
    for bi, f in enumerate(extra):
        boards[f] = {'x': bi * (W + GAPX), 'y': y, 'w': W, 'h': H, 'title': f[:-8], 'page': area}
        order.append(f)
        summary.append((area, f, None, None, False, ''))
idx = {'v': 3, 'createdOnFiles': {'v': 1, 'at': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},
       'title': "Store — in the agent app's language", 'launch': {'view': 'canvas', 'page': 'flow'},
       'pages': pages, 'boards': boards, 'order': order, 'notes': notes, 'designSystems': []}
json.dump(idx, open(os.path.join(P, 'canvas.json'), 'w'), indent=1, ensure_ascii=False)
json.dump(summary, open(os.path.join(SX, 'review', 'summary.json'), 'w'), indent=1)
n = len(summary); p = sum(1 for s in summary if s[4])
print(f'{len(boards)} boards on the canvas; {p} of {n} store boards pass')
for s in summary:
    if not s[4]:
        print('  not passing:', s[0], s[1], s[2], s[3])
