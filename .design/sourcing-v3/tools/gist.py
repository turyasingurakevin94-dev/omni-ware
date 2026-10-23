"""Print a board's visible text (in order) and its script, to redraw it without re-reading the markup."""
import sys, re, html
for f in sys.argv[1:]:
    s = open(f).read()
    body = s.split('</helmet>')[1].split('</x-dc>')[0]
    body = re.sub(r'<svg.*?</svg>', ' ', body, flags=re.S)
    links = re.findall(r'href="([^"]+)"', body)
    txt = re.sub(r'<[^>]+>', '\n', body)
    lines = [html.unescape(l.strip()) for l in txt.split('\n') if l.strip()]
    scr = s.split('data-dc-script')[1]
    print('=====', f.split('/')[-1], '| links:', sorted(set(links)))
    print(' | '.join(lines))
    print(scr[scr.index('class Component'):scr.index('</script>')].strip())
