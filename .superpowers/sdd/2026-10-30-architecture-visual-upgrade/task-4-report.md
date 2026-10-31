# Task 4 — Citywide architectural variety and integration

## Implementation

- `js/world/city-rollout.js` now selects twelve deterministic visual archetypes across the five existing structural families: three townhouse, two shop, two midrise, two office and three tower variants. Stable plot IDs plus regional salts drive the variants and regional palettes for São Paulo, London, countryside and Glasgow.
- The geometry choices feed the existing family builders and preserve the three mass/trim/glass batches. `heroShopRecipe()` accepts an optional composition index; existing callers keep their hash/position selection, while rollout plots select from two stable shop archetypes.
- No classification, lot descriptor, footprint, height, map, route, position, LOD, culling, or shared-material contract changed.
- Added `tests/architecture-archetypes.browser.py` to exercise every classified current plot and assert the twelve distinct geometry signatures, all four regions, deterministic output, and unmodified source descriptors.

## Validation

- Desktop browser: `architecture-archetypes.browser.py` passed; reports exactly 12 archetypes and all four regions.
- `citywide.browser.py` passed: 628 converted lots, 183 chunks, 549 active architecture renderables, 781,928 triangles, 142.35 MiB geometry attributes, two shared materials and four maps. Bounds, culling/resource sharing, descriptors, determinism, disposal and preserved controls passed.
- Family browser suites passed: `building-slice`, `shop-slice`, `midrise-slice`, `office-slice`, `tower-slice`, `hirise-kit`, `building-kit`, and `townhouse-lod`.
- Node suites passed: `houses.test.mjs` (1), `glasgow.test.mjs` (4), and the combined house/backdrop/diversity run (7); `backdrop.test.mjs` plus `diversity-backdrop.test.mjs` separately passed (6).
- Desktop runtime smoke through dev-browser at `http://localhost:8000/?weather=clear`: page title loaded and zero console/page errors were observed after 10 seconds.
- One consolidated capture pass produced and visually inspected six desktop views: stops 5, 9.5 and 11, day and night, at `/tmp/architecture-final/`.
- Independent GPT-6 Luna High review: accepted, no actionable findings.
- No mobile validation or full Node suite was run.

## Performance and limits

The current measurements are workload evidence, not a universal FPS guarantee. The latest documented 2026-10-29 citywide result (794,730 triangles / 144 MiB) is not a same-commit baseline; no whole-scene delta is attributed to this implementation. Blender kit additions measured separately at +896 triangles (+6.1%) and +96,000 bytes total; material and module counts stayed the same. Frame time and physical-GPU performance were not measured.

Visual evidence is full-scene scale. Individual facade close-ups, rain variants, mobile and physical-device rendering were not checked. Captures are temporary local artifacts and are not committed.
