# Owner-cropped remaining gaps — 2026-11-14

## Scope and placement

The owner supplied five unique crops (22:32:12–22:33:24), showing the western and eastern outer edges plus the spaces beyond the two Glasgow bridge approaches. The repeated attachments are the same five areas. The inner crops were matched to the full aerial contact sheet: the smaller eastern pocket is near world (537,70), and the other inner views show the western approach near x288.

147 appended plots reuse existing regional architecture: 97 two-floor terraces and 50 three-floor midrises, all 9×9 m and no higher than 9.6 m.

- São Paulo west edge: 77 lots, seven columns x−531..−453 and eleven rows z−23..115.
- Final/eastern edge: 56 lots, eight columns x924..1015 and seven rows z32..115.
- Post-bridge pockets: 14 lots, seven beside/after each bridge, at x275/288 and x520/533/546, z45..87. Existing buildings and one tree continue to occupy the other candidate cells.

The old bridge reserve used 18 m along the main route and 80 m across it, leaving space beyond the actual embankment. Only the specifically named new `gaps-core-*` lots reopen that reserve. Oriented footprint checks enforce the actual shared `UNDERPASS.base`/`UNDERPASS.end`, plus 2 m laterally and 3 m at the ends; the bridge entrances and footpaths remain open. Every other infill lot retains its existing guard. The initial side-house exception remains unchanged.

A new preservation hash locks all previous 479 infill descriptors. Original lot/tree/prop hashes, walking areas, parks, landmark fronts, source envelopes and route clearances remain. No road, bridge, tree, pedestrian route, material, light, asset, renderer or production camera changes. No Astra or subagents used.

## Checks and evidence

- `node --test tests/`: 271 passed, including the five crop areas' row/column coverage and prior-descriptor preservation.
- `tests/urban-infill.browser.py`: passed. All 626 surveyed plots clear the actual curved route, river and bridge footprints. All 599 Glasgow/district/gap additions clear existing plots, trees, props and pedestrian areas. Near/far envelopes, finite attributes, shared buckets/materials, fallback and disposal pass.
- Final desktop review: passed for the panorama, four regional aerials and both bridge close-ups at 2400×1400/DPR1.5. The final QA probe reports 1,338 retained architecture descriptors and zero JavaScript errors, failed shaders and WebGL errors. New rows occupy both requested outer strips; close-ups show the post-bridge pockets populated while the approach ends and circulation remain clear. The bridge traffic source still turns/recycles within `END−2`, before these new plots. Temporary fog/view-offset changes exist only in the inspection tab, which was closed.
- Local captures: `/tmp/gaps-after/`. Durable session artifacts: `remaining-gaps/areas-preenchidas.jpg`, the full regional images and both bridge close-ups.
- `git diff --check`: passed.

## Cost and limits

The isolated procedural `kits:false` infill fixture grows from 479 to 626 lots, 127 to 153 chunks, 2,973,400 to 3,769,786 accumulated near triangles and 85.51 to 106.83 MiB initial far-attribute arrays. Two shared materials remain. These are geometry/CPU-array costs, not a full-frame timing, physical-VRAM measurement or authored-kit count. Existing quality settings and LOD thresholds stay fixed.

No mobile, Lighthouse, timing benchmark or repeat of the full product matrix. The geometry increase is intentional; no FPS/performance-equivalence claim.
