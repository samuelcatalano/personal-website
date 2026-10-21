# Stylized 3D City System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the weak three-model pilot with a reusable procedural architectural renderer, then migrate ordinary buildings across the existing city while protecting landmarks and paths.

**Architecture:** Keep scene assembly, map coordinates, and clearances in their existing modules. `building-kit.js` produces reusable instanced facade geometry; city, countryside, back-block and Glasgow generators emit plot data through existing callbacks, and `scene.js` batches all ordinary buildings through `real-city.js`. Preserve the existing street/plaza generator.

**Tech Stack:** Vanilla ES modules, pinned Three.js 0.169.0, `node:test`, browser-harness, no build or npm.

**Spec:** `docs/superpowers/specs/2026-10-19-stylized-city-system-design.md`

## Global Constraints

- Preserve the established route, city layout, landmarks, avenue, water, paths, bus journey, and people.
- Never put buildings or trees in front of landmarks; preserve camera and pedestrian clearances.
- Keep Three.js 0.169.0, plain ES modules, relative URLs, no new dependency or external runtime asset.
- Use shared geometry/materials and deterministic placement; preserve existing box output for non-benchmark scenery.
- The benchmark must use real Three.js geometry and remain within the source lot bounds.

## Review Focus

- Dense facades can create too many draw calls — assert repeated windows use `InstancedMesh` and shared geometry/materials.
- The protected source block has only three distinct safe lots — assert the benchmark keeps those three and never expands into protected space.
- A building may breach its lot or ground plane — test world bounds and y=0 for every archetype.
- Protected landmark and pedestrian clearances can be lost during reservation — retain and extend placement tests.
- Geometry may fail in a browser context or when WebGL is unavailable — run browser test and retain HTML/WebGL fallback checks.

---

### Task 1: Build the procedural architecture kit

**Files:**
- Create: `js/world/building-kit.js`
- Test: `tests/building-kit.browser.py`

**Interfaces:**
- `createBuilding(plot) -> THREE.Group` creates a plot-sized building using instanced, reusable box geometry and shared materials; supported `plot.kind`: `terrace`, `shop`, `midrise`, `office`, `tower`.

- [x] Add browser assertions for all five kinds, exact grounded bounds, distinct silhouette/material variation, and instanced facade detail in `tests/building-kit.browser.py`.
- [ ] Run `browser-harness < tests/building-kit.browser.py` and verify it fails because the module does not exist.
- [x] Implement the shared procedural kit; keep meshes and palette in the existing Three.js conventions.
- [x] Run the browser test and `node --test tests/`; both pass.

### Task 2: Render the protected benchmark lots

**Files:**
- Modify: `js/world/real-city.js`
- Modify: `tests/real-city.browser.py`
- Remove: `assets/city/pilot/` if no other caller uses it

**Interfaces:**
- `buildRealCity(plots) -> Promise<THREE.Group>` keeps its async scene-assembly interface and returns at most five `createBuilding(plot)` results.
- `buildBlocks(..., onBuildingPlot)` keeps its existing three deterministic lots and clearance behavior; no new lots are added.

- [x] Update browser assertions to verify procedural geometry bounds and instancing, and reject GLB requests.
- [ ] Run the focused browser test and confirm it fails before integration because it still expects GLB loading.
- [x] Replace pilot GLB loading/fallback with the procedural kit; preserve the async scene contract and source lot bounds.
- [x] Remove the unused pilot models and source manifest after confirming no imports.
- [x] Verify browser bounds, no GLB requests, no console errors, then run the full Node test suite.

### Task 3: Batch and deepen procedural architecture

**Files:**
- Modify: `js/world/building-kit.js`
- Test: `tests/building-kit.browser.py`

**Interfaces:**
- `createCityBuildings(plots) -> THREE.Group` batches the same `createBuilding` geometry across all supplied plots by shared geometry/material, retaining instancing and plot bounds.

- [x] Add a browser test with 200 deterministic plots, asserting the returned group has at most 20 `InstancedMesh` draw objects, plot metadata, all five kinds, and bounds spanning the source plots.
- [ ] Run the focused browser test and confirm it fails because batching is not implemented.
- [x] Add city-wide batching and improve facade details (recessed panes, mullions, frames, balconies/storefronts) without per-window draw calls.
- [x] Run the focused browser test and `node --test tests/`.

### Task 4: Migrate ordinary buildings across the route

**Files:**
- Modify: `js/world/blocks.js`, `js/world/city.js`, `js/world/country.js`, `js/world/glasgow.js`, `js/world/scene.js`, `js/world/real-city.js`
- Test: `tests/real-city.browser.py`, `tests/scenery.browser.py`, and existing clearance tests

**Interfaces:**
- Add an optional `onArchitecturePlot(plot)` callback to `buildCity` and `buildBlocks`; emitted plot objects use `createBuilding`'s `kind`, position, footprint, height, and material/style fields.
- Ordinary buildings emitted to that callback suppress their old box geometry; landmarks and non-building scene objects continue through their existing renderers.
- `buildRealCity(plots)` returns one batched group for all emitted ordinary buildings; existing pilot name stays `real-city-pilot` for diagnostics.

- [x] Test ordinary-lot collection and verify emitted plots avoid protected regions, routes, and landmarks; verify seeded placement remains stable.
- [x] Replace ordinary building-box output across city, back rows, countryside, and Glasgow edges with plot collection while keeping existing clearances and RNG consumption.
- [x] Build one shared batched architecture group in `scene.js` and preserve the scene lifecycle.
- [x] Verify the full building count, batch bound, landmark clearance, no WebGL errors in browser, and all Node tests.

### Task 5: Inspect and tune the full city

**Files:**
- Modify only as needed: `js/world/building-kit.js`, `js/world/blocks.js`, `js/world/city.js`
- Update: `docs/TRD.md`

- [ ] Capture and assess the full manual matrix: desktop/mobile at 375px, day/night, EN/PT, WebGL-off, reduced motion, console, and Lighthouse accessibility.
- [ ] Review the rendered result against the reference; building plots are migrated, while streets, plazas, landmarks, water, vehicles and general scenery still use earlier renderers and remain follow-up visual phases.
- [x] Record remaining plaza, road, vegetation, landmark, bridge/water, vehicle, and distant skyline phases in TRD.
