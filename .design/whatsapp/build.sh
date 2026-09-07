#!/bin/bash
# Assembles each artboard from the shared chrome CSS plus its own body.
set -e
cd "$(dirname "$0")"
build(){ # $1 out  $2 body  $3 w  $4 h  $5 extra css files
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
    cat _extra.css
    X="_extra_$(echo "$(basename "$1" .dc.html)" | tr 'A-Z' 'a-z').css"
    if [ -f "$X" ]; then cat "$X"; fi
    for f in $5; do cat "$f"; done
    echo '  </style>'
    echo '</helmet>'
    echo "<div class=\"app\" style=\"width:${3}px;height:${4}px\">"
    python3 - "$2" <<'PY'
import sys,os,re
src=open(sys.argv[1]).read()
def repl(m):
    f='_'+m.group(1).lower()+'.html'
    return open(f).read() if os.path.exists(f) else m.group(0)
for _ in range(3):
    src=re.sub(r'__([A-Z]+)__', repl, src)
sys.stdout.write(src)
PY
    echo '</div>'
    echo '</x-dc>'
    echo '</body>'
    echo '</html>'
  } > "$1"
  echo "built $1  ${3}x${4}"
}
build Main.dc.html    body_main.html    1440 "${H_MAIN:-1150}"
build Rooms.dc.html   body_rooms.html   1440 "${H_ROOMS:-850}"
build States.dc.html  body_states.html  1440 "${H_STATES:-830}"
build Before.dc.html  body_before.html  1440 "${H_BEFORE:-960}"
build Rail.dc.html    body_rail.html    "${W_RAIL:-820}" "${H_RAIL:-1230}"
build Post.dc.html    body_post.html    1440 "${H_POST:-1180}"
build Rank.dc.html    body_rank.html    "${W_RANK:-620}" "${H_RANK:-1440}" _extra_post.css
build Cold.dc.html    body_cold.html    "${W_COLD:-620}" "${H_COLD:-760}" _extra_post.css
