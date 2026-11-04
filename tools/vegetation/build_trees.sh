#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "$0")" && pwd)
repo_root=$(cd "$script_dir/../.." && pwd)
source_dir=${1:?Usage: build_trees.sh <directory-containing-source-glbs> [output-directory]}
out_dir=${2:-"$repo_root/assets/processed/vegetation"}
blender=${BLENDER:-/opt/homebrew/bin/blender}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out_dir"

"$blender" -b --factory-startup --python "$script_dir/build_trees.py" -- "$source_dir" "$tmp/raw" "$out_dir" >"$tmp/blender.log" 2>&1 || { cat "$tmp/blender.log"; exit 1; }
grep '^EXPORTED\|^MANIFEST' "$tmp/blender.log"

cd "$repo_root/tools/pipeline"
export PATH="$PWD/bin:$PATH"
for slug in realistic-tree; do
  npx gltf-transform etc1s "$tmp/raw/$slug.raw.glb" "$tmp/$slug-color.glb" --slots "{baseColor,emissive}*" --quality 180 --mipmaps true >/dev/null
  npx gltf-transform etc1s "$tmp/$slug-color.glb" "$tmp/$slug-orm.glb" --slots "{occlusion,metallicRoughness,specularColor,specularIntensity}*" --quality 200 --mipmaps true >/dev/null
  npx gltf-transform uastc "$tmp/$slug-orm.glb" "$tmp/$slug-normal.glb" --slots "normal*" --level 2 --rdo --rdo-lambda .5 --mipmaps true >/dev/null
  node optimise.mjs "$tmp/$slug-normal.glb" "$out_dir/$slug.glb" >/dev/null
done
rm -f "$out_dir/mighty-oak.glb" "$out_dir/tree-gn.glb"
cp "$tmp/raw/build-manifest.json" "$out_dir/manifest.json"
python3 - "$out_dir" <<'PY'
import json, os, sys
root = sys.argv[1]
path = os.path.join(root, 'manifest.json')
with open(path) as f:
    manifest = json.load(f)
manifest['assets'] = {
    name: {'bytes': os.path.getsize(os.path.join(root, name))}
    for name in ('realistic-tree.glb', 'tree-impostors.png')
}
with open(path, 'w') as f:
    json.dump(manifest, f, indent=2)
    f.write('\n')
PY
du -h "$out_dir"/*.glb "$out_dir"/tree-impostors.png
