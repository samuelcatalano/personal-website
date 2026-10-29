# Task 2: Townhouse modular kit runtime integration

## Status

**GO for the approved nine-lot pilot.** `createTownhouseExperiment(plots, neighbors)` remains synchronous and returns the existing group contract. It starts a cached asynchronous GLB load; until all replacement geometries are ready, the procedural LOD0 and LOD1 remain active. A failed load or completion after disposal leaves the procedural geometry in place.

## Implementation

- Read the `TownhouseKit` hierarchy through the existing `loadGlb(url)` loader, cache its 23 module geometries, and read each module's category, anchor, and semantic roles.
- Build LOD0 details from the existing deterministic opening recipes: seven window variants, six entry/storefront variants, five cornice variants, and five roof-detail variants. Fit and orient modules at the existing facade openings, cornice datum, and roof contact point.
- Preserve the wall shell and opening reveals while removing overlapping procedural window, door, frame, glass, and top-cornice pieces from the modular LOD0 build. Merge authored roles into the existing mass, trim, and glass buffers; there are still three active renderables per pilot chunk.
- Keep LOD1 procedural and keep its geometry, the existing AABB 120/129/111 m hysteresis, deterministic recipes, `userData.update(camera)`, and idempotent disposal. Recalculate the chunk bounds after LOD0 replacement so module extents participate in distance checks.
- Keep the three-lot `block-827--54` control unchanged. No triangle gate, dependency, build step, or absolute asset URL was added.

## Files changed

- `js/world/building-slice.js`
- `tests/building-slice.browser.py`

## Validation

Desktop Chrome browser checks passed:

- `browser-harness < tests/building-slice.browser.py` — pass. Covers module adoption in all three buckets, failed-load fallback, late completion after disposal, shuffled-input determinism, grounded bounds, both LOD states, and the unchanged three-lot control. Pilot bounds: min `[679.2709, 0, -84.48]`, max `[735.6028, 11.6383, -75.52]`.
- `browser-harness < tests/building-kit.browser.py` — pass. Existing archetype bounds, shared resources, and instancing assertions remain green.
- `node --check js/world/building-slice.js` — pass.
- `python3 -m py_compile tests/building-slice.browser.py` — pass.
- `git diff --check` — pass.

## Scope and limits

Only the nine named pilot lots adopt the kit. Mobile, deployment, citywide expansion, visual capture, and performance benchmarking were not run; none were requested for this milestone. The success and fallback paths were exercised in the browser suites, with the procedural geometry retained as the load-failure path.
