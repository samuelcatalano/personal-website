# Authored vegetation pipeline

Prepare the supplied tree model that renders with an intact, full crown and regenerate the processed runtime assets:

```sh
tools/vegetation/build_trees.sh /path/to/source-glbs
```

The input directory must contain `realistic_tree.glb`. The supplied Mighty Oak and Tree GN assets are excluded: after conversion and desktop review, their crowns still read as sparse, fragmented foliage at game scale. Blender normalizes the retained tree, caps source maps at 512 px for the game's viewing scale, creates a detailed and reduced mesh LOD, and renders a 128 px impostor atlas. The pipeline compresses color/packed material maps with ETC1S, normal maps with UASTC, then runs the existing Meshopt optimizer last. Output is written to `assets/processed/vegetation/`.

Runtime variants are assigned deterministically by each existing tree's world position. Existing positions, footprints, 160 m chunks, LOD distances and impostor fallback behavior remain the same. See `ASSET_SOURCES.md` for asset authors and CC-BY-4.0 attribution.
