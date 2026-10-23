"""python3 build.py Main [Visit ...]: run boards/<Name>.py and write canvas/project/<Name>.dc.html"""
import sys, os, runpy
T = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, T)
OUT = os.path.join(T, '..', 'canvas', 'project')
for name in sys.argv[1:]:
    g = runpy.run_path(os.path.join(T, 'boards', name + '.py'))
    open(os.path.join(OUT, name + '.dc.html'), 'w').write(g['html'])
    print('wrote', name)
