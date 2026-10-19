# Task 2: Render the protected benchmark lots

## Result

Replaced the pilot GLB loader and fallback in `js/world/real-city.js` with the reviewed procedural `createBuilding(plot)` kit. `buildRealCity` remains async, names the returned group `real-city-pilot`, and adds at most five building results. The three current source plots remain terrace, office, and midrise; their map bounds and clearance generation were not changed.

Updated `tests/real-city.browser.py` to verify all three plot kinds, plot fit and grounding, facade instancing, shared geometry and materials across repeated builds, the five-result cap, and no GLB requests during integration. Existing street, pedestrian-path, and landmark clearance checks remain in the focused browser test.

Removed `assets/city/pilot/` after searching for callers. The only remaining matches are historical plan notes; no runtime imports or requests point to the deleted directory.

## Verification

- RED check: revised assertions initially failed against the old GLB implementation because the plot kinds were not represented as procedural `userData.kind` values.
- `browser-harness < tests/real-city.browser.py`: passed. Three plots (terrace, office, midrise) fit their bounds; the test observed 5 shared meshes, zero newly issued GLB requests, no browser errors, and passing street-clearance checks.
- `node --test tests/`: passed, 93 tests.
- `git diff --check`: passed.

## Notes

The local browser tab had already loaded the three old GLBs before the focused test started. The browser assertion snapshots GLB resource entries immediately before the integration call and rejects any entries added afterward. The test also uses a timestamped module URL so repeat runs execute the current module instead of a cached import.

## Reviewer follow-up

Wrapped the browser test's temporary `console.error` override and window `error` listener in `try/finally`, so both are restored even if an awaited build or assertion fails. Re-ran `browser-harness < tests/real-city.browser.py` (passed: 3 kinds, zero new GLB requests, no browser errors) and `node --test tests/` (93 passed, 0 failed).
