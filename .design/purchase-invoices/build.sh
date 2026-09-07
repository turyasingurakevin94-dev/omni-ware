#!/bin/bash
# Assembles each artboard from the shared chrome CSS/HTML plus its own body.
set -e
cd "$(dirname "$0")"
build(){ # $1 out $2 body $3 extracss $4 w $5 h $6 rail $7 where $8 active $9 badge
  { echo '<!doctype html>'
    echo '<html>'
    echo '<head>'
    echo '  <meta charset="utf-8">'
    echo '  <script src="./support.js"></script>'
    echo '</head>'
    echo '<body>'
    echo '<x-dc>'
    echo '<helmet>'
    echo '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500;600&display=swap">'
    echo '  <style>'
    cat _chrome.css
    for f in $3; do cat "$f"; done
    echo '  </style>'
    echo '</helmet>'
    echo "<div class=\"app\" style=\"width:${4}px;height:${5}px\">"
    if [ "$6" = "1" ]; then
      sed -e "s|__WHERE__|${7}|" -e "s|__PIA__|${8}|" -e "s|__PIBADGE__|${9}|" _rail.html
    fi
    python3 - "$2" <<'PY'
import sys,os,re
src=open(sys.argv[1]).read()
def repl(m):
    f='_'+m.group(1).lower()+'.html'
    return open(f).read() if os.path.exists(f) else ''
sys.stdout.write(re.sub(r'__([A-Z]+)__', repl, src))
PY
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1"
}
X="_extra_main.css"
build Before.dc.html body_before.html "$X _extra_before.css" 1440 1180 1 'Purchase invoices' active ''
build Main.dc.html   body_main.html   "$X"                   1440 1730 1 'Purchase invoices' active '<span class="nav-badge">4</span>'
build Checks.dc.html body_checks.html "$X"                   1440 1120 1 'Purchase invoices' active '<span class="nav-badge">4</span>'
build Empty.dc.html  body_empty.html  "$X"                   1440 1120 1 'Purchase invoices' active ''
build Phone.dc.html     body_phone.html      "$X _extra_phone.css"  390  844  0
build PhoneBill.dc.html body_phone_bill.html "$X _extra_phone.css"  390  844  0
exit 0
