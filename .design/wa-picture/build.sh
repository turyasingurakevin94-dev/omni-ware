#!/usr/bin/env bash
# Assembles a .dc.html artboard from the shared document CSS plus a body
# fragment, so the five artboards cannot drift from one another.
set -euo pipefail
name="$1"; extra="${2:-}"
{
  printf '<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n<helmet>\n  <style>\n'
  cat _doc.css
  [ -n "$extra" ] && cat "$extra"
  printf '  </style>\n</helmet>\n'
  cat "body_${name}.html"
  printf '</x-dc>\n</body>\n</html>\n'
} > "$(tr '[:lower:]' '[:upper:]' <<< "${name:0:1}")${name:1}.dc.html"
echo "built $(tr '[:lower:]' '[:upper:]' <<< "${name:0:1}")${name:1}.dc.html"
