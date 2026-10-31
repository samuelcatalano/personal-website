# Vegetation Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make existing trees, park beds, planters, and garden planting read as varied, layered vegetation while preserving the city layout and landmark views.

**Architecture:** Keep the existing tree placement, 160 m chunking, instanced batches, and three LODs. Add reusable low-poly planting geometry to the existing `createBoxes`/`buildMeshes` path and reuse it in park and garden compositions, without adding a vegetation lifecycle hook to `scene.js`.

**Tech Stack:** Three.js 0.169 ES modules, procedural `BufferGeometry`, `InstancedMesh`, existing Node tests and browser-harness.

**Spec:** This approved 2026-10-31 request, the vegetation plan in the conversation, `docs/art-direction.md`, `docs/architecture/3d-city.md`, and `docs/architecture/rendering-budget.md`.

## Global Constraints

- Preserve lot descriptors, routes, walking paths, existing vegetation centres, tree height/crown envelopes, and landmark positions and sightlines.
- Keep variation deterministic; do not change `crowd.js` `walkPaths` output or consume the shared layout RNG sequence.
- Keep pedestrian modules and their `scene.js` lifecycle edits owned by Claude; do not modify `scene.js`, `crowd.js`, `people.js`, `sprites.js`, `figure.js`, or `main.js`.
- Use existing instancing, shared materials, and tree LOD0/LOD1/LOD2; add no dependencies, external assets, or build step.
- Preserve all pre-existing working-tree changes, especially the existing `country.js` architecture diff; do not stage or commit unrelated paths.
- Keep protected low planting below 1 m and inside its current footprints; no planting may obstruct routes or landmark views.
- Validate desktop only; do not run mobile checks.

## Review Focus

- Tree silhouette changes must remain inside each placement's crown/height envelope — `tests/trees.browser.py` checks every LOD's bounds.
- Park planting must remain within existing beds and clear of loops/signs — `tests/parks.test.mjs` checks placements and clearances.
- New custom vegetation records must not alter ordinary box batching or yaw — `tests/plantings.browser.py` checks box and plant batches separately.
- Country and hero garden additions must remain within existing lawns and preserve deterministic positions — `tests/gardens.test.mjs` checks bounds and repeatability.
- The new batches must use one cached geometry/material per plant kind, never per-instance materials — desktop browser validation checks batch count, scene errors, and resource reuse.

---

### Task 1: Distinguish tree crown families

**Files:**
- Modify: `js/world/tree-mesh.js`
- Test: `tests/trees.browser.py`

**Interfaces:**
- Consumes: `canopyGeometry(type, lod)` and `trunkGeometry(type, lod)` used by `trees.js`.
- Produces: Same exports and unit bounds, with visibly distinct round, column, spread, bloom, and conifer silhouettes at both geometric LODs.

- [x] Add browser assertions comparing crown width at several normalized heights for the five families and confirming LOD0/LOD1 stay inside the unit envelope.
- [x] Run `browser-harness < tests/trees.browser.py`; confirm the new family-distinction assertion fails before geometry changes.
- [x] Adjust family profiles and branching/clump distribution in `tree-mesh.js`; keep placement scale, instance count, chunking, LOD thresholds, shadow flags, and impostor API unchanged.
- [x] Re-run the focused browser test and confirm all existing tree placement, clearance, LOD, and disposal assertions pass.
- [x] Commit only `js/world/tree-mesh.js` and `tests/trees.browser.py` after the focused test passes.

### Task 2: Add reusable park-bed planting batches

**Files:**
- Create: `js/world/plant-mesh.js`
- Modify: `js/world/voxel.js`
- Modify: `js/world/city.js`
- Modify: `js/world/parks.js`
- Test: `tests/parks.test.mjs`
- Test: `tests/plantings.browser.py`

