#!/bin/sh
# Sets up the environment (first time), downloads the model (first time) and starts the server.  ./run.sh [port] [--host 0.0.0.0]
set -e
cd "$(dirname "$0")"
[ -x venv/bin/python ] || python3 -m venv venv
if ! cmp -s requirements.txt venv/.installed; then
  venv/bin/python -m pip install -r requirements.txt
  cp requirements.txt venv/.installed
fi
exec venv/bin/python viz/server.py "$@"
