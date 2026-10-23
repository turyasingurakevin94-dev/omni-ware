"""python3 build.py Main [Visit ...]: run boards/<Name>.py and write canvas/project/<Name>.dc.html"""
import sys, os, runpy, re
T = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, T); sys.path.insert(0, os.path.join(T, 'boards'))
OUT = os.path.join(T, '..', 'canvas', 'project')
# the stamp workflow replaced these boards; they stay on the canvas as "superseded" and keep their links
REMAP = {'Funnel': 'Rooms', 'Passport': 'ItemPass', 'Wanted': 'AskNew', 'Hunt': 'StampSource', 'NewItem': 'AskNew',
         'SuppliersGate': 'StampSource', 'PackingGate': 'StampPack', 'PhotoGate': 'StampPhoto', 'NameAisle': 'StampPlace',
         'Verdict': 'StampHold', 'GapWalk': 'Round', 'SendToManager': 'RuthTray', 'ManagerItem': 'RuthTray', 'SentBack': 'ItemPass',
         'Live': 'ShelfPhone', 'ReportCard': 'ShelfPhone', 'MarketRun': 'ListPhone', 'LongNames': 'Rooms'}
SUPERSEDED = set(REMAP)


def remap(html):
    return re.sub(r'(?<=["\'])(' + '|'.join(REMAP) + r')\.dc\.html', lambda m: REMAP[m.group(1)] + '.dc.html', html)
for name in sys.argv[1:]:
    g = runpy.run_path(os.path.join(T, 'boards', name + '.py'))
    if name in SUPERSEDED:
        print('skip', name, '(superseded; kept as it was)')
        continue
    open(os.path.join(OUT, name + '.dc.html'), 'w').write(remap(g['html']))
    print('wrote', name)
