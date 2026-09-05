#!/bin/bash
# Assembles each artboard from the shared chrome CSS/HTML plus its own body.
set -e
cd "$(dirname "$0")"
build(){ # $1 out $2 body $3 extracss $4 w $5 h $6 rail
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
    if [ "$6" = "1" ]; then cat _rail.html; fi
    cat "$2"
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1"
}
build Before.dc.html  body_before.html  "_extra_before.css"                 1440 920 1
build Main.dc.html    body_main.html    "_extra_main.css"                   1440 1740 1
build Account.dc.html body_account.html "_extra_main.css _extra_account.css" 1440 1220 1
build States.dc.html  body_states.html  "_extra_main.css _extra_states.css" 1440 1240 1
build Phone.dc.html   body_phone.html   "_phone.css"                        390  844  0
exit 0
