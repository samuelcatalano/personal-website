# Double-decker bus asset (London + Glasgow)

One original geometry, two palettes. No third-party mesh or texture; `refs/` images were visual reference only.

| | |
|---|---|
| Generator | `build_bus.py` (`blender -b --factory-startup -P build_bus.py`), preview `render_bus.py [--variant glasgow]` |
| Approved POC | `bus-original-poc.glb` |
| Production asset | `assets/vehicles/double-decker-bus.glb` (single GLB for both cities) |
| Dimensions | 11.2 m long, 2.55 m wide (3.2 m with mirrors), 4.4 m to the roof pods; wheel r 0.47; axles x +3.4 / −3.0 |
| Axes / origin | three.js forward +X, up +Y, right +Z; origin on the ground, centred |
| Geometry | 5,700 unique tris (6,996 with 4 wheel instances), 3,540 verts, 5 mesh datablocks (wheels share one), 8 materials, 0 textures, ~171 KB. **Frozen 2026-10-22** (London master approved after the both-sides/stair correction, see `REFERENCE-ANALYSIS.md`) |
| Hierarchy | BusRoot → Body, Glass, Lights, Display, Wheels → FL FR RL RR (pivots at wheel centres; hero wheels spin) |

## Runtime

`js/world/vehicle-assets.js`: the GLB is loaded once and cloned per bus (geometry shared). Semantic GLB material names are replaced by the project's shared materials, so night glow (cabin windows, head/tail lamps, destination displays) keeps working through `sky.update`:

| GLB material | Runtime |
|---|---|
| BusBody / BusAccent | `paint(variant.body/accent)` |
| BusTrim, BusGlass, BusMetal | `fixed('dark')`, `fixed('busGlass')`, `fixed('chrome')` |
| BusHeadlight / BusTaillight | `fixed('head')` / `fixed('tail')` |
| BusDisplay | `destMat(...variant.dest)` (canvas destination) |

`BUS_VARIANTS`: London body `#c9252b`, accent `#8f171d`, "19 Finsbury Park"; Glasgow body `#8a36ae` (tuned so it stays purple, not navy, under night light), accent `#c9cdd2`, "6 Renfrew Street". Player buses (`scene.js`) and ambient buses (`ambient.js`) call `upgradeBus(vehicle, variant)`; the procedural bus remains if the GLB fails to load. Only the painted shell casts shadows. Player buses keep four spinning wheel nodes; ambient buses (`hero: false`) use one merged static wheel geometry per material, shared by every ambient bus.

## Performance (A/B vs procedural buses, 3 runs each, rendering-budget contract, 2026-10-22)

| Scene | Desktop calls | Desktop tris | Mobile calls | Mobile tris | p95 |
|---|---|---|---|---|---|
| London stop 10 (player + ambient buses) | ~666 → ~677 (+1.7%) | 1,073.5k → 1,075.8k (+0.2%) | ~180 → ~180 | 248.7k → 244.9k (−1.5%) | desktop 8.6–9.0 → 9.4–9.8 ms (≤ +1 ms, scheduling noise at the 120 Hz cap); mobile 8.9–9.0 → 9.1–9.3 ms |
| Glasgow stop 11 | ~508 → ~508 | 855.3k → 845.5k (−1.1%) | ~164 → ~167 | 231.8k → 228.0k (−1.6%) | desktop 8.6–8.8 → 8.7–9.2 ms; mobile 9.2–9.3 → 9.2–9.3 ms |

Zero console errors. Known limits: closed hull (no visible interior through the glass); no door seams or roundel; Glasgow livery is a palette only (no silver front swoosh) by design.
