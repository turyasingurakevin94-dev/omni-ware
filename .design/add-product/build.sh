#!/bin/bash
# Assembles each artboard from the shared chrome + modal CSS plus its own body.
set -e
cd "$(dirname "$0")"
build(){ # $1 out $2 body $3 extracss $4 w $5 h
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
    cat _modal.css
    for f in $3; do cat "$f"; done
    echo '  </style>'
    echo '</helmet>'
    echo "<div class=\"app\" style=\"width:${4}px;height:${5}px\">"
    cat "$2"
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1"
}
build Before.dc.html   body_before.html   "_before.css"  1440 1010
[ -f body_main.html ]     && build Main.dc.html     body_main.html     "_after.css"  1440 1010
[ -f body_variants.html ] && build Variants.dc.html body_variants.html "_after.css"  1440 1200
[ -f body_states.html ]   && build States.dc.html   body_states.html   "_after.css"  1560 2360
[ -f body_phone.html ]    && build Phone.dc.html    body_phone.html    "_phone.css"  390  844
exit 0
