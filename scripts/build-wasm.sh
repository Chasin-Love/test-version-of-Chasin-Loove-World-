#!/usr/bin/env bash
# Builds the C++ simulation core to WebAssembly (src/native/wasm/).
# Requires emsdk: https://emscripten.org/docs/getting_started/downloads.html
#
#   source ~/emsdk/emsdk_env.sh && bash scripts/build-wasm.sh
#
# The bridge (src/native/cpp_bridge.ts) detects ./wasm/cosmos_engine.js at
# runtime and uses it automatically; without it the TypeScript reference
# implementation serves. CI builds this artifact when emsdk is configured.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/src/native/wasm"
SRC="$ROOT/src/native"

mkdir -p "$OUT"

emcmake cmake -B "$SRC/build-wasm" -S "$SRC" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_CXX_FLAGS="-O3 -ffast-math -msimd128" \
  || { echo "emcmake failed — is emsdk active?"; exit 1; }

cmake --build "$SRC/build-wasm" -j "$(nproc 2>/dev/null || echo 4)"

# Produce the Emscripten module the bridge expects (glue JS + .wasm)
em++ "$SRC/cosmos_engine.cpp" \
  -O3 -ffast-math -msimd128 \
  -std=c++20 \
  --bind -s MODULARIZE=1 -s EXPORT_NAME=cosmos_engine \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s ENVIRONMENT=web,worker \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -o "$OUT/cosmos_engine.js"

echo "wasm module written to $OUT/cosmos_engine.js"
