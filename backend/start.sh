#!/bin/sh
set -eu
here=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
db="${STOREFRONT_DB:-/var/data/storefront.db}"
mkdir -p "$(dirname "$db")"
if [ ! -f "$db" ] && [ -f "$here/storefront.db" ]; then
  cp "$here/storefront.db" "$db"
fi
port="${PORT:-10000}"
exec gunicorn --chdir "$here" --bind "0.0.0.0:${port}" --workers 1 --threads 4 --timeout 60 app:app
