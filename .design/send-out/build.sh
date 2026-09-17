#!/bin/bash
set -e
cd "$(dirname "$0")"
build(){ local out="$1" rootcls="$2" w="$3" h="$4" rail="$5" body="$6"; shift 6
  { echo '<!doctype html>'; echo '<html lang="en">'; echo '<head>'
    echo '  <meta charset="utf-8">'; echo '  <script src="./support.js"></script>'
    echo '</head>'; echo '<body>'; echo '<x-dc>'; echo '<helmet>'
    echo '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&amp;family=Archivo+Black&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap">'
    echo '  <style>'; cat _chrome.css
    for f in "$@"; do case "$f" in *.css) cat "$f";; esac; done
    echo '  </style>'; echo '</helmet>'
    echo "<div class=\"$rootcls\" style=\"width:${w}px;height:${h}px;\">"
    cat "$body"
    echo '</div>'; echo '</x-dc>'
    echo "<script data-dc-script data-props='{\"\$preview\":{\"width\":${w},\"height\":${h}}}'>"
    echo 'class Component extends DCLogic {'; echo '  renderVals() { return {}; }'; echo '}'
    echo '</script>'; echo '</body>'; echo '</html>'
  } > "$out"
  echo "built $out ($(wc -c < "$out"))"
}
build Main.dc.html  frame 680 500 0 body_main.html  _frame.css _tokens.css _app.css _out.css
build Ours.dc.html  frame 680 500 0 body_ours.html  _frame.css _tokens.css _app.css _out.css
build Hired.dc.html frame 680 580 0 body_hired.html _frame.css _tokens.css _app.css _out.css
build Gone.dc.html  frame 680 460 0 body_gone.html  _frame.css _tokens.css _app.css _out.css
build Phone.dc.html ph 390 844 0 body_phone.html _frame.css _tokens.css _app.css _out.css _app_narrow.css
build Now.dc.html frame 830 644 0 body_now.html _frame.css _tokens.css
