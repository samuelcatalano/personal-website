# Realistic City Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each task requires a fresh implementer and reviewer; keep the tasks sequential because each consumes the prior task's plot interface. Use the least costly model that can complete each task, and have the orchestrator inspect every diff.

**Goal:** Replace one representative generic city block and its street with a lightweight realistic 3D pilot, without changing the route, landmarks, bus, or people.

**Architecture:** The existing procedural city generator reserves up to three building footprints in a non-landmark block and exposes descriptors to a small async architecture builder. That builder loads local CC0 GLTF models and creates a procedural replacement per failed asset. Street details are added only within the pilot block using the existing scene geometry conventions.

**Tech Stack:** Vanilla ES modules, pinned Three.js 0.169.0, existing `three/addons/` import map and `GLTFLoader`, existing `node:test` and browser-harness.

**Spec:** `docs/superpowers/specs/2026-10-19-realistic-city-design.md`

## Global Constraints

- Modernize generic buildings and street details; keep the bus and people stylized.
- Keep every landmark recognizable and unobstructed. Preserve roads, walking routes, plazas, and the existing scroll route.
- Keep the Three.js version pinned, use vanilla ES modules, relative asset URLs, no npm/build step, and prefer CC0 assets.
- Test only a few assets in one representative generic urban block first. Expand to other generic blocks only if the pilot meets the quality and performance checks below.
- Do not alter landmark models as part of this work.
- Avoid decoder dependencies and external runtime asset hosts; record asset source and CC0 status alongside local model files.

## Review Focus

- A model fails to load or parse — the reserved plot still shows a procedural building (Task 2 browser test).
- Asset scale/origin differs from the footprint — no overlap with adjacent buildings, street, or landmarks (Task 1 geometry test; Task 2 browser bounds test).
- Pilot plot is near the camera but inside a landmark sightline — placement test rejects it using protected regions (Task 1 geometry test).
- Repeated plots multiply geometry/material memory — repeated instances share geometry/material and total plots stay within three (Task 2 browser check).
- New curb/crossing intersects walking paths or vehicles — clearance test rejects the street layout (Task 3 browser test).

---

### Task 1: Reserve and validate the pilot block

**Files:**
- Modify: `js/world/blocks.js`
- Modify: `js/world/city.js`
- Test: `tests/real-city.test.mjs`

**Interfaces:**
- `buildBlocks(add, stops, pts, curve, occ, onBuildingPlot)` keeps its existing box output and invokes `onBuildingPlot(plot)` for at most three selected buildings instead of drawing those buildings.
- Each plot is `{ id, kind, x, z, width, depth, height }`, with `kind` one of `terrace`, `midrise`, or `office`.
- `buildCity` accepts and forwards an optional final `onBuildingPlot` callback.

- [ ] **Step 1: Write failing placement tests** named `pilot plots replace three procedural buildings` and `pilot plots clear protected landmark and route regions`. Assert no more than three plots, one plot for each `terrace`/`midrise`/`office` kind, stable descriptors for the same route, and no intersection with landmarks, camera foregrounds, pedestrian corridors, or road envelopes.
- [ ] **Step 2: Run `node --test tests/real-city.test.mjs` and verify the new plot assertions fail before implementation.**
- [ ] **Step 3: Add the callback and select up to three existing deterministic building footprints in one generic London block.** Preserve RNG consumption and occupancy behavior for all other buildings.
- [ ] **Step 4: Run `node --test tests/real-city.test.mjs tests/glasgow-clearance.test.mjs tests/scenery-fill.test.mjs` and verify all pass.**
- [ ] **Step 5: Commit the isolated plot-selection change.**

### Task 2: Load CC0 buildings with procedural fallback

**Files:**
- Create: `js/world/real-city.js`
- Create: up to three models under `assets/city/pilot/` and `assets/city/pilot/SOURCES.md`
- Modify: `js/world/scene.js`
- Modify: `index.html` only if the existing Three.js addon import map cannot load the pinned `GLTFLoader`
- Test: `tests/real-city.browser.py`

**Interfaces:**
- `buildRealCity(plots) -> Promise<THREE.Group>` loads the local model selected by each plot's `kind`, scales it to fit its descriptor, and falls back per plot if loading fails.
- It reuses loaded model geometry/materials for matching plot kinds and never loads more than three pilot plots.

- [ ] **Step 1: Add the browser test** named `pilot models fit their plot and failed models fall back`; verify bounds, repeated instances share geometry/material, asset count stays within three, and a failed URL still yields visible geometry.
- [ ] **Step 2: Run `browser-harness < tests/real-city.browser.py` and verify the missing loader/module behavior fails before implementation.**
- [ ] **Step 3: Choose at most three CC0 GLTF models that fit the pilot styles and site budget; save only the required optimized GLB/texture files plus source/license record.** Prefer total pilot downloads below 2 MB and below 30,000 triangles per distinct model; reject candidates that miss those limits.
- [ ] **Step 4: Implement `buildRealCity` with the pinned `GLTFLoader`, bounds-based uniform fit, shared loaded geometry/materials, and a small procedural fallback using the existing palette.**
- [ ] **Step 5: Collect plots in `scene.js`, add the returned group during async scene assembly, and leave landmarks, traffic, people, and the HTML panel lifecycle unchanged.**
- [ ] **Step 6: Run the browser test and verify successful loading, correct bounds, fallback geometry, and no console errors; run `node --test tests/`.**
- [ ] **Step 7: Commit the pilot asset/loading integration.**

### Task 3: Give the pilot street realistic detail

**Files:**
- Modify: `js/world/city.js`
- Test: `tests/real-city.browser.py`

- [ ] **Step 1: Add failing browser assertions** named `pilot street separates roadway from continuous pedestrian paths`; check curb/pavement geometry, lane markings, path continuity, and vehicle/pedestrian clearance.
- [ ] **Step 2: Run the browser test and verify the street assertions fail before implementation.**
- [ ] **Step 3: Add low curbs, pavement variation, restrained lane markings, and crossings inside the pilot block only.** Use relative dimensions aligned to existing road/path elevations; do not pave parks or landmark plazas.
- [ ] **Step 4: Run `browser-harness < tests/real-city.browser.py`, `browser-harness < tests/vehicles.browser.py`, `node --test tests/`, and `git diff --check`; verify all pass.**
- [ ] **Step 5: Commit the pilot street changes.**

### Task 4: Review the pilot before citywide expansion

**Files:**
- Update: `docs/TRD.md`
- Test: `tests/real-city.browser.py` plus the manual matrix below

- [x] **Step 1: Inspect the pilot at its journey stop, desktop and 375px mobile, day and night; confirm it reads as realistic 3D and all landmarks, paths, and bus/person silhouettes remain clear.** The 3D tests cover desktop/mobile and day/night, but the visible scene remains mostly voxel; pilot capture: `/tmp/real-city-pilot-olm.png`.
- [x] **Step 2: Verify EN/PT, WebGL disabled, reduced motion, and no console errors; run the full browser test suite.** All browser scripts except the unchanged global z-fighting detector pass. That detector reports the same 207 pairs on the base commit `946b535`; the new sidewalk-specific diagnostic reports zero conflicting pairs.
- [x] **Step 3: Run Lighthouse and verify accessibility ≥95 and desktop performance ≥80.** Desktop: accessibility 100, performance 80. Default mobile run: accessibility 100, performance 41.
- [x] **Step 4: Update `docs/TRD.md` with the tested asset/fallback and plot-clearance behavior.**
- [x] **Step 5: Stop for user review of the visible pilot before expanding the design to the remaining generic city blocks.**

