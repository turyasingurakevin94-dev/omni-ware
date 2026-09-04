import sys, pathlib
def read(p, default=""):
    f = pathlib.Path(p)
    return f.read_text() if f.exists() else default

SHELL = '''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
  <style>
{css}
  </style>
</helmet>
{body}
</x-dc>
</body>
</html>
'''
for name in sys.argv[1:]:
    css = read("_chrome.css") + "\n" + read("_extra.css") + "\n" + read(f"_extra_{name.lower()}.css")
    body = read(f"body_{name.lower()}.html")
    for frag in ("topbar","nav"):
        body = body.replace("__"+frag.upper()+"__", read(f"_{frag}.html").rstrip())
    out = f"{name}.dc.html"
    pathlib.Path(out).write_text(SHELL.format(css=css, body=body))
    print(f"{out:24} {len(body):>7} body  {len(css):>7} css")
