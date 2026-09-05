#!/bin/sh
# Wraps each body_*.html in the Design Component shell + the shared helmet.
set -e
for pair in "main:Main" "ribbon:Ribbon" "spread:Spread" "risk:Risk" "fresh:Freshness" "shape:Shape" "phone:Phone"; do
  src="body_${pair%%:*}.html"; out="${pair##*:}.dc.html"
  { printf '<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n'
    cat _helmet.html
    printf '\n'
    cat "$src"
    printf '</x-dc>\n</body>\n</html>\n'
  } > "$out"
  echo "$out  <- $src"
done
