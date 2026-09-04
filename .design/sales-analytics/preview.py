# A plain-HTML preview of an artboard so it can be screenshotted before it
# ships. Strips the <x-dc> wrapper and lifts <helmet> into a real <head>;
# the body inside is ordinary markup, so what this renders is what the
# canvas renders.
import sys, re, pathlib
src = pathlib.Path(sys.argv[1]).read_text()
helmet = re.search(r"<helmet>(.*?)</helmet>", src, re.S).group(1)
body = re.search(r"</helmet>(.*?)</x-dc>", src, re.S).group(1)
out = f"<!doctype html><html><head><meta charset='utf-8'>{helmet}</head><body style='margin:0'>{body}</body></html>"
pathlib.Path(sys.argv[2]).write_text(out)
