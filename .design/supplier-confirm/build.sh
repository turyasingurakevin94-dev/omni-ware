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
build Main.dc.html    frame 680 620 0 body_main.html    _frame.css _tokens.css _app.css _sup.css
build Reply.dc.html   frame 680 660 0 body_reply.html   _frame.css _tokens.css _app.css _sup.css
build Problem.dc.html frame 680 680 0 body_problem.html _frame.css _tokens.css _app.css _sup.css
build Done.dc.html    frame 680 620 0 body_done.html    _frame.css _tokens.css _app.css _sup.css
build Phone.dc.html frame 390 844 0 body_phone.html _frame.css _tokens.css _app.css _sup.css _app_narrow.css
build NowDialog.dc.html frame 680 478 0 body_nowDialog.html _frame.css _tokens.css
build NowModal.dc.html  frame 760 345 0 body_nowModal.html  _frame.css _tokens.css