**Interfaces:**
- Consumes: The `createBoxes()` list, `buildCity`'s `addOff` wrapper, and existing `buildParks(draw, ...)` positions.
- Produces: Optional `add.plant(kind, x, y, z, w, h, d, tint, yaw = 0)` records in the existing box list; `buildMeshes(list)` renders one instanced batch per plant kind with shared cached geometry/material. `createPlantGeometry(kind)` returns fresh normalized geometry (ground origin, footprint in [-0.5, 0.5]); `voxel.js` caches one geometry per kind like its shared box geometry, while `hero-realm.js` owns and disposes its merge inputs. `buildParks` uses the callback for flowers, low shrubs, and hedges, preserving its current box fallback for non-runtime callers.

- [x] Extend the park test collector with `draw.plant` and assert existing bed/planter footprints produce plant records, while tree positions, park boxes, and walking clearances remain unchanged.
- [x] Run `node --test tests/parks.test.mjs`; confirm the new planting assertions fail because no plant records exist yet.
- [x] Create reusable low-poly flower, shrub, and hedge geometry in `plant-mesh.js`; add optional plant records and instanced rendering to `voxel.js`; forward the callback through `city.js` without changing route or RNG behavior.
- [x] Replace park flower color blocks and box hedges in `parks.js` with clustered planting inside the same beds/planters; derive tint/yaw from stable park/slot coordinates rather than shared RNG.
- [x] Add browser checks for plant batch counts, geometry bounds, shared materials, and unchanged box batches; run the focused parks and planting tests.
- [x] Commit only the Task 2 paths after its focused Node and browser checks pass.

### Task 3: Reuse planting in the hero and rural gardens

**Files:**
- Modify: `js/world/hero-realm.js`
- Modify: `js/world/country.js`
- Test: `tests/gardens.test.mjs`
- Test: `tests/hero-realm.test.mjs`

**Interfaces:**
- Consumes: `plant-mesh.js` geometry from Task 2 and existing hero/country garden footprints.
- Produces: Layered low planting in existing hero lawn-end beds and country pocket gardens; no new garden footprint, obstacle, route, or tree placement.

- [x] Add tests for deterministic plant positions, the existing garden rectangles, sub-1 m height, and preserved hero-realm obstacle records.
- [x] Run `node --test tests/gardens.test.mjs tests/hero-realm.test.mjs`; confirm the new composition assertions fail before implementation.
- [x] Replace the hero garden's repeated ellipsoid clumps with the shared low-poly planting geometry while keeping the current merged buckets, positions, and obstacles.
- [x] Add low planting only along the existing country pocket-garden edges, leaving the two trees, bench, grass footprint, and prior architecture changes untouched.
- [x] Run focused garden tests and `git diff --check` for the changed files.
- [x] Commit only the Task 3 changes; stage only the new country-garden hunk from the already-modified `country.js`.

### Task 4: Consolidated desktop review and documentation

**Files:**
- Modify: `docs/art/asset-quality-spec.md`
- Modify: `docs/art-direction.md`
- Modify: `docs/architecture/3d-city.md`
- Modify: `docs/architecture/rendering-budget.md`
- Modify: `docs/audits/full-scene-visual-atlas.md`
- Evidence: `docs/evidence/vegetation-visual-upgrade/`

- [x] Capture stops 5, 9.5, 10, and 11 in day/night with desktop `tools/capture.py`; review the four regions and landmark sightlines. `tests/trees.browser.py` verifies near/far LOD selection and bounds; the capture tool does not set arbitrary camera distances, so separate close/middle/far screenshots were not produced.
- [x] Check for a comparable before/after profile and record available structural metrics. No matched renderer baseline was available in this run, so draw-call, submitted-triangle, memory, and frame-time deltas remain unknown; do not invent a triangle cap.
- [x] Update stale vegetation representation/budget notes and current visual grades with only measurements and captures verified in this run.
- [x] Run `node --test tests/parks.test.mjs tests/gardens.test.mjs tests/hero-realm.test.mjs`; run the focused `trees.browser.py`, `plantings.browser.py`, and one desktop route capture. Report skipped broader/mobile checks plainly.
- [x] Commit only the Task 4 docs/evidence after validation; stage only vegetation-specific hunks in the already-modified architecture/rendering-budget docs.
