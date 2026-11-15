# Four-region neighbourhood completion — 2026-11-14

## Authorization and scope

The owner approved completing the gaps identified in the whole-scene aerial survey: São Paulo west/foreground, London foreground/transition, both sides of the expanded Glasgow neighbourhood, and the final/return foreground. This is a bounded extension of existing blocks, not population of the unlimited ground skirt. No Astra or subagents were used.

`urban-infill.js` appends 379 explicit surveyed real-coordinate plots after the previous 100, retaining their RNG sequence and descriptors. Placement was checked offline against both the real Three.js route and the existing linear Node fixture. No runtime placement/rejection algorithm or new dependency is introduced.

| District | New plots | Centre bounds x | Centre bounds z |
| --- | ---: | --- | --- |
| São Paulo | 165 | −440..−37 | −23..115 |
| London / transition | 69 | 1..248 | 32..115 |
| Glasgow flanks | 56 | 261..638 | 32..115 |
| Final / return | 89 | 651..911 | 32..115 |

There are 225 two-floor terraces, 113 three-floor midrises, twenty four-floor and twenty-one five-floor midrises. Fifteen of the São Paulo additions complete its west-side connection at z−23..19; the others extend bounded foreground rows at z32..115. Ordinary footprints are 9×9 m. The 41 larger 10×10 m plots sit only at z101/115, behind the usual viewing position; their height is capped at 16 m. All other new plots remain at or below 9.6 m. Existing regional families, facade finishing, near/far batching, materials, kits and fallback are reused.

No existing lot, tree, street, river, park, pedestrian route, landmark or production camera moves. The previous 100 infill descriptors have an additional preservation hash; original lot/tree/prop hashes remain. Road, skyline, public-space, reserved-anchor, river and bridge guards remain. The height guard permits 16 m only for the newly authorized district IDs in the two far rows; old lots retain their old ceiling.

## Verification

- `node --test tests/`: 270 passed, including district coverage, source-envelope, preload and preservation checks.
- `tests/urban-infill.browser.py` through browser-harness: passed. All 479 surveyed infill plots clear the actual route, river and bridges; all 452 additions from the current Glasgow/district work clear existing plots, trees, props and walking areas. Finite attributes, source envelopes, shared chunk buckets, two materials and fallback construction pass.
- Desktop aerial review: passed for the complete panorama and all four regions at 2400×1400/DPR1.5, using the same inspection cameras as the pre-change survey. Temporary fog removal/view-offset clearing applied only to the QA tab. The final scene reports 1,191 retained architecture descriptors (812 before), zero JavaScript errors, failed shader programs and WebGL errors. Evidence: `/tmp/district-after/`; durable images under the session visualization folder `district-completion/`.
- Normal-view São Paulo stop5 day/night review: passed at 1728×963/DPR2, with normal camera, fog and production render settings. Both captures report 1,191 plots, all 317 botanical trees and zero JavaScript/shader/WebGL errors. Evidence: `/tmp/district-normal/5-day.png` and `/tmp/district-normal/5-night.png`.
- `git diff --check`: passed.

## Geometry cost and limits

The isolated infill fixture uses `kits:false`; it is not a full-frame timing or physical-VRAM measurement. Previous 100 / current 479 plots respectively: 38 / 127 chunks; 593,322 / 2,973,400 accumulated near triangles; 17.41 / 85.51 MiB of initial shared far-attribute arrays. Actual authored-kit geometry and submitted multipass triangles differ. No quality setting, asset resolution, renderer, material, light or LOD threshold was reduced.

No mobile, Lighthouse, timing benchmark or full product-matrix run. The increased geometry is intentional; no FPS/performance-equivalence claim.
