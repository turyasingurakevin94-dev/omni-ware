#!/bin/bash
# Assembles each artboard from the shared chrome CSS/HTML plus its own body.
set -e
cd "$(dirname "$0")"
build(){ # $1 out $2 body $3 extracss $4 w $5 h $6 rail $7 where $8 navlabel
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
      sed -e "s|__WHERE__|${7}|" -e "s|__NAV__|${8}|" _rail.html
    fi
    cat "$2"
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1"
}
M="_extra_main.css"
build Before.dc.html body_before.html "$M _extra_before.css" 1440 1440 1 'Compare Prices' 'Compare prices'
build Main.dc.html   body_main.html   "$M"                   1440 1250 1 'Compare prices' 'Compare prices'
build Rivals.dc.html body_rivals.html "$M _extra_rivals.css" 1440 1060 1 'Compare prices' 'Compare prices'
build Empty.dc.html  body_empty.html  "$M _extra_rivals.css" 1440 1040 1 'Compare prices' 'Compare prices'
build Phone.dc.html  body_phone.html  "$M _phone.css _extra_phone.css" 390 844 0
exit 0
