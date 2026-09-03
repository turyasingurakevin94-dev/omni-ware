#!/bin/bash
# Assembles each artboard from the shared chrome CSS/HTML plus its own body.
set -e
cd "$(dirname "$0")"
build(){ # $1 out $2 body $3 extracss $4 w $5 h $6 rail $7 where $8 credactive $9 credlabel ${10} badge
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
      sed -e "s|__WHERE__|${7}|" \
          -e "s|__CRED__|${8}|" \
          -e "s|__CREDLABEL__|${9}|" \
          -e "s|__CBADGE__|${10}|" _rail.html
    fi
    cat "$2"
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1"
}
X="_extra_main.css _extra_cred.css"
build Before.dc.html body_before.html "$X _extra_before.css" 1440 1560 1 'Who you owe' active 'Who you owe' ''
build Main.dc.html   body_main.html   "$X"                  1440 1150 1 'Creditors'   active 'Creditors' '<span class="nav-badge">9</span>'
build Naming.dc.html body_naming.html "$X"                  1440 1030 1 'Creditors'   active 'Creditors' '<span class="nav-badge">9</span>'
build Empty.dc.html  body_empty.html  "$X"                  1440 900  1 'Creditors'   active 'Creditors' ''
build Phone.dc.html  body_phone.html  "$X _extra_phone.css" 390  844  0
exit 0
