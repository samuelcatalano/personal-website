#!/usr/bin/env bash
# Raw landmark GLB -> production GLB: KTX2 textures first (ETC1S: colour/emissive q160, packed ORM q200), then weld/dedup/prune/reorder/Meshopt last
# (the CLI rewrites a file without Meshopt unless the encoder is registered, so optimise.mjs must be the final writer).
# Usage: landmark.sh <in.glb> <out.glb>. Needs the `ktx` CLI on PATH: gltf-transform 4.x shells out to `ktx` (KTX-Software 4.4.2; copy `ktx` + `toktx`
# to tools/pipeline/bin and libktx to tools/pipeline/lib, see README). Slot globs need braces, e.g. "{baseColor,emissive}*" (a plain "baseColorTexture" matches nothing).
# Use UASTC (--level 2 --rdo) instead of ETC1S for normal maps; none in the Big Ben set.
set -euo pipefail
cd "$(dirname "$0")"; export PATH="$PWD/bin:$PATH"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
npx gltf-transform etc1s "$1" "$tmp/a.glb" --slots "{baseColor,emissive}*" --quality 160 --mipmaps true >/dev/null
npx gltf-transform etc1s "$tmp/a.glb" "$tmp/b.glb" --slots "{occlusion,metallicRoughness}*" --quality 200 --mipmaps true >/dev/null
node optimise.mjs "$tmp/b.glb" "$2" >/dev/null
ls -l "$2" | awk '{printf "%s %.0f KB\n", $9, $5/1024}'
