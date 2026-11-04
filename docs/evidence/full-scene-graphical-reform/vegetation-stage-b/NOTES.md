# Vegetation Stage B: verdict and evidence

## Verdict: not clearly better than committed 3b9a469. Not committed.

- Near range (20 m and 60 m, the view along the route): not better. The final species are brighter but cooler and paler. The lilac and cream Realistic Tree variants are gone. The ipe crowns are open and airy with no visible blossom. The owner's reading ("worse") matches this range.
- Far range (150 m, LOD1): better. The committed LOD1 is a sliver at 150 m (626 tree pixels, against 5,834 for its own LOD2). This is the known Stage A density pop. The final LOD1 holds 7,365 to 8,261 pixels, so the LOD1 to LOD2 step is much smaller.
- Night: the final silhouettes are brighter at 20 m (luminance 29 to 32, against 19 committed). This follows from the lighter foliage and is not a clear improvement.
- Mixed result, so the verdict is not clearly better at the scale the owner walks. Nothing is committed. The uncommitted working tree still holds the species runtime (`js/world/authored-trees.js`, `js/world/trees.js`, `assets/processed/vegetation/*`, docs). A local server on the working tree shows that state. To restore the committed look: `git restore js/world/authored-trees.js js/world/trees.js assets/processed/vegetation/manifest.json assets/processed/vegetation/tree-impostors.png`. That is the owner's call.

## Same camera, committed 3b9a469 against the final slice

Fixed camera 20, 60 and 150 m from the tree row (`tools/vegetation/lod_sweep.py`, forced LODs). Grids in this folder: `compare-<region>-<theme>.jpg`. Rows: 20 m LOD0, 60 m LOD0, 150 m LOD1, 150 m LOD2. Columns: committed (left), final (right). `lum` = mean luminance of tree pixels; `px` = pixels with alpha above 127.

| Build | Theme | LOD0 20 m | LOD0 60 m | LOD1 150 m | LOD2 150 m | px LOD1 150 | px LOD2 150 |
|---|---|---|---|---|---|---|---|
| committed 3b9a469 | day | 64.18 | 62.09 | 46.31 | 66.55 | 626 | 5,834 |
| committed 3b9a469 | night | 19.41 | 19.68 | 12.62 | 18.84 | 626 | 5,834 |
| final, sp (ipe) | day | 76.00 | 79.15 | 77.73 | 94.98 | 7,365 | 5,297 |
| final, sp (ipe) | night | 29.33 | 30.39 | 28.46 | 29.73 | 7,365 | 5,297 |
| final, london (plane) | day | 82.78 | 83.38 | 82.91 | 93.40 | 8,261 | 7,081 |
| final, london (plane) | night | 32.41 | 32.49 | 31.57 | 30.79 | 8,261 | 7,081 |
| final, country (pine) | day | 76.69 | 78.82 | 79.17 | 83.45 | 7,776 | 7,014 |
| final, country (pine) | night | 29.40 | 30.24 | 29.85 | 28.37 | 7,776 | 7,014 |

No console errors in any run. Raw metrics: `metrics/`.

## Consistency: manifest, loader, LODs, impostor atlas (checked 2026-11-04, final slice)

- Loader `SOURCES` order is plane, ipe, pine. The manifest order matches, and so does the atlas tile order (384x128 = three 128 px tiles).
- Manifest `aspect` matches the loader `ASPECT` constants (plane 0.84, ipe 1.08, pine 0.52).
- Each GLB holds `<species>-LOD0` and `<species>-LOD1`. Manifest triangle counts and byte sizes match the files (LOD0 5,196 / 5,760 / 5,096; LOD1 1,592 / 1,720 / 1,532; 231,716 / 251,160 / 237,564 B; atlas 35,427 B; total 755,867 B).
- `tests/authored-trees.browser.py` checks per-tile UV coverage, the per-tile foot height and the region mix. It passes.

## Checks

- `node --test tests/`: 146 pass, 0 fail (final working tree).
- Browser suites `authored-trees`, `trees`, `plantings`, `final-art`: all pass on the final slice over `d193aa9` (`:8021`, run twice) and over `3b9a469` (`:8031`, the commit base).
- Captures: `regions-committed-grid.jpg` (3b9a469, stops 5, 9.5 and 11, day and night) and `regions-after-grid.jpg` (final slice).

## Remaining issues (not done, owner decision needed)

1. Near-range look: restore some of the lilac and cream variety, bring the greens back toward the committed depth, and give the ipe a denser crown with a visible blossom read. Then rerun the 20 and 60 m grids.
2. At 14 m the crowns read as square cards with faceted edges. A finer leaf atlas or alpha-to-coverage would help. Not done.
3. LOD2 reads brighter than shadowed LOD0 and LOD1 inside the sun shadow box. The shadow policy is unchanged.
4. Not checked: mobile 375 px, WebGL off, reduced motion, rain, GPU frame time, draw calls and memory. Software GL only.
5. `realistic-tree.glb` (905,592 B) is still hosted by Pages. The owner decides whether to delete it or add the CC-BY attribution.
6. Docs `asset-quality-spec.md`, `rendering-budget.md` and `ASSET_SOURCES.md` describe the species refresh with the real final numbers. They are uncommitted, along with the runtime, and should be kept or reverted together with it.
