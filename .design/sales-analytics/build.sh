#!/bin/bash
# Assembles every artboard from the shared chrome CSS plus its own body.
set -e
cd "$(dirname "$0")"
python3 mkchart.py
python3 compose.py Before Main Views States Phone
