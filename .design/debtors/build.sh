#!/bin/bash
# Assembles each artboard from the shared chrome CSS/HTML plus its own body.
set -e
cd "$(dirname "$0")"
build(){ # $1 out  $2 body  $3 extracss  $4 w  $5 h  $6 rail(1/0)  $7 where  $8 activenav  $9 badge
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
    [ -n "$3" ] && cat $3
    echo '  </style>'
    echo '</helmet>'
    echo "<div class=\"app\" style=\"width:${4}px;height:${5}px\">"
    if [ "$6" = "1" ]; then
      sed -e "s|__WHERE__|${7}|" \
          -e "s|__DEBT__|$([ "$8" = "debtors" ] && echo active)|" \
          -e "s|__CHASE__|$([ "$8" = "chase" ] && echo active)|" \
          -e "s|__BADGE__|${9}|" _rail.html
    fi
    cat "$2"
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1"
}
build Before.dc.html   body_before.html   _extra_before.css 1440 1500 1 'Who owes you' debtors '<span class="nav-badge">14</span>'
build Main.dc.html     body_main.html     _extra_main.css   1440 1090 1 'Debtors'       debtors '<span class="nav-badge">14</span>'
build Filtered.dc.html body_filtered.html _extra_main.css   1440 1010 1 'Debtors'       debtors '<span class="nav-badge">14</span>'
build Empty.dc.html    body_empty.html    _extra_main.css   1440 880  1 'Debtors'       debtors ''
build Chase.dc.html    body_chase.html    "_extra_main.css _extra_chase.css" 1440 900 1 'Chase debts' chase '<span class="nav-badge">14</span>'
build Phone.dc.html    body_phone.html    _extra_phone.css  390  844  0
exit 0
