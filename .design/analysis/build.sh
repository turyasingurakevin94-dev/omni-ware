#!/bin/bash
# Assembles each artboard from the shared chrome CSS/HTML plus its own body.
set -e
cd "$(dirname "$0")"
python3 mkchart.py
build(){ # $1 out $2 body $3 extracss $4 w $5 h $6 rail $7 where $8 navfrag
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
      sed -e "s|__WHERE__|${7}|" -e "/__ANALYSIS__/{r ${8}" -e 'd}' _rail.html
    fi
    python3 compose.py "$2"
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1"
}
X="_extra_main.css"
build Before.dc.html   body_before.html   "$X _extra_before.css" 1440 2620 1 'Analysis' _nav_before.html
build Main.dc.html     body_main.html     "$X"                   1440 1030 1 'Analysis' _nav_after.html
build Evidence.dc.html body_evidence.html "$X"                   1440 1840 1 'Analysis' _nav_after.html
build Empty.dc.html    body_empty.html    "$X"                   1440  900 1 'Analysis' _nav_after.html
build Phone.dc.html    body_phone.html    "$X _extra_phone.css"   390  844 0
exit 0
