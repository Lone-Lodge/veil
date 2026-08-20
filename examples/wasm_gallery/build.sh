#!/bin/bash
# The whole gallery, as one wasm module beside the page that hosts it.
#
# The wasm backend compiles a single source and has no orb loader, so the
# app and every orb it uses are flattened first. Nothing else is needed:
# no bundler, no npm, no framework.
#
#   bash build.sh
#   then serve this directory over http and open index.html
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ORION=$(cd "$HERE/../../../orion" && pwd)
mkdir -p "$HERE/build"
bash "$ORION/tools/bundle_app.sh" "$HERE" "$HERE/build/gallery.or" "$HERE/../../orbs" "$HERE/../../../atlas/orbs"
"$ORION/dist/orion.exe" "$HERE/build/gallery.or" "$HERE/gallery.wasm"
# The very face the layout was measured with, served beside the module.
# A painter drawing in a face nobody measured paints a different program
# however right its rectangles are. Nineteen kilobytes.
cp -f "$ORION/orbs/typeface/assets/Inter-Regular.subset.ttf" "$HERE/"
ls -l "$HERE/gallery.wasm"
