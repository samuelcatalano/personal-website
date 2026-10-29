# tools/pipeline (dev only, never deployed)

Asset tooling for the Blender -> GLB -> Meshopt -> KTX2 pipeline (`docs/architecture/blender-asset-pipeline.md`, roadmap `docs/plans/3d-asset-pipeline-roadmap.md`). GitHub Pages serves only generated assets; nothing in this folder is imported by the site.

## Install (once)

```bash
cd tools/pipeline && npm install        # @gltf-transform/cli 4.5.1 (pinned), installs into the git-ignored node_modules
```

`toktx` (KTX-Software 4.4.2, Khronos, Apache-2.0) is used only for KTX2 compression (Phase 2). The official macOS installer (`KTX-Software-4.4.2-Darwin-arm64.pkg`, from https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2, signed + notarized, Developer ID TD2656HYNK) can be run with `sudo installer -pkg <pkg> -target /`. Without admin rights, the same signed binary works from this folder: expand the pkg (`pkgutil --expand-full`) and copy `toktx` to `tools/pipeline/bin/` and `libktx.4.4.2.dylib` (+ symlink `libktx.4.dylib`) to `tools/pipeline/lib/` (both git-ignored; the binary's rpath is `@executable_path/../lib`). Use it as `PATH=tools/pipeline/bin:$PATH`; check with `toktx --version`.

## Commands

```bash
node tools/pipeline/optimise.mjs <in.glb> <out.glb> [ratio] [error]   # weld/dedup/prune/simplify/reorder + Meshopt (no quantization, see header)
node tools/pipeline/check.mjs            # report bytes/tris/materials/textures per GLB, unreferenced GLBs, budget breaches (budgets.json)
node tools/pipeline/check.mjs --strict   # exit 1 on a breach (future CI)
npx gltf-transform --help                # run from tools/pipeline; check subcommands against this pinned version before scripting
```

`baseline-2026-10-29.txt` is the Phase 0 baseline of the shipped assets.
