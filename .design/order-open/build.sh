#!/bin/bash
set -e
cd "$(dirname "$0")"
OUT=.
mkdir -p "$OUT"
build(){ local out="$1" rootcls="$2" w="$3" h="$4" rail="$5" body="$6"; shift 6
  { echo '<!doctype html>'; echo '<html lang="en">'; echo '<head>'
    echo '  <meta charset="utf-8">'; echo '  <script src="./support.js"></script>'
    echo '</head>'; echo '<body>'; echo '<x-dc>'; echo '<helmet>'
    echo '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&amp;family=Archivo+Black&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap">'
    echo '  <style>'; cat _chrome.css
    for f in "$@"; do case "$f" in *.css) cat "$f";; esac; done
    echo '  </style>'; echo '</helmet>'
    echo "<div class=\"$rootcls\" style=\"width:${w}px;height:${h}px;\">"
    [ "$rail" = "1" ] && cat _rail.html
    cat "$body"
    for f in "$@"; do case "$f" in *.html) cat "$f";; esac; done
    echo '</div>'; echo '</x-dc>'
    echo "<script data-dc-script data-props='{\"\$preview\":{\"width\":${w},\"height\":${h}}}'>"
    echo 'class Component extends DCLogic {'; echo '  renderVals() { return {}; }'; echo '}'
    echo '</script>'; echo '</body>'; echo '</html>'
  } > "$OUT/$out"
  echo "built $out ($(wc -c < "$OUT/$out"))"
}
build Main.dc.html  app 1440 900 1 body_board.html _extra_board.css _op.css _op_main.html
build Busy.dc.html  app 1440 900 1 body_board.html _extra_board.css _op.css _op_busy.html
build More.dc.html  app 1440 900 1 body_board.html _extra_board.css _op.css _op_more.html
build Phone.dc.html ph   390 844 0 body_phone.html _extra_phone.css _op.css _op_phone.css _op_phone.html
build NowOrder.dc.html  frame 900 596 0 body_now_order.html  _cut.css
build NowShort.dc.html  frame 620 304 0 body_now_short.html  _cut.css
build NowBuying.dc.html frame 980 654 0 body_now_buying.html _cut.css
build NowRuns.dc.html   frame 800 402 0 body_now_runs.html   _cut.css
build Menu.dc.html      frame 680 446 0 body_menu.html   _op.css _cut.css
build Short.dc.html     frame 560 300 0 body_short.html  _op.css _cut.css
build Buying.dc.html    frame 900 452 0 body_buying.html _op.css _cut.css
build Runs.dc.html      frame 900 388 0 body_runs.html   _op.css _cut.css
