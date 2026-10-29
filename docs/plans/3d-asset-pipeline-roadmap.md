# 3D asset pipeline roadmap

Status: plan only (2026-10-29). Architecture and rationale: `docs/architecture/blender-asset-pipeline.md`. Nothing here is approved for implementation until the owner approves the phase. One owner (one agent/tool) per phase, one branch per phase, no citywide rollout without its gate.

Universal gate per phase (GO needs all): tests green, zero console errors, paired A/B p95 within the project limits (+1 ms desktop, +2 ms emulated mobile; mobile checks only when the owner asks), draw calls ≤ +10 %, payload within budget, visual review by the owner on the standard shots (`tools/capture.py`: stops 5, 9.5, 11, day/night). Rollback = keep the previous GLB/procedural path switchable until GO.

## First POC (recommendation): Big Ben + Parliament

| Candidate | Visual impact | Effort | Pipeline coverage | Measurable? |
|---|---|---|---|---|
| Mini Cooper | medium (already improved) | low | no textures, no KTX2, no AO, no HDRI use | tris, bytes only |
| London bus | high on screen | medium | colour slots only, no textures | tris, bytes |
| **Big Ben / Parliament** | **high (London identity, hero landmark)** | **medium** | **Blender → UV → PBR → AO bake → GLB → glTF-Transform → Meshopt → KTX2 → Three → LOD → HDRI reflection → night emissive (clock)** | **bytes, tris, GPU memory, p95, A/B image** |
| Townhouse facade module | medium | high | kit, atlas, instancing, LOD, but needs the whole building integration | draw calls, memory |

Big Ben validates almost every stage in one asset and sits inside an existing replacement point (`landmark-geometry.js` already isolates it with three buckets). The only stages it does not exercise (modular kit, instancing) are exactly Phase 3.

## Phases

### Phase 0: tooling and asset hygiene
- Objective: reproducible tools, nothing visual changes.
- Systems/files: new `tools/pipeline/` (isolated `package.json`, README with pinned glTF-Transform/toktx versions, `budgets.json`, `check.mjs`); `ASSET_SOURCES.md`; `assets/vehicles/` classification.
- Deliverables: install notes, `check.mjs` that reports bytes/tris/materials per GLB and unreferenced GLBs; list of raw GLBs to move to `sources/raw-glb/` (e.g. `honda-hr-v` 47 MB, `mini-cooper-2011` 20 MB, `toyota-corolla` 14 MB): owner approves before any move.
- Tests: `check.mjs` on current assets (baseline report committed).
- Benchmark: cold-load payload of the current build (bytes, requests).
- GO: baseline numbers committed; tools run on a clean machine; owner approves tool install. NO-GO: tool cannot run offline or needs a deployed build step.
- Rollback: delete `tools/pipeline/`.

### Phase 1: one vehicle POC (compression chain only)
- Objective: prove Meshopt + load path on an existing vehicle before textures enter.
- Systems: one GLB (hero bus or Mini), `vehicle-assets.js` loader (`MeshoptDecoder`).
- Deliverables: processed GLB (≤ 2 MB), LOD0/LOD1 files, manifest row, loader change behind a flag.
- Tests: load + material-role tests (`vehicles.browser.py`), manifest check.
- Benchmark: bytes before/after, decode time, p95.
- GO: bytes −50 % or more, identical look (pixel diff on the standard crop), decode time under 30 ms on desktop. Rollback: flag off, old GLB.

### Phase 2: one landmark POC (full chain): Big Ben + Parliament
- Objective: validate Blender → PBR → AO bake → GLB → optimise → KTX2 → Three → LOD → HDRI → night emissive.
- Systems: new `tools/landmarks/bigben/build_bigben.py`, `landmarks.js`/`landmark-geometry.js` swap point, KTX2Loader wiring, HDRI/PMREM, night clock emissive, shared atlas.
- Deliverables: `assets/processed/landmarks/bigben.glb` (LOD0 ≤ 12k tris, LOD1 4k, 1K atlas + AO, KTX2), manifest, before/after captures day/night, A/B report in `docs/architecture/rendering-budget.md`.
- Tests: landmark-geometry envelope test updated to the authored bounds; sightline test; zfight; console clean.
- GO: visual win (owner), GPU memory ≤ 30 MB for all landmarks, p95 within limits, payload ≤ 1 MB. NO-GO: transcoder/Meshopt decode stalls first frame or A/B fails. Rollback: keep the procedural builder behind the flag.

