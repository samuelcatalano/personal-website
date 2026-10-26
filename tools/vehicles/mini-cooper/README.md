# Mini Cooper asset

Original geometry built headlessly in Blender; the user's Mini sheet (front 3/4, front, side, rear) was visual reference only. External geometry: none.

| | |
|---|---|
| Generator | `build_mini.py` (`blender -b --factory-startup -P build_mini.py`), `render_mini.py` (10 views), `validate_mini.py` (face orientation per side) |
| Approved POC | `mini-original-poc.glb` — refreeze 2026-10-22 after the detail pass (see below) |
| Production asset | `assets/vehicles/mini-cooper.glb` (byte copy) |
| Dimensions | 3.82 m long, 1.73 m wide (mirrors extra), 1.44 m high; wheelbase 2.53 m; wheels Ø0.64 m |
| Axes / origin | three.js forward +X, up +Y, right +Z; origin on the ground, centred |
| Geometry | 26,026 tris with 4 wheel instances, 15,867 verts, 6 meshes (Body, Roof, Glass, Lights, Interior, shared Wheel), 10 materials, 0 textures, 611 KB |
| Hierarchy | CarRoot → Body, Roof, Glass, Lights, Interior, Wheels → FL FR RL RR (pivots at wheel centres) |

Runtime (`js/world/vehicle-assets.js` → `upgradeMini`): loaded once, cloned per car with shared geometry; semantic materials (CarBody, CarRoof, CarGlass, CarTrim, CarChrome, CarHeadlight, CarTaillight) map to the shared project materials, so headlights/tail lamps glow at night via `sky.update`. Body and roof colours are per instance (player: cream + red roof; ambient London Minis: cream/red, racing green/white, red/white). Every Mini's wheels spin: the player's per wheel, ambient Minis per axle (one merged geometry per wheel material per axle). Only Body and Roof cast shadows. The procedural Mini remains if the GLB fails to load.

## A/B vs procedural Mini (3 runs each, rendering-budget contract)

| Scene | Desktop calls | Desktop tris | Mobile calls | Mobile tris | p95 |
|---|---|---|---|---|---|
| Hero (player Mini close) | ~439 → ~447 (+1.8%) | 884.3k → 872.9k (−1.3%) | ~170 → ~173 | 244.0k → 241.4k (−1.1%) | within run noise (9.5–10.2 ms both) |
| London stop 10 (ambient Minis + traffic) | ~675 → ~689 (+2.1%) | 1,075.7k → 1,084.2k (+0.8%) | ~180 → ~188 (+4.4%) | 244.8k → 248.2k (+1.4%) | within run noise |

GLB load ≈ 16 ms (cached after first load). Zero console errors.

Known limits: rear roof lip reads slightly wide in rear 3/4; grille honeycomb is faceted shading; ~500 tris of budget headroom left.

## Detail pass — 2026-10-22

Real window openings with an interior (seats, dash, RHD wheel) seen through see-through `carGlass` (opacity 0.45); 2 cm plate recess with a raised plate; roof follows the greenhouse (≤ 1.5 cm overhang, rear lip only); graphite 10-spoke rims (CarRim) with thickness, dark disc, chrome lip and red calipers; raised bonnet scoop, honeycomb grille, projector headlamps, 32–36-segment lamps, smoother arches, shaped mirrors, handles, wipers, antenna. New roles: CarInterior, CarPlate, CarRim.

A/B vs the previous Mini GLB (3 runs): hero desktop calls ~445 → ~475 (+6.7%), tris 872.8k → 882.1k (+1.1%), p95 9.5–9.7 → 9.6–9.8 ms; mobile calls ~177 → ~182 (+2.8%). London stop 10 desktop calls ~688 → ~700 (+1.7%), tris +0.9%; mobile ≈ 0 calls, +1.6% tris. Zero console errors.

## Max-realism pass — 2026-10-22 (draw calls explicitly de-prioritised by the user; fluidity kept)

Geometry: dense smooth body/roof (no faceting at close range), real panel-gap grooves, slimmer rear spoiler with third brake light, honeycomb grille cells in a round-section chrome surround, headlamps with clear dome/reflector/projector/LED ring, domed tail lamps, bowed glass with black ceramic border, rounded tyres with tread band, concave spokes, arch liners, richer interior (bolsters, headrests, console, gear lever, centre display), wipers, antenna fin, diffuser fins, tow-eye covers. Fuel flap on the right side only.

Runtime finish (`vehicle-assets.js`): authored cars use `MeshPhysicalMaterial` — clear-coated paint, metal chrome/rims, reflective see-through glass — lit by one in-browser PMREM of three's `RoomEnvironment` (no texture download), applied only to these materials; reflection intensity drops 94 % at night (`updateVehicleEnv`).

Measured after the pass (3 runs, same harness): hero desktop median 8.3 ms, p95 8.7–9.1 ms, ~474 calls, 919.7k tris; mobile p95 9.1–9.3 ms, ~185 calls; London stop 10 desktop p95 8.6–9.0 ms, ~697 calls, 1,131k tris; mobile p95 9.0–9.2 ms. Zero console errors. Frame time stays at the 120 Hz cap.


## Glazing contrast refinement — 2026-10-23

The GLB and generator are unchanged: review found no demonstrated pane-fit, curvature, border or normal defect. The Mini-specific runtime glass now uses neutral smoky `#809096`, opacity `.58`, and a `.13` reflection floor at night; cabin surfaces use warm graphite `#655d51`. Existing paint, opening geometry and ceramic borders remain. The windshield and rear quarter glass read brighter in matched normal-camera day/night captures; side panes remain relatively dark at this view. Ambient Minis receive blue/green/red bodies before fallback construction; the player's cream/red identity is exclusive in pending, loaded and failure states.

Evidence: `/private/tmp/regional-fleet-pass/runtime-evidence/mini-{before,after}-{day,night}.png`, with identical 1440×900 viewport/DPR 1.5, and `mini-comparison.png` (enlarged crops of those original captures). No performance claim is made for this finish-only change; the regional-fleet milestone measures that separately.

## Glazing rebuild — 2026-10-26

Glass was a pale translucent grey-blue (`#7e939f`, alpha .55) with a 22 mm border, and boolean window-cut walls inherited the cutter's slot 0 (body paint), leaving cream slivers/hairlines around every pane. Now: deep smoky tint (`#1b2830`, alpha .78, roughness .04), 42/50 mm ceramic borders, panes 7 mm inside the surface (was 12), cut walls black. Tris 26,026 → 26,030. Before/after: `renders/glass-{before,after}.png` (+ `-zoom`). Suggested runtime `CarGlass`: colour `#2a3b44`, opacity `.80`, roughness `.06`, envMapIntensity `.45`.
