# Architecture visual upgrade plan

## Objective

Reopen the visual freeze only for buildings and houses. Improve every architectural family in São Paulo, London, Glasgow, and the visible background while preserving lot descriptors, footprints, heights, routes, landmark identity and sightlines. Use a hybrid approach: improve shared procedural recipes/materials and use the existing Blender modular kits where depth or silhouette needs real geometry. Prioritize visible quality, then optimize with measured evidence; do not invent a hard triangle ceiling.

## Global Constraints

- Keep lot descriptors as source of truth; do not change map, lot positions/footprints/heights, routes, paths, vehicle/pedestrian behavior, trees/props, global lighting, or non-architectural systems.
- Preserve deterministic variation, shared material/geometry reuse, current spatial batching, and existing LOD/culling semantics unless measured evidence proves an in-scope visual blocker.
- Preserve landmark anchors, scale, recognizable silhouette and sightlines; building facades/details may improve.
- No site dependencies/build step, no push/deploy, no mobile work. Preserve working-tree changes; never use destructive git cleanup/reset/restore/stash.
- Validate only desktop. Use one consolidated visual pass after integration; test targeted suites for changed code/assets.

## Task 1: Standalone regional houses

Improve the legacy house generator without changing lot generation or its call interface: `js/world/houses.js`. Inspect callers in `blocks.js`, `country.js`, `glasgow.js` and `city.js`; do not edit those layout/caller files. Update relevant assertions in `tests/houses.test.mjs` and run `tests/glasgow.test.mjs` if regional geometry changes.

## Task 2: Blender modular building kits

Improve the existing five kit sources and regenerate their processed GLBs: `tools/buildings/{townhouse,shop,midrise,office,tower}-kit/` and `assets/processed/buildings/*.glb`. Preserve runtime module names/categories/anchors and semantic material roles. Do not edit runtime JS or other tasks' files. Validate with existing GLB/pipeline checks plus `tests/building-kit.browser.py` and `tests/townhouse-lod.browser.py`; report geometry/material/byte deltas, with no invented triangle cap.

## Task 3: Backdrop and architectural landmarks

Improve visible building masses and building-like landmark architecture while preserving envelopes, anchors, identity and protected sightlines: `js/world/backdrop.js`, `js/world/landmark-geometry.js`, `js/world/landmark-materials.js`, `js/world/landmarks.js`, and only the existing Big Ben authoring source/output if needed. Restrict geometry edits to building forms (Big Ben/Parliament, Copan, MASP, Sé, Riverside, University, Wembley and any other building-like landmark found in source); do not alter London Eye, bridges, boats, statue, or landmark transforms. Cover with `tests/backdrop.test.mjs`, `tests/diversity-backdrop.test.mjs`, `tests/landmark-geometry.browser.py`, and `tests/landmarks.browser.py`. Do not edit shared ordinary-building materials or family modules.

## Task 4: Citywide building families and integration

Audit current lot classification/coverage, then improve shared procedural recipes/materials and family runtime paths: `js/world/city-rollout.js`, `building-kit.js`, `building-slice-materials.js`, `building-slice.js`, `shop-slice.js`, `midrise-slice.js`, `office-slice.js`, `tower-slice.js`, `kit-loader.js`, `kit-place.js`, and required tests (`tests/citywide.browser.py`, `tests/diversity.browser.py`, `tests/building-slice.browser.py`, `tests/shop-slice.browser.py`, `tests/midrise-slice.browser.py`, `tests/office-slice.browser.py`, `tests/tower-slice.browser.py`, `tests/hirise-kit.browser.py`). Cover townhouse/terrace, shops/mixed low-rise, midrises/tenements, offices and towers, including preserved/control and special plots. Keep integration compatible with existing authored kits.

## Validation and integration

- Primary agent inventories descriptors/current coverage and reviews each subagent diff before integration.
- Run each changed family’s targeted Node/browser suite; run the full Node suite only if a concrete failure or cross-family integration risk requires it.
- Validate regenerated GLBs with existing project tools and preserve loader fallbacks.
- Run one browser-harness desktop capture round across stops 5, 9.5 and 11, day/night, near/far architectural views. Check console errors, z-fighting, bounds, blocked paths/sightlines and LOD switches where changed. No mobile tests/captures/reviews.
- Compare performance only where measured before/after data is directly attributable; report software-GL/headless limitations and avoid claiming universal FPS.
- No deployment or push. Each subagent may commit only its owned files after its focused checks pass; the primary agent owns integration and commits integration changes only after related checks pass.

## Completion contract

Report actual covered families/regions and any preserved exceptions, files/assets changed, targeted tests and desktop captures with results, available performance deltas/limitations, and unresolved issues. Do not claim a family complete without code/asset coverage and visual evidence.
