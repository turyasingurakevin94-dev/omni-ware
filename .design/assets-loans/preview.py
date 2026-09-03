# Renders a .dc.html body as a plain page so it can be looked at before
# it ever reaches a canvas. The x-dc/helmet wrappers are the editor's;
# the browser only needs the style and the markup.
import re, sys, pathlib
src = pathlib.Path(sys.argv[1]).read_text()
style = re.search(r'<helmet>(.*?)</helmet>', src, re.S).group(1)
body  = re.search(r'</helmet>(.*?)</x-dc>', src, re.S).group(1)
out = '<!doctype html><html><head><meta charset="utf-8">%s</head><body>%s</body></html>' % (style, body)
pathlib.Path(sys.argv[2]).write_text(out)
