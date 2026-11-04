# Vehicle wheels: inventory, measurement and fix

Owner report: some ambient and parked cars have wheels that do not spin while moving, and others spin on a wrong axis or wobble.
Baseline: HEAD `145e6b6`. Measured by `tests/vehicles-wheels.browser.py` (createAmbient at route 0.3 and 0.75, 6 s at 60 fps) and by the GLB
geometry (`tools/vehicles/regional-fleet/measure_axles.py --json`), never by the catalog it audits.

## 1. Inventory: every vehicle in the pool

| Model (GLB) | Wheel source and detection | Pivot | Spin axis and radius used | Steering | Status at HEAD |
|---|---|---|---|---|---|
| hero Mini (`mini-cooper-2011.glb`) | authored nodes FL/FR/RL/RR under CarRoot, by name (`WHEELS`) | node origin = tyre centre (xy within 1 mm) | local z; r = node y 0.314 | FL/FR steer in `scene.js` (YXZ order) | correct |
| hero London bus (`double-decker-bus.glb`) | nodes FL/FR/RL/RR under BusRoot | origin = centre | z; r 0.445 | none | correct |
| ambient Mini | same nodes, one group per axle (FL pair, RL pair) | node origin | z; r 0.314 | none | correct |
| ambient London cab (`london-cab.glb`) | nodes FL/FR/RL/RR under CarRoot | node origin = centre (xy within 1 mm) | z; r 0.350 | none | correct |
| ambient London and Glasgow bus | nodes FL/FR/RL/RR | origin = centre | z; r 0.445 | none | correct |
| ambient São Paulo Caio (`sao-paulo-bus.glb`) | empty axle markers FL..TR (r 0.52) plus embedded wheel triangles | marker centre | z; r 0.52 | none | correct |
| Toyota Corolla (`toyota-corolla.glb`) | no nodes; tyres inside `Index_0_1` / `Index_1_1` / `Paint_Color`; by catalog axles | catalog x off by 9 cm | z; r 0.338 (tyre 0.321) | none | 8% of tyre triangles static, tyre bottoms 75 mm off the road |
| VW T-Cross (`vw-t-cross.glb`) | no nodes; `tyre`, `B_metal`, `chrome`; by catalog axles | catalog height 0.384 (tyre centre 0.333) | z; r 0.334 | none | 29% static, bottoms 97 mm off |
| Nissan Qashqai (`nissan-qashqai.glb`) | no nodes; `wluntai_x1`; by catalog axles | within 9 mm | z; r 0.342 | none | passes at HEAD (0% static) |
| Honda HR-V (`honda-hr-v.glb`) | no nodes; `Tires`, rims, brake rotors; by catalog axles | front catalog x off by 12 cm | z; r 0.345 | none | 15% static, bottoms 93 mm off |
| Range Rover (`land-rover-range-rover.glb`) | no nodes; `tire`, `material_21`; by catalog axles | front catalog x off by 9 cm | z; r 0.411 | none | 17% static (rims turn, tyre stays), bottoms 89 mm off |
| Mercedes E63 estate (`mercedes-e63-amg-s-wagon.glb`) | no nodes; `tire` (172 fragments), RIM.001/003, brake discs; by catalog axles | front catalog x off by 10.5 cm; group pivot 30 mm off | z; r 0.336 | none | 28% static |
| parked fleet (6 models) | the same GLBs on the hero path: tyres stay authored in the body | none | no rolling by design | none | static, correct |
| procedural fallback (sedan, hatch, suv, van; placeholder buses, cab and Mini until their GLB loads) | merged into `matte`, no groups | none | static by design (asserted by `vehicles.browser.py`) | none | only before or without a GLB |

No model turned on a non-axle axis and no steering was applied to any ambient wheel. The wobble is the partial split: part of a tyre
moved with the rim while the rest stayed in the body.

## 2. Root cause

`js/world/vehicle-assets.js` gives each fleet GLB's tyre triangles to the axle centre within one tyre radius (+5 mm) from `record.json`.
Those hand-entered axles drifted 1 to 12 cm from the real tyres, so each tyre was split by piece vote (>80% of its triangles inside the circle)
and most fragments failed, staying in the body. The axle pivot was also the bounding box of whatever was classified, so the partial split moved it.

## 3. Measured before and after (`tests/vehicles-wheels.browser.py`)

"static" = share of tyre triangles left in the body, as a share of all tyre triangles in the axle circles. "ω·r/v" = wheel turn per metre travelled × measured radius (1.0 is correct).

