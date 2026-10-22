# Mini Cooper asset

Original geometry built headlessly in Blender; the user's Mini sheet (front 3/4, front, side, rear) was visual reference only. External geometry: none.

| | |
|---|---|
| Generator | `build_mini.py` (`blender -b --factory-startup -P build_mini.py`), `render_mini.py` (10 views), `validate_mini.py` (face orientation per side) |
| Approved POC | `mini-original-poc.glb` — **frozen 2026-10-22** |
| Production asset | `assets/vehicles/mini-cooper.glb` (byte copy) |
| Dimensions | 3.82 m long, 1.73 m wide (mirrors extra), 1.44 m high; wheelbase 2.53 m; wheels Ø0.64 m |
| Axes / origin | three.js forward +X, up +Y, right +Z; origin on the ground, centred |
| Geometry | 6,012 unique tris (7,242 with 4 wheel instances), 4,110 verts, 5 meshes (Body, Roof, Glass, Lights, shared Wheel), 7 materials, 0 textures, 171 KB |
| Hierarchy | CarRoot → Body, Roof, Glass, Lights, Wheels → FL FR RL RR (pivots at wheel centres) |

Runtime (`js/world/vehicle-assets.js` → `upgradeMini`): loaded once, cloned per car with shared geometry; semantic materials (CarBody, CarRoof, CarGlass, CarTrim, CarChrome, CarHeadlight, CarTaillight) map to the shared project materials, so headlights/tail lamps glow at night via `sky.update`. Body and roof colours are per instance (player: cream + red roof; ambient London Minis: cream/red, racing green/white, red/white). Ambient Minis use one merged static wheel geometry; the player Mini's wheels spin. Only Body and Roof cast shadows. The procedural Mini remains if the GLB fails to load.

## A/B vs procedural Mini (3 runs each, rendering-budget contract)

| Scene | Desktop calls | Desktop tris | Mobile calls | Mobile tris | p95 |
|---|---|---|---|---|---|
| Hero (player Mini close) | ~439 → ~447 (+1.8%) | 884.3k → 872.9k (−1.3%) | ~170 → ~173 | 244.0k → 241.4k (−1.1%) | within run noise (9.5–10.2 ms both) |
| London stop 10 (ambient Minis + traffic) | ~675 → ~689 (+2.1%) | 1,075.7k → 1,084.2k (+0.8%) | ~180 → ~188 (+4.4%) | 244.8k → 248.2k (+1.4%) | within run noise |

GLB load ≈ 16 ms (cached after first load). Zero console errors.

Known limits: no interior behind the glass; rear plate recess is an outline; roof reads slightly wide straight-on; spoke definition weak (spokes and disc share CarTrim).
