#!/bin/bash
# Veil's one command: build + the 30-check suite, green or red.
set -e
cd "$(dirname "$0")/.."
orbit build >/dev/null
./build/veil_cli.exe
