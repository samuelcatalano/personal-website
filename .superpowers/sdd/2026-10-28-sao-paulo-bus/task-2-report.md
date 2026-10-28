# Task 2 — São Paulo hero integration

## Result

Implemented the São Paulo GLB as the Brazil-side hero vehicle. The existing shared route group, wheel-distance update, pose, and fade path remain in use; São Paulo is selected before the exact `swapAt(stops)` boundary, London at and after it, and Glasgow only during the existing underpass interval. The original procedural Glasgow vehicle remains the São Paulo fallback if its GLB fails to load.

The existing axle splitter now recognizes the six empty São Paulo axle markers, separates embedded tire/rim triangles into three axle groups, and uses the source tire radius for signed route-distance roll. Loaded dimensions and front/rear beam anchors come from GLB bounds. Mini steering and ambient traffic are unchanged.

The follow-up fix initializes all hero candidates hidden and centralizes candidate visibility updates, so restored UK positions and reduced-motion swaps cannot leave São Paulo visible. The scene uses the tested object-returning selector and signed wheel-roll helper; browser assertions cover both forward and reverse roll on the extracted São Paulo axles.

## Files changed

- `js/world/vehicle-assets.js` — asset registration, palette, marker-driven wheel split, bounds metadata.
- `js/world/scene.js` — shared candidate group, selector wiring, route-distance wheel roll, exact-boundary fade.
- `js/world/layout.js` — small pure `heroVehicleAt` selector for boundary assertions.
- `tests/vehicles.browser.py` — desktop assertions for load/fallback, dimensions/grounding, axle extraction, triangle budget, shared materials, selector boundaries, underpass interval, and shared pose.

## Commit

Implementation and browser assertions: `4672201` (`Integrate Sao Paulo hero bus`) and `b9692c4` (`Fix regional hero visibility and roll assertions`). The report is committed separately because this SDD folder is ignored by Git.

## Checks

`git diff --check` passed after both implementation commits. Deliberately not run: any tests, browser suite, runtime/visual capture, mobile checks, or full regression. Task 3 owns consolidated desktop validation.
