# tools/pipeline (dev only, never deployed)

Asset tooling for the Blender -> GLB -> Meshopt -> KTX2 pipeline (`docs/architecture/blender-asset-pipeline.md`, roadmap `docs/plans/3d-asset-pipeline-roadmap.md`). GitHub Pages serves only generated assets; nothing in this folder is imported by the site.

## Install (once)

```bash
cd tools/pipeline && npm install        # @gltf-transform/cli 4.5.1 (pinned), installs into the git-ignored node_modules
```

`toktx` (KTX-Software 4.4.2, Khronos, Apache-2.0) is needed only for KTX2 compression (Phase 2): official signed + notarized macOS installer from
https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2 (`KTX-Software-4.4.2-Darwin-arm64.pkg`, 6.8 MB). It needs an administrator password, run it yourself:

```bash
sudo installer -pkg <path>/KTX-Software-4.4.2-Darwin-arm64.pkg -target /    # then: toktx --version
```

## Commands

```bash
node tools/pipeline/check.mjs            # report bytes/tris/materials/textures per GLB, unreferenced GLBs, budget breaches (budgets.json)
node tools/pipeline/check.mjs --strict   # exit 1 on a breach (future CI)
npx gltf-transform --help                # run from tools/pipeline; check subcommands against this pinned version before scripting
```

`baseline-2026-10-29.txt` is the Phase 0 baseline of the shipped assets.
