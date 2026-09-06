#!/bin/bash
set -e
cd "$(dirname "$0")"
build(){ # out body extracss w h rail
  { echo '<!doctype html>'; echo '<html>'; echo '<head>'; echo '  <meta charset="utf-8">'; echo '  <script src="./support.js"></script>'; echo '</head>'; echo '<body>'; echo '<x-dc>'; echo '<helmet>'
    echo '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500;600&display=swap">'
    echo '  <style>'; cat _chrome.css; for f in $3; do cat "$f"; done; echo '  </style>'; echo '</helmet>'
    echo "<div class=\"app\" style=\"width:${4}px;height:${5}px\">"
    if [ "$6" = "1" ]; then cat _rail.html; fi
    cat "$2"; echo '</div>'; echo '</x-dc>'; echo '</body>'; echo '</html>'; } > "$1"; echo "built $1"; }
build Main.dc.html   body_main.html  "_extra_main.css _extra_tell.css" 1440 1560 1
build SiteStage.dc.html body_stage.html "_extra_main.css _extra_tell.css" 660 440 0
build Brief1.dc.html body_b1.html "_brief.css" 600 800 0
build Brief2.dc.html body_b2.html "_brief.css" 600 800 0
build Brief3.dc.html body_b3.html "_brief.css" 600 800 0
build Brief4.dc.html body_b4.html "_brief.css" 600 800 0
build BriefThin.dc.html body_bthin.html "_brief.css" 600 800 0
build Relations.dc.html body_rel.html "_extra_main.css _extra_tell.css _rel.css" 1440 1240 1
build Account.dc.html body_acct.html "_extra_main.css _extra_tell.css _rel.css" 1440 840 1
build Phone.dc.html  body_phone.html "_phone.css _extra_main.css _extra_tell.css" 390 844 0
