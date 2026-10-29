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

## State
- Done: discovery, inventory, this checkpoint.
- Pending: everything in the plan.
- Blocker: weekly usage at 53% of the 55% cap; agents (about 3 to 5% each) cannot run until the owner raises the cap.