### Phase 3: modular building kit
- Objective: one archetype end to end (townhouse), then decide instancing vs merged buckets.
- Systems: `building-kit.js`, `building-slice*.js`, `blocks.js`, `city-rollout.js`; new `building-kit.glb` + trim atlas.
- Deliverables: window/door/cornice/roof modules, deterministic bay assignment, LOD0/LOD1 reuse, benchmark of both combination strategies.
- Tests: building-slice/kit/diversity/citywide/zfight browser tests, Node tests; memory and draw-call report.
- GO: draw calls ≤ +10 %, tris within `rendering-budget.md`, facade depth readable at default camera. Rollback: archetype flag back to the procedural recipe.

### Phase 4: vegetation and public realm
- Objective: tree LOD0/LOD1/LOD2 and a props atlas; instanced benches/bins/phone boxes/bus stops.
- Systems: `trees.js`, `tree-mesh.js`, `lamps.js`, `street-lamp.js`, `kiosk-mesh.js`, `parks.js`.
- Deliverables: processed tree/prop GLBs, impostor atlas, budgets met (tree ≤ 3k / 900 / 2 tris).
- GO: tree triangle budget holds with better crowns; draw calls ≤ +10 %. Rollback: current leaf-card system.

### Phase 5: citywide asset migration
- Objective: roll proven kits/vehicles/landmarks across all regions, region by region (SP, London, Glasgow), lazy-loading per region.
- Deliverables: all vehicle classes at their budgets with LODs, remaining landmarks, per-region lazy loading, manifest complete.
- GO: payload target met (≤ 12 MB gzip authored assets), p95 within limits at every standard shot. Rollback: per-region flag.

### Phase 6: lighting, bake and colour
- Objective: AO baked where it pays, HDRI day/night env, GTAO on `high` tier, AgX vs ACES decision.
- Systems: `sky.js`, `post.js`, `vehicle-assets.js` env, `building-slice-materials.js`.
- Deliverables: neutral-light AO maps, day/night env interpolation, GTAO pass (half-res), colour decision doc with A/B images.
- GO: visible depth gain, GTAO within +1 ms desktop, no day/night mismatch. NO-GO: any bake that only works in one time state. Rollback: passes/maps off by tier flag.

### Phase 7: final optimisation
- Objective: payload, memory and frame-time polish; future CI.
- Deliverables: `check.mjs` enforced in a GitHub Action (separate approval), final budget table in `rendering-budget.md`, optional WebGPU experiment branch (not merged).
- GO: all universal gates at once on the full standard shot set.

## Decisions that need the owner

1. Approve installing glTF-Transform (npm) and `toktx` on the dev machine, isolated in `tools/pipeline/`.
2. Confirm the sourcing rule: keep the 2026-10-27 decision (Sketchfab/NC-SA allowed per asset with approval) or return to "no Sketchfab" for this pipeline.
3. Approve the POC choice (Big Ben + Parliament) and the `sources/` layout before any file move.
4. Approve moving or deleting unreferenced raw GLBs in `assets/vehicles/`.
5. Mobile: confirm whether mobile gates stay out of scope (you asked to ignore mobile for now).

## Biggest risks

Dev tooling in an npm-free repo; KTX2/Meshopt decode cost on first load; instancing vs merge outcome in Phase 3; day/night vs baked light (AO only); licence provenance of sourced meshes; scope creep into a citywide rewrite; two tools (Codex and Claude) committing to the same branch.
