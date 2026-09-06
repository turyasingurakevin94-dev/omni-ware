#!/bin/bash
# Assembles each artboard from the shared chrome CSS/HTML plus its own body.
set -e
cd "$(dirname "$0")"
build(){ # $1 out $2 body $3 extracss $4 w $5 h $6 railfile $7 logic
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
    if [ -n "$6" ]; then cat "$6"; fi
    cat "$2"
    echo '</div>'
    echo '</x-dc>'
    if [ -n "$7" ]; then
      echo "<script data-dc-script>"
      cat "$7"
      echo '</script>'
    fi
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1"
}
build Before.dc.html body_before.html "_extra_before.css"  1440  790 _rail_before.html ""
build Main.dc.html   body_main.html   "_extra_main.css"    1440 3760 _rail.html "_logic_main.js"
build States.dc.html body_states.html "_extra_main.css _extra_states.css" 1440 1620 _rail.html ""
build Words.dc.html      body_words.html      "_extra_words.css" 1440 1990 _rail.html "_logic_words.js"
build WordsBefore.dc.html body_wordsbefore.html "_extra_words.css _extra_wb.css" 1440 830 _rail.html ""
build Merge.dc.html      body_merge.html      "_extra_words.css" 1440 940 "" ""
build Attributes.dc.html body_attributes.html "_extra_words.css" 1440 850 "" ""
exit 0
