#!/bin/bash
# Assembles each artboard from the shared chrome CSS/HTML plus its own body.
set -e
cd "$(dirname "$0")"
build(){ # $1 out  $2 body  $3 extracss  $4 w  $5 h  $6 include-rail(1/0)
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
    [ -n "$3" ] && cat "$3"
    echo '  </style>'
    echo '</helmet>'
    echo "<div class=\"app\" style=\"width:${4}px;height:${5}px\">"
    [ "$6" = "1" ] && sed "s|__BADGE__|${7-<span class=\"nav-badge\">14</span>}|" _rail.html
    cat "$2"
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1"
}
build Main.dc.html          body_main.html  _extra_main.css  1440 940 1
[ -f body_all.html ]   && build AllFollowUps.dc.html body_all.html   _extra_all.css   1440 1160 1
[ -f body_empty.html ] && build Empty.dc.html        body_empty.html _extra_main.css  1440 720 1 ""
[ -f body_before.html ]&& build Before.dc.html       body_before.html _extra_before.css 1440 1000 1
[ -f body_phone.html ] && build Phone.dc.html        body_phone.html _extra_phone.css  390 844 0
[ -f body_phonemsg.html ]&& build PhoneMessage.dc.html body_phonemsg.html _extra_phone.css 390 844 0
exit 0
