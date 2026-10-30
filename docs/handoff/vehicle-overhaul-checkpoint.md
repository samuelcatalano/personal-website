# Vehicle quality overhaul: checkpoint (2026-10-29)

Mission: raise every vehicle to one visual standard. Priority: London bus, Glasgow bus (shared geometry, two liveries), Caio bus (São Paulo, own model). Preserve Mini, London cab, A330 unless a concrete defect is found. Landmarks (Wembley, Riverside, London Eye, Copan, Estaiada) are suspended. Models: Sonnet 5.5 Medium, Haiku for small tasks, no Opus unless Sonnet is truly blocked. Never push. Weekly cap set by the owner: 55% (53% when this was written).

## Inventory (discovery done)
| Vehicle | Runtime asset | Source/tooling | Status |
|---|---|---|---|
| London + Glasgow bus | `assets/vehicles/double-decker-bus.glb` (1.3 MB, one geometry, liveries via `reskinBus` in `js/world/vehicle-assets.js`) | `tools/vehicles/double-decker-bus-dd/build_bus_dd.py` (supersedes `double-decker-bus/`) | owner: unsatisfactory, priority 1 |
| São Paulo bus (Caio Millennium, Volvo B10M) | `assets/vehicles/sao-paulo-bus.glb` (1.7 MB, over tri budget) | `tools/vehicles/caio-millennium-volvo-b10m/build_sao_paulo_bus.py` (+ validate/render) | owner: unsatisfactory, priority 1 |
| Mini Cooper | `assets/processed/vehicles/mini-cooper-2011.lod{0,1}.glb` | raw 20 MB `assets/vehicles/mini-cooper-2011.glb`, `tools/vehicles/mini-cooper*/` | good, preserve |
| London cab TX4 | `assets/vehicles/london-cab.glb` (0.4 MB) | `tools/vehicles/london-cab-tx4/` | good, preserve |
| Airbus A330 | `assets/vehicles/a330.glb` (0.3 MB) | `tools/vehicles/a330/` | good, preserve |
| Ambient cars (Range Rover, E63, Corolla, Qashqai, T-Cross, Honda HR-V raw) | `assets/processed/vehicles/*.glb`, HR-V raw 47 MB | `tools/vehicles/regional-fleet/` | audit only; HR-V cannot be simplified |

Loader map: `vehicle-assets.js` `URLS` (a330, bus, sao-paulo, mini, cab), procedural fallbacks in `js/world/vehicles.js` and `js/world/buses.js` (lofted London/Glasgow shells). Pipeline: `tools/pipeline/optimise.mjs`, `check.mjs`. Tests: `tests/vehicles.browser.py`, `tests/london-cab.browser.py`, `tests/zfight.browser.py`. Harness note: prefix browser tests with the 150 s CDP timeout patch and close test tabs (see status-log.md).

## Plan
1. Baseline: renders of all three buses (4 angles + in scene) and metrics (tris, materials, GLB bytes, calls) with `tools/pipeline/check.mjs` and `tools/perf/route-profile.py`.
2. Agent A (Sonnet, Medium): London/Glasgow bus in Blender (`build_bus_dd.py`), references in `tools/vehicles/double-decker-bus-dd/` and the owner's images; liveries only via `reskinBus`.
3. Agent B (Sonnet, Medium): Caio bus in Blender, own model.
4. Visual QA (Haiku or me): render, compare to references, send back defects.
5. Audit Mini, cab, A330, ambient cars (read-only, fix only concrete defects).
6. Verify transitions (Mini -> London bus, Glasgow, Caio), route profile before/after, node + browser tests; update this file.

## State (updated 2026-10-30)
- Done and merged (local, unpushed): London/Glasgow double-decker rebuilt as an original lofted Blender model (`ee2d20e`, night glass fix `68f3a4e`): 14,088 tris, 0.36 MB (was 58,806 / 1.32 MB), Glasgow purple, London red, same contract and role names. Caio Millennium bus rebuilt from scratch (merged with `v-caio`): 14,594 tris, 0.42 MB (was 52,588 / 1.66 MB), `tests/vehicles.browser.py` SP checks updated (8k to 35k tris, at most 9 meshes). Tests: node 116/116, browser vehicles and zfight pass.
- In-scene evidence: London (stops 9.5, 10.3) and Glasgow (stop 11) day and night in `scratchpad/busfinal` and `scratchpad/n5` (not committed). The Caio bus was NOT seen in any in-scene capture (single ambient regional bus, `ambient.js` D('london', 0.35, { regionBus })); only Blender renders and the vehicles test.
- Mini Cooper, London cab, A330: seen in scene captures (stops 4 to 11) with no defect noticed; not changed, no formal audit.
- Pending: confirm Caio in scene (orientation of doors, wheel y 0.52, scale), Mini to London bus hero-swap scale morph (bus is about 0.1 m longer), lamps at night, cache-bust for raw bus GLBs (`PIPELINE_V` only covers processed files), ambient car audit (HR-V 47 MB raw unchanged), route-profile before/after for buses, mobile/WebGL-off not run.

## Update 2026-10-30 (second wave)
- Merged: London/Glasgow wheels (`ee7f572`, dished steel disc, nut ring, hull lip removed, GLB `?v=w2`); Caio per owner reference photos plus seven Caio in SP traffic (`f7598dc`, `ambient.js` entries, 25.1k tris, 0.72 MB); ambient cars paint/glass/tyre materials in `vehicle-assets.js` (`80e67fd`).
- REVERTED (`730e8cf`): the regenerated processed car GLBs (crease-smoothed normals, `PIPELINE_V` 7). With them the scene rendered large black areas in headless Chrome (draw calls 982 to 589, no console error); the old GLBs plus the new materials render correctly. `tools/pipeline/optimise.mjs` keeps the new `crease=` option. Retry only with a per-car bisect (one GLB at a time) and a full-frame capture.
- Pending: confirm Caio orientation and night look in scene, Mini to bus hero-swap scale, panel gaps on ambient cars (missing), ambient car lamp glow at night, route-profile for buses, tests/zfight rerun after the last Chrome daemon timeout.
