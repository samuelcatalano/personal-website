# Glasgow marked infill — 2026-11-14

Owner authorized buildings/houses only in the three green screenshot outlines. No Astra or subagents used.

## Delivered scope

Seven appended real-coordinate plots reuse existing Glasgow families, finishing, near/far batches, materials and procedural fallback:

- Foreground pocket: four 6×7 m, two-floor terraces at x426/435/444/453, z32 (6.4 m high).
- West approach to George Square: one 6×6 m, two-floor terrace at (441, −22), 6.4 m high. Its shallower footprint preserves the river-bank buffer and pedestrian corridor.
- University east flank: two 8×9 m residential midrises at (486, −84)/(486, −99), three/four floors (9.6/12.8 m high). The footprint leaves 8 m to the university's east wall.

The screenshot explicitly reopens the university's formerly reserved eastern buffer for these two lots only. Tests retain the original reservation for every other plot and enforce at least 6 m for these additions. Other landmarks, paths, parks, roads, trees, props, existing descriptors and RNG order remain fixed. No asset, dependency, material, light or rendering-quality change.

## Verification

- `node --test tests/`: 267 passed. Original lot/tree/prop hashes remain; the previous 27 infill descriptors also have a preservation hash.
- `tests/urban-infill.browser.py` via browser-harness on the local same-origin fixture: passed. All seven additions clear actual curved-route plots, trees, props and pedestrian rectangles; all 34 surveyed infill lots clear road/sidewalk, river and bridge corridors. Near/far source envelopes, finite attributes, shared buckets/materials and fallback construction passed.
- Desktop day/night visual review via browser-harness at 1728×963, DPR2: the three screenshot pockets are occupied; the university front, civic square and statue remain readable. Both captures reported zero JavaScript errors, zero failed shader programs and WebGL error 0. Live descriptors increased from 739 to 746; all 317 botanical trees remain. Local captures: `/tmp/infill-before/11-night.png`, `/tmp/infill-after/11-day.png`, `/tmp/infill-after/11-night.png`.
- `git diff --check`: passed.

No mobile, Lighthouse or frame-time benchmark. Geometry increases with seven lots; no FPS or performance equivalence is claimed.

## Follow-up: camera-side neighbourhood completion

Owner then explicitly authorized completing the lower, normally offscreen side of the Glasgow view. Twenty further plots extend that same neighbourhood, within x385.5–511.5 and z82.5–106.5: two rows at z87/102 with ten buildings each. Ten two-floor terraces (6.4 m) alternate with ten three-floor residential midrises (9.6 m); each footprint is 9×9 m. Four-metre lateral gaps and six-metre space between the rows preserve circulation. The original 34 infill descriptors have a preservation hash, and all original lot/tree/prop hashes still pass. No production camera or renderer change.

Validation after the extension:

- `node --test tests/`: 268 passed.
- Updated `tests/urban-infill.browser.py`: passed for all 54 surveyed lots, including actual-curve clearance and all 27 Glasgow additions against existing lots, trees, props and pedestrian paths. Shared material count remains two in the isolated construction fixture; source near/far envelopes and fallback checks pass.
- Desktop inspection camera `(460,85,140) → (450,0,65)`, FOV53, 1728×963/DPR2: day/night captures reviewed. The added rows continue the existing neighbourhood with clear gaps and varied two/three-floor silhouettes. Both reported zero JavaScript errors, failed shaders and WebGL errors. Live plots: 766 (746 before this extension); all 317 botanical trees retained. Local evidence: `/tmp/glasgow-lower/11-day.png` and `/tmp/glasgow-lower/11-night.png`.
- `git diff --check`: passed.

The extra geometry is intentional. No frame-time comparison, mobile or Lighthouse run for this extension.

## Follow-up: complete the newly outlined west/lower area

The owner supplied a new green/yellow outline (21:38:58), explicitly including the empty west flank and lower edge. Forty-six further plots fill those strips: thirty-six west-side lots and ten along z117. Twenty-six two-floor terraces and twenty three-floor midrises reuse existing Glasgow recipes. No prior plot moves; a preservation hash locks all 54 preceding infill descriptors. Original lot/tree/prop hashes and all park, path, road, river and landmark guards remain.

- West rows: x300/312/325/338/351 at z45/59/73; x300/312/325/338/351/364/377 at z87/101/115. Existing buildings already occupy the other cells in the first three rows.
- Lower edge: x390..507 in 13 m steps, z117. Ordinary footprints are 9×9 m with 4 m lateral gaps. Six narrow 6×7 m terraces at x300 retain over 2 m from the bridge embankment. Only these specifically named lots reopen the old oversized bridge reserve; oriented footprint tests enforce the actual embankment plus 2 m laterally and 3 m at its ends. All other lots retain the old reserve.
- Initial visual review found a remaining west seam because the QA close-up retains the production panel's projection offset. The final extent includes that seam; the production camera/projection remains unchanged.
- `node --test tests/`: 269 passed. The coverage test asserts every outlined row's occupied columns.
- `tests/urban-infill.browser.py`: all 100 surveyed infill lots passed actual curved-route/river/bridge clearance and construction bounds; all 73 Glasgow additions passed existing-building, tree, prop and pedestrian clearances. Materials remain shared; fallback remains available.
- Final desktop daylight review at the same QA close-up and viewport as the owner outline: both previously vacant strips are occupied, apart from circulation/setbacks. Live plots increased from 766 to 812; all 317 botanical trees remain. Capture reported zero JavaScript errors, failed shaders and WebGL errors. Evidence: `/tmp/glasgow-outline-final/11-day.png`. The intermediate 28-lot version was also captured day/night; the final 18-lot seam extension was visually rechecked in daylight only.
- `git diff --check`: passed.

No mobile, Lighthouse or timing benchmark. The geometry increase is intentional; no performance equivalence is claimed.
