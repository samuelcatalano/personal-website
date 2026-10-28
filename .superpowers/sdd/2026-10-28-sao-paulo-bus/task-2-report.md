# Task 2 — São Paulo hero integration

## Result

Implemented the São Paulo GLB for the reverse UK-to-Brazil crossing. First/restarted Brazil entry keeps Mini; the forward crossing at exact `swapAt(stops)` preserves Mini → London → Glasgow → London. Crossing back below the same boundary selects São Paulo from London or Glasgow. São Paulo remains latched while in Brazil and the next forward crossing selects London. Shared route pose, wheel-distance update, fade path, underpass interval, and the original procedural fallback remain in use.

The existing axle splitter now recognizes the six empty São Paulo axle markers, separates embedded tire/rim triangles into three axle groups, and uses the source tire radius for signed route-distance roll. Loaded dimensions and front/rear beam anchors come from GLB bounds. Mini steering and ambient traffic are unchanged.

The source asset contract is 6,437 triangles across 8 role meshes. Blender bounds are 16.758 × 2.634 × 3.101 m; Three.js Y-up bounds are 16.758 × 3.101 × 2.634 m. Axle extraction moves wheel triangles into axle groups, while 120 generated disc triangles replace removed wheel triangles; the runtime therefore remains exactly 6,437 triangles. The browser assertion pins that exact total and the 12-mesh cap.

The follow-up fix initializes all hero candidates hidden and centralizes candidate visibility updates, so restored UK positions and reduced-motion swaps cannot leave São Paulo visible. The scene uses the tested object-returning selector and signed wheel-roll helper; browser assertions cover both forward and reverse roll on the extracted São Paulo axles.

The shared-pose review follow-up adds `createHeroGroup` and `applyHeroPose` in `scene.js`; the runtime uses both helpers, and the browser assertions exercise those same helpers with Mini, São Paulo, London, and Glasgow candidates to verify shared parent position and heading. Direction-state assertions cover initial Mini, the outbound sequence, reverse London/Glasgow → São Paulo, São Paulo latch, reset, and exact-boundary behavior. The source mesh-count and exact triangle-preservation assertions are retained.

## Files changed

- `js/world/vehicle-assets.js` — asset registration, palette, marker-driven wheel split, bounds metadata.
- `js/world/scene.js` — shared candidate group, selector wiring, route-distance wheel roll, exact-boundary fade.
- `js/world/layout.js` — small pure `heroVehicleAt` selector for boundary assertions.
- `tests/vehicles.browser.py` — desktop assertions for load/fallback, dimensions/grounding, axle extraction, triangle budget, shared materials, selector boundaries, underpass interval, and shared pose.

## Commit

Implementation and browser assertions: `4672201` (`Integrate Sao Paulo hero bus`), `b9692c4` (`Fix regional hero visibility and roll assertions`), `fe60ab0` (`Test shared hero pose wiring`), `25e5198` (`Make hero vehicle selection direction-aware`), `d74a9c2` (`Assert exact Sao Paulo geometry preservation`), and `628ced9` (`Correct Sao Paulo runtime triangle expectation`). The report is committed separately because this SDD folder is ignored by Git.

## Checks

`git diff --check` passed after each implementation update. Deliberately not run: any tests, browser suite, runtime/visual capture, mobile checks, or full regression. Task 3 owns consolidated desktop validation.
