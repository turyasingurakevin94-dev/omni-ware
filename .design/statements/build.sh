#!/bin/bash
set -e
cd "$(dirname "$0")"
python3 mkchart.py
build(){ # 1 out  2 body  3 extracss  4 w  5 h  6 rail
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
    if [ "$6" = "1" ]; then
      echo "<div class=\"app\" style=\"width:${4}px;height:${5}px\">"
      cat _rail.html
    else
      echo "<div style=\"width:${4}px;height:${5}px\">"
    fi
    python3 compose.py "$2"
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1"
}
build Before.dc.html body_before.html "_before.css" 1440 1440 1
build Main.dc.html   body_main.html   "_after.css"  1440 1040 1
build Doc.dc.html    body_doc.html    "_after.css"  1440  830 1
build Phone.dc.html  body_phone.html  "_after.css _phone.css" 390 844 0
