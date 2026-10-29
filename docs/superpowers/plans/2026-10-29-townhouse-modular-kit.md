# Townhouse Modular Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Complete tasks in order; use GPT-6 Luna / High for every implementer and reviewer.

**Goal:** Add visually rich, reusable townhouse facade modules to the existing nine-lot pilot while preserving the approved city and three-bucket renderer.

**Architecture:** Author one named Blender kit, export and losslessly optimize it with the existing pipeline, then load its modules asynchronously into the existing townhouse experiment. Transform and merge module geometry into the current `mass`, `trim`, and `glass` geometries; retain the synchronous procedural meshes as fallback and keep the three-lot control unchanged.

**Tech Stack:** Blender 5.2 Python, Three.js 0.169, existing `loadGlb`, Meshopt optimizer with triangle simplification disabled, `browser-harness` desktop checks.

**Spec:** `docs/superpowers/specs/2026-10-29-townhouse-modular-kit-design.md`

## Global Constraints

- Preserve map data, lot footprints/heights, route, landmarks, paths, pedestrians and approved townhouse facade rhythm.
- Apply only to the nine existing townhouse experiment lots; keep the three-lot control slice unchanged.
- Keep at most three active renderables per 32×32 chunk: mass, trim, glass.
- Use stable local deterministic variation; do not consume the global layout RNG.
- Reuse current LOD0/LOD1 and AABB hysteresis thresholds (initial 120 m; outward 129 m; inward 111 m).
- Do not add site dependencies or a site build step. Use relative asset URLs.
- Triangle count has no pass/fail ceiling. Visual quality comes first; perform geometry optimization after the appearance is established, without visible quality loss.
- Do not run mobile checks or deploy.

## Review Focus

- GLB load fails or finishes after teardown → procedural pilot remains visible; test rejected late adoption.
- Input lot order changes → module choices remain deterministic; test shuffled descriptor order.
- Module transform or material role is absent → geometry stays grounded and lands in exactly one of the three buckets; test bounds and role counts.
- LOD transition or detail overlaps facade → preserve hysteresis and check z-fighting at the pilot; test both LOD states and capture desktop.
- Kit geometry adds triangles → report the count, but do not reduce detail just to meet a budget.

---

### Task 1: Author and export the townhouse kit

**Files:**
- Create: `tools/buildings/townhouse-kit/build_townhouse_kit.py`
- Create: `tools/buildings/townhouse-kit/README.md`
- Create: `assets/processed/buildings/townhouse-kit.glb`
- Modify: `ASSET_SOURCES.md`

**Interfaces:**
- Produces named module variants grouped by semantic role `mass`, `trim`, or `glass`; each module origin is its wall/roof placement anchor.
- Initial variant counts: 6–8 windows, 6 doors/storefronts, 5 cornices/string courses, and 5 roof details.

- [ ] Add Blender-side assertions for module names, non-empty mesh geometry, role assignment, and valid bounds.
- [ ] Build the kit as project-authored geometry; do not import external meshes or textures.
- [ ] Export the raw Blender GLB directly to `assets/processed/buildings/townhouse-kit.glb`; defer optimization until the appearance is established.
- [ ] Record the generated kit as project-owned in `ASSET_SOURCES.md` and document the rebuild command.
- [ ] Run the generator and its assertions; inspect the resulting GLB module names and geometry before handing off.
- [ ] Self-review and commit the asset milestone.

### Task 2: Integrate modules into the existing pilot buckets

**Files:**
- Modify: `js/world/building-slice.js`
- Modify: `tests/building-slice.browser.py`
- Modify: `tests/building-kit.browser.py` if shared chunk assertions need coverage

**Interfaces:**
- Keep `createTownhouseExperiment(plots, neighbors)` synchronous and returning the same `THREE.Group` contract.
- Load `assets/processed/buildings/townhouse-kit.glb` via existing `loadGlb(url)`; asynchronous success replaces pilot geometry, while failure/disposal preserves procedural geometry.
- Keep `userData.update(camera)` and idempotent `userData.dispose()` behavior.

- [ ] Add browser assertions for the three buckets per chunk, authored module adoption, deterministic assignment after shuffled lot input, and unchanged three-lot control.
- [ ] Add browser assertions for fallback on failed load, rejection after disposal, grounded bounds, and both LOD states.
- [ ] Load and cache the GLB module library; build LOD0 placements from the existing deterministic townhouse recipes and merge them into the three role geometries.
- [ ] Keep current LOD thresholds and procedural fallback unchanged; never introduce a triangle-count gate or extra render bucket.
- [ ] Run `browser-harness < tests/building-slice.browser.py` and `browser-harness < tests/building-kit.browser.py` against desktop Chrome.
- [ ] Self-review and commit the runtime milestone after targeted checks pass.

### Task 3: Desktop quality pass and lossless optimization

**Files:**
- Modify: `tests/zfight.browser.py` only if the authored modules need a focused assertion
- Modify: `docs/architecture/rendering-budget.md` with measured results, not a triangle ceiling
- Modify: `docs/handoff/status-log.md`

- [ ] Capture the existing pilot in desktop Chrome before and after; inspect facade depth, silhouette, rhythm, grounding, and z-fighting at default view and both LOD states.
- [ ] Measure draw calls, geometry triangles, and asset bytes; GO requires facade details to read and draw calls ≤10% above control. Triangle count is reported only.
- [ ] After accepting the visual result, run `node tools/pipeline/optimise.mjs assets/processed/buildings/townhouse-kit.glb /private/tmp/townhouse-kit-optimized.glb 1` and compare before/after capture. Keep the optimized output only if appearance is unchanged; no simplification or triangle-count target.
- [ ] Run `node tools/pipeline/check.mjs` and record asset bytes and triangle count as measurements, not gates.
- [ ] Run `node --test tests/` and the focused desktop browser checks: `building-slice.browser.py`, `building-kit.browser.py`, `citywide.browser.py`, and `zfight.browser.py`. Do not run mobile tests.
- [ ] Append measured results, commit hashes, known limitations, and next approval-gated step to `docs/handoff/status-log.md`; commit the validation milestone.
