# Task 3 — Backdrop and architectural landmarks

## Changes

- `js/world/backdrop.js`: added a fifth deterministic mass profile with an offset upper storey and roof cap. It reuses the existing palette and facade generator without consuming extra RNG values or changing row positions, footprints, or heights.
- `js/world/landmark-geometry.js`: added eleven slim vertical fins to the existing Copan facade. They use the existing trim bucket, preserve the tested group envelope, and keep the existing three-renderable count.
- `js/world/landmark-materials.js`: extended the existing coordinate masks from three to eight building regions: Wembley, Big Ben/Parliament, MASP, Copan, Sé, City Chambers, Riverside, and University. It reuses the current materials and shader finish. The existing authored Big Ben GLB and its source/output were not changed.
- Added focused assertions for the new backdrop profile and Copan's anchor, bucket count, and envelope.

`js/world/landmarks.js` was inspected and left unchanged: its landmark anchors and assembly already satisfy the protected transforms. No ordinary-building family/material module, map, route, new asset, or dependency changed.

## Exclusions

London Eye, Tower Bridge, Estaiada, boats, and the Wellington statue received no geometry or material edits. Other non-building props and city layout were left unchanged.

## Evidence and checks

- `node --test tests/backdrop.test.mjs tests/diversity-backdrop.test.mjs` — 6 passed.
- `browser-harness < tests/landmark-geometry.browser.py` — passed. Wembley: 7,476 triangles; Big Ben fallback: 2,488; MASP: 552; Sé: 4,720; Copan: 3 renderables, bounds x=[−77.33,−36.67], y=[0,38.40], z=[−54.90,−35.10]. Existing bridge, Eye, and lighting budget checks passed.
- `browser-harness < tests/landmarks.browser.py` — passed; existing bridge centerline, clock faces, boat clearance, City Chambers, and statue anchors retained.
- Desktop captures completed at stops 5, 9.5, and 11: `/tmp/architecture-task3/{5-day,9.5-day,11-day}.png`.

Node emitted its existing `MODULE_TYPELESS_PACKAGE_JSON` advisory for the parent package; all assertions passed. Mobile validation and the full regression suite were outside this task's requested checks.
