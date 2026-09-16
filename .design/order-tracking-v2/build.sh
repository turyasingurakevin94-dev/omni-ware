#!/bin/bash
# Assembles each artboard from the shared chrome CSS + rail plus its own body.
set -e
cd "$(dirname "$0")"
OUT=.
mkdir -p "$OUT"
build(){ # $1 out  $2 root-class  $3 w  $4 h  $5 rail(1/0)  $6 body  $7... extra css / overlay
  local out="$1" rootcls="$2" w="$3" h="$4" rail="$5" body="$6"; shift 6
  { echo '<!doctype html>'
    echo '<html lang="en">'
    echo '<head>'
    echo '  <meta charset="utf-8">'
    echo '  <script src="./support.js"></script>'
    echo '</head>'
    echo '<body>'
    echo '<x-dc>'
    echo '<helmet>'
    echo '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&amp;family=Archivo+Black&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap">'
    echo '  <style>'
    cat _chrome.css
    for f in "$@"; do case "$f" in *.css) cat "$f";; esac; done
    echo '  </style>'
    echo '</helmet>'
    echo "<div class=\"$rootcls\" style=\"width:${w}px;height:${h}px;\">"
    [ "$rail" = "1" ] && cat _rail.html
    cat "$body"
    for f in "$@"; do case "$f" in *.html) cat "$f";; esac; done
    echo '</div>'
    echo '</x-dc>'
    echo "<script data-dc-script data-props='{\"\$preview\":{\"width\":${w},\"height\":${h}}}'>"
    echo 'class Component extends DCLogic {'
    echo '  renderVals() { return {}; }'
    echo '}'
    echo '</script>'
    echo '</body>'
    echo '</html>'
  } > "$OUT/$out"
  echo "built $out  ($(wc -c < "$OUT/$out") bytes)"
}
build Main.dc.html   app 1440 900 1 body_main.html   _extra_main.css
build Day.dc.html    app 1440 900 1 body_day.html    _extra_day.css
build Board.dc.html  app 1440 900 1 body_board.html  _extra_board.css
build Record.dc.html app 1440 900 1 body_board.html  _extra_board.css _extra_record.css _overlay_record.html
build Phone.dc.html  ph   390 844 0 body_phone.html  _extra_phone.css
