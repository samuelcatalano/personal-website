# London Black Cab — LEVC TX

Original deterministic procedural geometry, modeled from the three supplied visual references. External geometry/textures: none. See [reference analysis](REFERENCE-ANALYSIS.md) for recognition cues, dimensional source and left/right differences.

## Asset contract

| Metric | Frozen asset |
|---|---:|
| Production | `assets/vehicles/london-cab.glb` (byte-identical to `london-cab-original-poc.glb`) |
| Triangles | 9,546 |
| Exported vertices | 10,893 (normal/color splits included) |
| Meshes / materials / textures | 6 / 6 / 0 |
| GLB | 432,496 bytes |
| Length × width including mirrors × height | 4.857 × 2.036 × 1.888 m |
| Body width / wheelbase | 1.874 / 2.986 m |
| Axes | Blender +X forward / +Z up; Three.js +X forward / +Y up |
| Origin | Ground, centered lengthwise and widthwise |

Six single-material rendering buckets: CabBody, CabGlass, CabRubber, CabTrim, CabInterior, CabLights. All have normals and COLOR_0. Closed components are intentionally allowed to intersect; the topology validator checks winding, manifoldness, degenerates and bounds after export. No DoubleSide, missing side, textures, external geometry or animation nodes.

The 9,546-triangle asset exceeds the preferred 4–8k range but passes the explicit 10k hard ceiling. Most detail is shared in six buckets rather than separate object submissions. Body-only shadow casting keeps wheels, trim, glass and lamp details out of shadow passes.

## Rebuild and inspect

Run from repository root with Blender installed:

```sh
blender -b --factory-startup --python-exit-code 1 -P tools/vehicles/london-cab/build_london_cab.py -- tools/vehicles/london-cab/london-cab-original-poc.glb
blender -b --factory-startup --python-exit-code 1 -P tools/vehicles/london-cab/validate_london_cab.py -- tools/vehicles/london-cab/london-cab-original-poc.glb
blender -b --factory-startup --python-exit-code 1 -P tools/vehicles/london-cab/render_london_cab.py -- tools/vehicles/london-cab/london-cab-original-poc.glb /tmp/london-cab-renders --sheet /tmp/london-cab-renders/contact-sheet.png
```

The checked-in [ten-angle contact sheet](evidence/contact-sheet.png) records the frozen geometry, including both sides and rear. Renders use neutral studio lighting, not the city environment.

The build host had a macOS SharedFileList/OneDrive bookmark startup hang. A process-local workaround was used on a temporary Blender executable copy; installed Blender, user preferences and production code were not modified. This workaround is not a project dependency.

## Runtime

`vehicle-assets.js` uses the existing memoized GLTF loader and shared vehicle PMREM environment. `upgradeCab` clones only object state; all four natural traffic cabs share geometry and six cached materials. `ambient.js` adopts the visual after attaching the existing beams. Routes, spawn counts, speeds, brake glow, spacing and movement envelopes stay unchanged. The conservative procedural movement envelope (4.95 m length, front 2.55 m) is retained; the authored GLB has no scale correction.

Only CabBody casts shadows. CabGlass uses transparent front-facing closed panes with depthWrite disabled. The body is non-emissive dark neutral clearcoat. One vertex-colored CabLights material preserves white headlights, red tail lamps and amber roof sign; existing `updateVehicleEnv(night)` drives its emission. No new light, reflection pass, environment texture or LOD was introduced. Procedural fallback remains if the GLB cannot load.

## Validation evidence

With the local preview open in browser-harness:

```sh
browser-harness < tests/london-cab.browser.py
browser-harness < tests/vehicles.browser.py
node --check js/world/vehicle-assets.js
node --check js/world/ambient.js
git diff --check
```

Two browser contracts passed: `tests/london-cab.browser.py` (load, four-instance sharing, dimensions, lamp shader, cab-only night reflection floors, actual culling6→0, movement metadata and failure fallback) and `tests/vehicles.browser.py` (existing20-vehicle movement/spacing/reduced-motion contracts,4,500 simulated frames). Production GLB topology validator, JavaScript/Python syntax and `git diff --check` pass. No console errors in accepted A/B or final visual captures. Full regression and Lighthouse were deliberately not run.

Ten-view visual review: all ten angles GOOD after fixing buried front lamps, rear plate occlusion and duplicated rear lamp bars. All ten final studio images came from the same frozen production GLB. City captures: [normal day](evidence/day-normal.jpg), [near day](evidence/day-near.jpg), [medium day](evidence/day-medium.jpg), [normal night](evidence/night-normal.jpg), [near night](evidence/night-near.jpg), [rear night](evidence/night-rear.jpg), [medium night](evidence/night-medium.jpg). Detail captures alone use a temporary inspection camera and hide the content panel; normal captures retain the site's camera parameters/UI. Traffic is frozen only during paired visual captures, with two existing cab states separated on the existing London road. No production camera or traffic logic changed.

Initial night review showed weak body/glass separation. Cab-only PMREM reflection floors (body .16, glass .28, trim .18) retain readable non-emissive surfaces. Day settings and all other vehicle materials remain unchanged; roof sign/lamp emission follows the existing night update.

## A/B performance

[Raw results and protocol](evidence/benchmark.json). Baseline HEAD1519186 versus the cab integration; current bus/Mini/A330 remain enabled in both. Desktop1440×900 DPR1.5 high; emulated mobile375×812 DPR1 medium;2s warmup,10s sample. One accepted run per variant/device. Adaptive tier downgrade disabled in both temporary snapshots; no measurement/debug instrumentation was added to production.

The normal existing route camera follows a real oncoming cab. Two of the four existing cabs are initialized at route progress .45/.47 for a realistic same-lane fixture (no additional spawns). Headway stays8.19–22.84m; both cabs are actually submitted during sampling. Preliminary measurements without cab submissions, and an overly tight fixture, were rejected. This is a controlled traffic fixture, not an assertion that the default spawn offsets place two cabs in every view.

| Metric, median unless specified | Desktop A→B | Mobile A→B |
|---|---:|---:|
| Frame interval, ms |16.7→16.7|16.6→16.6|
| p95 interval, ms |17.6→17.5|20.4→19.8|
| Full-frame calls |741→731|217→213|
| Triangles/frame |1,149,376→1,175,968|279,475→291,095|
| Cab color/normal submissions, two cabs |28→22|14→12|
| Renderer geometries |356→355|243→242|
| Renderer textures |38→37|29→28|
| Scene unique materials |129→132|129→132|

The cab-only counter uses onBeforeRender, so it excludes shadow submissions. Whole-frame renderer.info counts include the full pipeline; CabBody alone is shadow-eligible. Cab asset itself adds zero textures; scene resident resource counts include unrelated dynamic scene resources. rAF/post-render intervals are browser cadence, not isolated CPU/GPU timings or a calibrated scientific benchmark. No frame-time regression observed in the tested runtime; physical mobile remains unvalidated.

Independent rebuild verification found exactly identical vertex attributes and the same9,546 oriented triangles; Blender can reorder triangle index records, so exported bytes need not be identical across rebuilds. The committed POC and production files are byte-identical. See [topology validation](evidence/topology.log).

**Standalone visual GO · Runtime day/night GO · Performance GO.** Geometry frozen; no new LOD infrastructure. Remaining limits:9,546 triangles exceed the preferred4–8k range while passing the10k hard ceiling; stylized simplified underbody/interior; emulated mobile only.
