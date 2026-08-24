# Changelog

Notable changes to veil. Format follows [Keep a Changelog](https://keepachangelog.com/),
versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-08-24

First public release. A document of named nodes, a theme that says how a role
is drawn, and a display list out the other end. Three painters run the same
document: a native window, one WebGL draw call in a tab, and JSON over HTTP.

### Added
- **veil builds standalone.** Every dependency on the orion checkout was a
  relative path (`path:../orion/orbs/text`), so a clone only built as a
  sibling. They name the toolchain orbs now, and a clone anywhere builds
  against an installed orion.
- **`orbs/veil_page` has an `Orbit.toml`**, like every other orb. It was the
  one that could not declare what it uses.
- **CI.** `green.yml` bootstraps orion from its committed seed and runs
  `tools/gates.sh` on Linux and Windows. Manual only: a push does not need a
  runner to repeat what the gates already said.
- Apache 2.0, and a NOTICE that names the bundled Inter subset and its licence.

### Fixed
- **A checkout rewrote every file to CRLF.** There was no `.gitattributes`;
  the same conversion once poisoned the editor through the lexer.

### Removed
- **`examples/wasm_gallery/gallery.wasm`**, 244 kB of build output, was
  committed. `build.sh` makes it.
- `examples/web_demo/timing.txt`, two lines naming a localhost port.

[0.1.0]: https://github.com/Lone-Lodge/veil/releases/tag/v0.1.0
