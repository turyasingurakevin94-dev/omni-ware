# Expands @@file@@ markers in a body, recursively, so a fragment used by
# several artboards is written once. Chart SVGs come in the same way.
import re, sys, os

def expand(path, depth=0):
    if depth > 6: raise RuntimeError('include loop at ' + path)
    src = open(path).read()
    def sub(m):
        f = m.group(1)
        if not os.path.exists(f): raise RuntimeError('missing include: ' + f)
        return expand(f, depth + 1)
    return re.sub(r'@@([\w./-]+)@@', sub, src)

sys.stdout.write(expand(sys.argv[1]))
