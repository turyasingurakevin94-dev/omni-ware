#!/bin/bash
# Assembles each artboard from the shared chrome CSS/rail plus its own body.
set -e
cd "$(dirname "$0")"
build(){ # $1 out  $2 body  $3 extra css  $4 w  $5 h  $6 rail(1/0)
  { echo '<!doctype html>'
    echo '<html>'
    echo '<head>'
    echo '  <meta charset="utf-8">'
    echo '  <script src="./support.js"></script>'
    echo '</head>'
    echo '<body>'
    echo '<x-dc>'
    echo '<helmet>'
    echo '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500;600&display=swap">'
    echo '  <style>'
    cat _chrome.css
    for f in $3; do cat "$f"; done
    echo '  </style>'
    echo '</helmet>'
    echo "<div class=\"app\" style=\"width:${4}px;height:${5}px\">"
    [ "$6" = "1" ] && cat _rail.html
    cat "$2"
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1  ($(wc -c < "$1") bytes)"
}
build Main.dc.html   body_main.html   "_extra_main.css"   1440 900 1
[ -f body_ledger.html ] && build Ledger.dc.html body_ledger.html "_extra_ledger.css" 1440 900 1
[ -f body_deal.html ]   && build Deal.dc.html   body_deal.html   "_extra_deal.css"   1440 900 1
[ -f body_phone.html ]  && build Phone.dc.html  body_phone.html  "_extra_phone.css"   390 844 0
exit 0
