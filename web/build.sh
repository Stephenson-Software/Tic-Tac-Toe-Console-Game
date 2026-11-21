#!/usr/bin/env bash
# Builds the browser version of the game into build/web: index.html plus
# tic-tac-toe.jar, which web/index.html runs with CheerpJ. CheerpJ runs Java 8
# bytecode by default, so the classes are compiled with --release 8. The console
# game's own build (javac -d out src/*.java) is not affected.
#
# The page's 3D board (web/board3d.js, web/board3d-scene.js) is drawn by
# Strata's grid relay, which web/fetch-strata.sh fetches from Strata's release
# (checked against its SHA256SUMS) into build/strata and this copies into
# build/web/strata. STRATA_DOWNLOADS=<dir> builds offline (see fetch-strata.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf build/browser-classes build/web
mkdir -p build/browser-classes build/web
javac --release 8 -d build/browser-classes src/*.java web/java/BrowserMain.java
jar cf build/web/tic-tac-toe.jar -C build/browser-classes .
cp web/index.html web/board3d.js web/board3d-scene.js build/web/
web/fetch-strata.sh build/strata
mkdir -p build/web/strata
cp build/strata/* build/web/strata/
echo "Built build/web:"
ls -l build/web
