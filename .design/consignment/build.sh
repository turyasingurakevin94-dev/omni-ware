#!/bin/bash
# Assembles each artboard from the shared chrome CSS/HTML plus its own body.
set -e
cd "$(dirname "$0")"
build(){ # $1 out  $2 body  $3 extracss  $4 w  $5 h  $6 rail(1/0)  $7 badge
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
    [ "$6" = "1" ] && sed "s|__BADGE__|${7-<span class=\"nav-badge\">3</span>}|" _rail.html
    cat "$2"
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1"
}
build Main.dc.html   body_main.html   _extra_main.css   1440 1000 1
build Before.dc.html body_before.html _extra_before.css 1440 1260 1
build Scale.dc.html  body_scale.html  _extra_main.css   1440 1040 1 '<span class="nav-badge">7</span>'
build Empty.dc.html  body_empty.html  _extra_main.css   1440 660  1 ''
exit 0
