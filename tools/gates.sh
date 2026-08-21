#!/bin/bash
# Veil's one command: the check suite, then the wasm target, green or red.
#
# The wasm half is here because it rotted once: the backend fell behind the
# native one for a whole `number` migration and nothing noticed, because
# nothing built it. A framework that says it runs in a tab has to build for
# a tab every time.
set -e
cd "$(dirname "$0")/.."
orbit build >/dev/null
./build/veil_cli.exe

echo
echo "== usable from the outside =="
# The README's smallest app, built against veil the way an app would: its
# Orbit.toml names the orbs it needs and nothing else. If that list has to
# grow, or a helper an app needs goes private, this stops compiling before
# an app finds out.
( cd gates/smallest && orbit build >/dev/null && ./build/veil-smallest_cli.exe | sed 's/^/  /' )

echo
echo "== wasm =="
bash examples/wasm_gallery/build.sh >/dev/null
node -e '
const fs = require("fs");
const wasm = "examples/wasm_gallery/gallery.wasm";
const bytes = fs.readFileSync(wasm);
WebAssembly.compile(bytes).then((m) => {
  // Every import the module asks for has to be one the page actually
  // supplies, or it loads in a test and dies in a browser.
  const page = fs.readFileSync("examples/wasm_gallery/index.html", "utf8");
  const missing = WebAssembly.Module.imports(m)
    .filter((i) => i.kind === "function")
    .map((i) => i.name)
    .filter((n) => !page.includes(n + ":") && !page.includes('"' + n + '"'));
  if (missing.length) {
    console.log("  FEL: sidan saknar " + missing.join(", "));
    process.exit(1);
  }
  console.log("  ok   modulen validerar, " + Math.round(bytes.length / 1024) + " kB, "
            + WebAssembly.Module.imports(m).length + " importer, alla besvarade");
}).catch((e) => { console.log("  FEL: " + e.message); process.exit(1); });
'