| Model | static before | static after | tyre bottom off road before → after | r used before → after (measured) | ω·r/v before → after | pivot vs tyre (after) |
|---|---|---|---|---|---|---|
| Toyota Corolla | 7.7% | 0.3% | 75 mm → 0 mm | 0.338 → 0.321 (0.321) | 0.949 → 0.999 | 0 mm |
| VW T-Cross | 28.6% | 0.0% | 97 mm → 0.0 mm | 0.334 → 0.333 (0.333) | 0.998 → 1.001 | 0 mm |
| Nissan Qashqai | 0.0% | 0.0% | 0 → 0 | 0.342 → 0.343 (0.343) | 1.002 → 0.999 | 1.1 → 1.1 mm |
| Honda HR-V | 15.1% | 0.0% | 93 mm → 0.0 mm | 0.345 (0.345) | 0.907–1.000 → 0.907–1.000 (bend) | 0 mm |
| Range Rover | 16.8% | 0.0% | 89 mm → 0.0 mm | 0.411 (0.411) | 1.001 → 1.001 | 0.1 mm |
| Mercedes E63 | 27.9% | 0.0% | 0.4 mm → 0.0 mm | 0.336 (0.336) | 0.994–1.001 → 0.994–1.001 | 30 mm → 0 mm |
| hero and ambient Mini, cab, London and Glasgow bus, São Paulo bus, parked fleet | 0% | 0% | 0 mm | unchanged | 1.000 | unchanged |

The Honda HR-V one-car range 0.907 is the bend lag in `ambient.js`: `rollWheels` runs before the car's yaw is eased, so on the tightest curves the
travel is projected onto the previous heading. It was present at HEAD and is unchanged; the test tolerance (0.9) passes it.

## 4. Fix

- `tools/vehicles/regional-fleet/measure_axles.py` (new, stdlib): reads each fleet GLB, finds tyre-sized wheel pieces in `wheelMaterials`
  and writes the axles into each `record.json` (`--write`), or prints them (`--json`). One rebuild step: `measure_axles.py --write`, then `catalog.py`.
- Six `record.json` axle blocks and `models.json`: measured front, rear, height, wheelRadius, halfTrack (for example Corolla front 1.291 → 1.381,
  rear -1.39 → -1.301, radius 0.338 → 0.321; E63 front 1.48 → 1.585, rear -1.24 → -1.304; HR-V front 1.38 → 1.26).
- `js/world/vehicle-assets.js`: the split pivot is the measured axle centre instead of the box of the classified triangles.
- `js/world/wheel-roll.js` (new, pure): `rollWheels` and `wheelRadius`, the same formula as before (`rotation.z -= distance / radius`),
  re-exported by `vehicle-assets.js` so `ambient.js`, `scene.js` and `underpass-traffic.js` are unchanged.
- `tools/vehicles/regional-fleet/README.md`: how the axles are produced.

## 5. Tests

- `tests/wheel-roll.test.mjs` (6 new, pure): turn = distance / radius, sign (forward negative, reverse unwinds), proportional to 1/r, centre
  height fallback, spin only on z, empty list. Failed on HEAD (module missing).
- `tests/fleet-axles.test.mjs` (6 new): each catalog axle matches the GLB tyre geometry within 1 mm. Failed on HEAD for all six models.
- `tests/vehicles-wheels.browser.py` (new): every type in the pool. Checks axis z, pivot within 10 mm of its own tyre and 5 mm of the measured
  centre, radius within 3% and 1 cm of the measured tyre, tyre bottom within 10 mm of the road, static share at most 0.5%, rolling within 10%
  per metre, parked groups do not turn, and omega·r/v within 0.9–1.1 in the moving run. BEFORE: 5 fleet models failing. AFTER: 19 static and 10 moving types pass.

## 6. Visual evidence

- `before-sheet.png`, `before-sheet-wheels.png`: Mercedes E63, 15 frames over 2 s at 1.2 m/s (about 29° per frame, so the sequence does not alias).
  The wheel sheet shows front and rear crops; the rim turns while the dark tyre band stays out of step in several frames.
- `after-sheet.png`, `after-sheet-wheels.png`: same sequence on the fixed code; tyre and rim turn together.
- `capture-wheel-sequence.py`: renders the sequence with the project's vehicle code (`browser-harness`); `FRAMES_ONLY=1` rebuilds the sheets.
  At the real route speed (10–13 m/s) the same frame interval would alias.

## 7. Not changed, known

- Procedural fallback cars keep merged, static wheels (existing test asserts it). They appear only before or without a GLB.
- The HR-V bend lag above (0.907 on the tightest curve). Left as is; within the 10% tolerance.
- Hero Mini steering and the hero bus were not changed; both pass the audit.
- The owner's "white crossover" cannot be identified from the audit alone. The Qashqai itself passes at HEAD; the white crossovers that fail are the HR-V and the T-Cross.
