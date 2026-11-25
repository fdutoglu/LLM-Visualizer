#!/bin/sh
# Ortamı kurar (ilk sefer), modeli indirir (ilk sefer) ve sunucuyu başlatır.  ./run.sh [port] [--host 0.0.0.0]
set -e
cd "$(dirname "$0")"
[ -x venv/bin/python ] || python3 -m venv venv
if ! cmp -s requirements.txt venv/.kurulu; then
  venv/bin/python -m pip install -r requirements.txt
  cp requirements.txt venv/.kurulu
fi
exec venv/bin/python viz/server.py "$@"
