#!/usr/bin/env bash
# Puts Strata's prebuilt grid relay (the 3D board's renderer) in <dest>
# (default build/strata): downloads strata-<version>-wasm32-emscripten.tar.gz
# from Strata's release STRATA_VERSION, checks it against the release's
# SHA256SUMS, and copies kit/grid-relay/dist/'s scripts and module and
# Strata's LICENSE. Does nothing when <dest> already holds that version.
#
#   web/fetch-strata.sh [dest]
#
# STRATA_DOWNLOADS=<dir> takes the download and SHA256SUMS from <dir> instead
# of GitHub (for building offline).
set -euo pipefail
cd "$(dirname "$0")/.."

STRATA_VERSION=0.9.1
asset="strata-$STRATA_VERSION-wasm32-emscripten.tar.gz"
files="grid-relay-scene.js grid-relay-scene.wasm grid-relay.js strata-kit.js strata-loader.js"
dest=${1:-build/strata}

if [ "$(cat "$dest/VERSION" 2>/dev/null || true)" = "$STRATA_VERSION" ]; then
  complete=1
  for f in $files LICENSE; do [ -s "$dest/$f" ] || complete=0; done
  if [ "$complete" = 1 ]; then exit 0; fi
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if [ -n "${STRATA_DOWNLOADS:-}" ]; then
  cp "$STRATA_DOWNLOADS/$asset" "$STRATA_DOWNLOADS/SHA256SUMS" "$tmp/"
else
  base="https://github.com/Preponderous-Software/strata/releases/download/v$STRATA_VERSION"
  curl -fsSL --retry 3 -o "$tmp/$asset" "$base/$asset"
  curl -fsSL --retry 3 -o "$tmp/SHA256SUMS" "$base/SHA256SUMS"
fi
(cd "$tmp" && grep " $asset\$" SHA256SUMS | sha256sum -c - >&2)
mkdir -p "$tmp/unpacked"
tar -xzf "$tmp/$asset" -C "$tmp/unpacked"

rm -rf "$dest"
mkdir -p "$dest"
for f in $files; do
  cp "$tmp/unpacked/kit/grid-relay/dist/$f" "$dest/$f"
done
cp "$tmp/unpacked/LICENSE" "$dest/LICENSE"
echo "$STRATA_VERSION" > "$dest/VERSION"
echo "Strata $STRATA_VERSION's grid relay is in $dest" >&2
