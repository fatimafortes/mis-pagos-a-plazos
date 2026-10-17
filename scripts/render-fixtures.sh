#!/bin/sh
# Re-renders tests/fixtures/*.png from tests/fixtures/src/*.html with headless Chrome.
# Usage: sh scripts/render-fixtures.sh [name ...]   (default: all)
set -e
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
DIR="$(cd "$(dirname "$0")/../tests/fixtures" && pwd)"
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT
names="$*"
[ -z "$names" ] && names="$(cd "$DIR/src" && ls *.html | sed 's/\.html$//')"
for n in $names; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$PROFILE" \
    --window-size=390,600 --screenshot="$DIR/$n.png" "file://$DIR/src/$n.html" >/dev/null 2>&1
  echo "rendered $n.png"
done
