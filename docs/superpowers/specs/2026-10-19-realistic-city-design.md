# Realistic City Scene — Design (draft, 2026-10-19)

## Problem and goal

The portfolio's surrounding city still reads as Minecraft/Lego because most buildings and street surfaces are built from repeated cuboids. Make ordinary buildings and streets feel like a more realistic 3D city while preserving the scroll-driven career journey, its landmarks, and the established stylized red bus and pedestrians.

This supersedes the 2026-10-15 visual-fidelity decision only for generic city buildings and streets; landmarks, bus, and people retain their current styles.

The scene remains decorative: the HTML panel is still the source of truth and must work without WebGL or with reduced motion. No new user-facing copy is needed.

## Approved scope and constraints

- Modernize generic buildings and street details; keep the bus and people stylized.
- Keep every landmark recognizable and unobstructed. Preserve roads, walking routes, plazas, and the existing scroll route.
- Keep the Three.js version pinned, use vanilla ES modules, relative asset URLs, no npm/build step, and prefer CC0 assets.
- Test only a few assets in one representative generic urban block first. Expand to other generic blocks only if the pilot meets the quality and performance checks below.
- Do not alter landmark models as part of this work.

## Approach

Use a small hybrid scene: a few locally hosted CC0 GLTF buildings provide more varied silhouettes and facades; procedural buildings fill the other blocks and reuse the same visual language. Build road details with existing Three.js primitives and geometry helpers. This avoids replacing the full renderer or adding a second graphics stack, and allows the asset trial to be removed if it costs too much or looks inconsistent.

Use the existing `three/addons/` import-map entry for Three.js's `GLTFLoader`; this adds no package dependency or build step. Keep model files in the repository and record their source and CC0 status alongside them. Prefer reusable geometry/materials and shared instances. If an asset fails to load, build the existing procedural form at that plot so the scene still starts.

## Scene design

### Buildings

Start with one generic block that is outside all landmark footprints, camera foregrounds, and pedestrian routes. Replace the procedural buildings inside that plot rather than layering models over existing geometry. The block should include a small mix of a brick or stone mid-rise, a terrace or pitched-roof building, and a glass office facade, selected from at most three CC0 assets.

For adjacent procedural blocks, keep deterministic generation and current city layout, but move the common building forms away from stacked flat cuboids: vary roof profiles, facade depth, window recesses, floors, and materials. Reuse the chosen block's subdued material palette so imported and generated structures read as one city. Maintain the existing lower skyline near landmark views.

Select the pilot plot from existing generated building footprints during implementation; do not hard-code a new route or move a landmark to fit an asset.

### Streets and public space

Give ordinary streets a clear road/sidewalk boundary with low curbs, pavement variation, lane markings, and a restrained number of crossings and street-level details. Keep plazas and pedestrian paths continuous and at their existing elevations. Keep green space in parks and selected verges while paving dense urban areas; do not paint the whole city green or pave over a park's walking paths.

Road details must stay out of the bus and vehicle envelopes and must not introduce obstacles on pedestrian corridors. The scene's bus and people remain unchanged.

## Data flow and failure handling

`scene.js` already assembles the world asynchronously and `city.js`/`blocks.js` generate the generic city. The pilot will reserve its selected plot in procedural generation, then add the loaded model group at that same footprint. Keep asset loading inside world assembly so the HTML panel remains available immediately. A load/parse failure falls back to the procedural building for that plot; it must not fail the whole scene or the no-WebGL fallback.

Keep asset URLs relative to the site root, which is hosted below `/personal-website/`. Avoid decoder dependencies and external runtime asset hosts. Keep existing seeded generation stable outside the reserved plot.

## Performance and accessibility

Choose lightweight assets and test on desktop and 375px mobile. Reuse geometry/materials, keep the pilot asset count to three or fewer, avoid heavy shadow-casting detail, and retain the existing quality-tier fallback. Acceptance requires desktop Lighthouse performance ≥80 and accessibility ≥95, no new console errors, and no loss of the WebGL-off/reduced-motion experience. If the asset pilot misses the performance target, reduce or remove assets before expanding.

## Validation and rollout

1. Add a geometry-level test that the pilot models replace their reserved procedural plots and remain outside landmark/view clearances and pedestrian/road envelopes.
2. Add a browser test that all models load, report their expected bounds, and fall back to procedural buildings when one asset is unavailable.
3. Compare the pilot at its representative journey view in day and night, desktop and mobile; confirm the city no longer reads as stacked cubes and that the landmark, route, and paths remain clear.
4. Run `node --test tests/`, the relevant browser tests, the full manual matrix in `AGENTS.md`, and Lighthouse thresholds above.
5. Expand the same building and street language to the other generic city blocks only after the pilot passes. Do not change landmarks, bus, or pedestrians during expansion.

## Out of scope

- Replacing the whole Three.js renderer or switching to an orthographic/2D map.
- Realistic vehicle or character models, new animation, new interaction, or altered journey/camera behavior.
- Changes to landmark designs or placement.
- New packages, build tooling, runtime model hosting, or assets without a verified CC0 source.
