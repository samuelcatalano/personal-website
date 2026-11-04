# Vegetation Stage A (Task 4): LOD2 impostor fixes, evidence

Scope: authored Realistic Tree impostors (LOD2), leaf alpha and normal maps. No species, grass or wind changes. Before = `git archive HEAD` (e9225d4) on :8001. After = commit 08a329c, clean `git archive` export on :8003 (sweep metrics identical to the working tree on :8000).

## Fixes (failing check first)

| # | HEAD defect | Check that failed first | Result after |
|---|---|---|---|
| 1 | Impostor UV samples atlas columns 0.4-25.2; crown spans 16-111 | authored suite: "impostor samples columns 0.4-25.2 but the crown spans 16-111" | pass |
| 2 | Cards keep random yaw (max 179.7 deg off camera); NaN guard | trees suite (procedural) and authored facing: "misses the camera by more than 5 degrees" | pass |
| 3 | Trunk foot 0.082 x tree height above base (lowest opaque atlas row 118 of 127) | authored foot check: 0.434 m above base on a 5.32 m tree | pass: row 127, foot within 0.02 x H |
| 4 | Atlas holds baked sun and green world light; runtime lights it again | single-tree render, LOD2/LOD1 brightness: flat 0.87 (UV fixed, old atlas), 1.26 (first bake, test failed); runtime-like 0.75 (old atlas), 1.09 (first bake) | final: flat 1.07, runtime-like 0.96 (both within +/-15%) |
| 5 | Leaves export BLEND; leaves cut at 0.4, impostor at 0.3 | node: alphaMode BLEND (expected MASK); authored: impostor 0.3 vs leaves 0.4 | MASK 0.42; impostor 0.42 |
| 6 | Normal maps stay PNG: `--slots "{normal}*"` matches nothing | node: image/png (expected image/ktx2) | KTX2 via `normal*` |

Node tests: `tests/tree-assets.test.mjs` (3 tests). Browser checks: `tests/authored-trees.browser.py`, `tests/trees.browser.py`.

## Payload (geometry and texture bytes, separate from draw workload)

- realistic-tree.glb: 1,222,136 -> 905,592 B (-316,544 B, -25.9%); normal maps now KTX2.
- tree-impostors.png: 21,490 -> 20,594 B (128 px, one tile, unchanged size).
- Authored total: 1,243,626 -> 926,186 B (-25.5%).

## Draw workload (unchanged by construction)

Same 10 chunks, 200 placements, LOD thresholds, instance counts and triangles per instance (4,200 / 1,100 / 4 per LOD2 card). New cost: LOD2 batches now rewrite their card matrices when the camera moves more than 0.25 m (previously never ran), CPU only.

## Measurements (`tools/vegetation/lod_sweep.py`, same 36 trees, camera and light before/after)

Silhouette pixels (alpha > 0.5) of the tree row, forced LOD per distance:

| Distance | HEAD | After |
|---|---|---|
| 160 m LOD0 / LOD1 / LOD2 | 698 / 534 / 938 | 698 / 534 / 5,112 |
| 80 m LOD0 | 12,653 | 9,830 (binary alpha clip removes soft fringe, -22%) |
| LOD1 (160 m) -> LOD2 (164 m) step | x1.76 (card was a sliver) | x13.1 |

Single tree at 14 m (after): LOD0 3,118 px, LOD1 1,595, LOD2 3,485. The corrected card matches LOD0 coverage; LOD1 is about half of LOD0 (card count x0.48, aliased MASK edges).

LOD levels change only at thresholds, once per crossing, no oscillation (approach: 140 m -> L1, 60 m -> L0; leave: 84 m -> L1, 164 m -> L2). Console errors: none.

## Remaining issues (not fixed here)

1. LOD1 -> LOD2 density pop at 156-164 m: the full-crown impostor is about 13x the LOD1 silhouette. Likely cause: LOD1 density and alias at range. Untested fixes: LOD1 card density or alpha-to-coverage. See `boundary-1to2-*.jpg`.
2. LOD0 -> LOD1 pop at 76-84 m (silhouette x0.47): LOD1 is unchanged by this stage. See `boundary-0to1-*.jpg`.
3. Mobile 375 px, WebGL-off and reduced-motion were not rendered for this stage; no DOM or fallback path changed.
4. `docs/architecture/rendering-budget.md:285-287` and `ASSET_SOURCES.md` still quote 1,243,626 B. Not edited (evidence slice).

## Checks run

- `node --test tests/`: 143 pass, 0 fail.
- `tests/authored-trees.browser.py`, `tests/trees.browser.py`, `tests/plantings.browser.py`, `tests/final-art.browser.py`: all pass.
- Region captures (`tools/capture.py`, stops 5 Sao Paulo, 9.5 London, 11 Glasgow, day and night): `regions-before-grid.jpg`, `regions-after-grid.jpg`, single frames in `regions-before/` and `regions-after/`. The after set is from the clean export of 08a329c. An earlier after capture on the working tree was discarded because it loaded another agent's uncommitted scene/post/landmark changes.

## Files

- `metrics-{before,after}-{day,night}.json`: every sweep step (distance, LOD, pixels, luminance).
- `boundary-1to2-{day,night}.jpg`, `boundary-0to1-{day,night}.jpg`, `lod0-80m-day-before-top-after-bottom.jpg`.
- Full PNG frame sets (about 96 MB) kept out of git. Regenerate: `OUT=<dir> THEME=day URL=http://localhost:8000/ browser-harness < tools/vegetation/lod_sweep.py`.
- Method: the shared browser daemon switched targets during the run, so captures used a dedicated headless Chrome (`BU_NAME=vegstageA BU_CDP_URL=...`). A port clash on :8002 with another agent's server was caught by checking the serving PID and cwd; those captures were discarded.
