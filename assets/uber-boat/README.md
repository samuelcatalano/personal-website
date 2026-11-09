# Mercury Clipper — independent Blender / Three.js asset

Original reconstruction of **Uber Boat by Thames Clippers — Mercury Clipper, Hunt Mk II (2017)**, created and visually iterated in Blender 5.2.3 LTS on 2026-11-09. The source contains two separate lofted hulls, an open central tunnel, cambered canopy, swept passenger glazing, raised wheelhouse, access doors, railings, fenders, bollards, four raft canisters and lifebuoys, radar/aerials, navigation lights, wipers, an aft Red Ensign, and simplified passenger/bridge interiors.

The editable asset and standalone preview remain independent. At the owner's latest request, **five Thames boats** use this GLB at uniform **0.40 scale**: **14.148 × 3.454 m** in plan. They occupy two lanes at river centre ±4 m: three face +X (east) and two face −X (west). Placement ends at the London suburban edge, before the countryside/Glasgow stretch; Pinheiros and Clyde have no boats. The river layout is unchanged. Geometry, materials and the atlas are shared across all five instances. Loading failure keeps the procedural boats; a disposed scene cannot receive a late replacement. No dependency was installed and no commit or deployment was made.

## Files

| File | Purpose |
|---|---|
| `blender/uber_boat.blend` | Editable final source, 23 component mesh objects, six asset materials; separate studio camera/lights/ground |
| `blender/blockout.blend` | Preserved initial proportion checkpoint |
| `blender/uber_boat.blend1` | Blender's previous useful revision backup |
| `exports/uber_boat.glb` | Final independently loadable glTF 2.0 binary |
| `exports/metrics.json` | Actual source/export geometry and clean-reimport checks |
| `exports/uber_boat.sha256` | Checksum of the delivered binary |
| `textures/mercury_atlas.png` | Original 2048×2048 RGB bitmap livery, labels, flags and paint swatches |
| `textures/atlas_regions.json` | Named UV atlas regions |
| `scripts/build_uber_boat.py` | Reproducible modelling, rendering, export and reimport checks |
| `scripts/make_atlas.py` | Local Pillow/font rasterization of the atlas |
| `renders/{left,right,front,rear,top,front_3q,rear_3q}.png` | Seven final Eevee views; the first five are orthographic |
| `renders/reimport_front_3q.png` | Render made after importing the GLB into an empty Blender scene |
| `renders/blockout_*.png` | Initial inspected proportion checkpoint |
| `renders/browser/three_*.png` | Seven desktop Three.js captures of the final binary |
| `renders/browser/three-validation.json` | Desktop browser measurements and empty console-error list |
| `renders/integration/` | Day/night route and closer inspection views, plus live-scene on/off measurements |
| `references/README.md` | Primary sources, all nine supplied-image identifiers and uncertainties |

## Scale and measured geometry

| Metric | Final value |
|---|---:|
| Reference overall length | **35.37 m** |
| Reference moulded beam | **8.30 m** |
| Reference loaded draft | **1.03 m** |
| Export overall length × width × height | **35.370 × 8.634 × 6.930 m** |
| Lowest / highest Blender Z | **−1.030 / +5.900 m** |
| LOD0 unique triangles | **48,213** |
| Source component meshes / exported mesh nodes | **23 / 6** |
| Export materials / textures | **6 / 1** |
| Atlas resolution | **2048 × 2048** |
| GLB size | **2,481,368 bytes** (2.37 MiB) |
| Three.js draw calls, isolated visible asset | **7** |
| Three.js submitted triangles | **48,349** |
| Degenerate / duplicate triangles in source and imported GLB | **0 / 0** |
| Non-finite vertex/UV/normal values / non-unit exported normals | **0 / 0**, 61,165 normals checked |

The additional 0.334 m in total width comes from fenders/hardware outside the moulded hull beam. Height includes the mast and the modelled underwater hull. The origin is the vessel centre at the reference waterline: **Blender +X bow / +Z up; glTF +X bow / +Y up**. Place the GLB at `position.y = waterLevel`; no additional −90° conversion is required.

The six shared PBR materials are atlas paint, graphite structure, smoked marine glass, brushed aluminium, rubber fenders and seat upholstery. Glass uses standard alpha blending; no transmission render target, Blender-only shader or glTF material extension is needed. Its double-sided transparency accounts for the extra Three.js draw pass and 136 submitted triangles.

## Verification and visual corrections

The build executed in Blender, saved the editable source, rendered all required views, exported the six material batches, and reimported the GLB into a clean scene. Assertions check finite geometry, identical source/reimport triangle counts and bounds, six meshes/materials, one image, zero degenerate/duplicate triangles, and 15 upward ray samples through the unobstructed central tunnel. A separate binary-accessor check validated all exported positions, UVs and unit normals.

All nine supplied references and the seven final Eevee views were inspected. Iteration corrected the initial bow colour wedges, faceted lower hull outline, inward hull normals, paper-thin/angular canopy edges, occluded curved aft glazing, triangular wheelhouse haunch, missing rear bridge closure, undersized wordmark, a coplanar aft inscription and the front route board visible backwards from the stern. A final internal bridge partition/console prevents aft louvers reading as bars across the forward windscreen. Both side wordmarks now read outward correctly.

The final GLB was loaded in the existing Three.js environment at desktop **1440×900, DPR 1**, with WebGL available and **zero collected console errors**. Seven browser views were captured. The separate fixture is [`tools/vehicles/uber-boat-preview.html`](../../tools/vehicles/uber-boat-preview.html); validation is [`tools/vehicles/validate_uber_boat.py`](../../tools/vehicles/validate_uber_boat.py).

Three benchmark rounds each used 20 warmup frames and 60 measured samples per visible/empty state. These are **isolated render + `gl.finish()` wall times**, not GPU timer queries or city frame times:

| Round | Empty median / p95 | Boat median / p95 |
|---|---:|---:|
| 1 | 0.3 / 8.6 ms | 0.5 / 0.7 ms |
| 2 | 0.1 / 0.3 ms | 0.5 / 0.8 ms |
| 3 | 0.1 / 0.4 ms | 0.2 / 1.1 ms |

The empty-scene outlier demonstrates browser/OS scheduling noise. These observations establish a functioning, inexpensive isolated desktop preview on this machine; they do not prove an exact GPU delta or a full-city frame budget. LOD1/LOD2 were not generated: the measured single-asset fixture did not establish a need to trade away the validated silhouette. No placeholder LOD files exist.

## Rebuild and preview

From the repository root, using the installed Blender:

```sh
/opt/homebrew/bin/blender -b --python assets/uber-boat/scripts/build_uber_boat.py
```

To regenerate only the preserved initial blockout, pass `-- --stage blockout`. The ordinary build uses the included atlas; regenerating that atlas requires an existing Pillow environment and the macOS Arial/Helvetica Neue fonts named in the script. The environment used here was:

```sh
/Users/samuel.catalano/.local/share/uv/tools/browser-harness/bin/python assets/uber-boat/scripts/make_atlas.py
python3 -m http.server 8000
```

Open `http://localhost:8000/tools/vehicles/uber-boat-preview.html`. The preview is a developer fixture, not a user-facing city integration. Browser evidence can be regenerated using the existing `browser-harness < tools/vehicles/validate_uber_boat.py` workflow after starting the local server.

Runtime integration lives in `js/world/ambient.js`, using the existing `js/world/glb-loader.js`. The +X bow is rotated by 180° for the opposite lane; no negative scale or mirrored lettering is used. The origin follows the river waterline at Y=0.1; reduced motion keeps the vessels at rest. Once replacement completes, `scene.js` refreshes the river's five active foam envelopes and registers the six shared materials with the existing day/night environment. No additional reflection pass is added.

Desktop integration checks: `browser-harness < tests/thames-boats.browser.py` from the standalone preview and `browser-harness < tests/landmarks.browser.py` from the root preview. They cover all five replacements, two opposite lanes, London-only bounds, shared resources, retained anchors during GLB loading, uniform proportions, submerged lower hull, reduced motion, failed loading, late completion after disposal, and Tower Bridge clearance through the existing bob/pitch envelope. Three related Node tests passed for the latest placement adjustment. Actual London views were inspected at 1440×900 by day and night; 30 live frames per theme had no WebGL or collected JavaScript errors.

Before the subsequent five-boat/two-lane adjustment, the seven-boat London scene was compared twice with the ferries hidden/visible, at the same medium tier. Median RAF intervals were 28.2/27.7 ms and 27.9/26.8 ms; p95 was 34.1/32.3 ms and 31.1/30.5 ms. This noisy visibility comparison found no measurable slowdown; it compares added ferry cost against hidden ferries, not against the old procedural fleet, and does not establish a universal frame budget. That earlier evidence is in `renders/integration/scene-validation.json`; it is not a new benchmark of the five-boat placement. The closer inspection captures use a temporary QA camera; the site's camera code is unchanged. The later five-boat/two-lane placement was separately checked in `renders/integration/lane-validation.json` and captured in `thames-two-lanes-day.png`; its browser checks also verify full hull bounds inside London and opposite proa headings. The manual QA camera/reflection probe briefly produced WebGL INVALID_OPERATION; normal warmed-up frames recovered without code changes. The record distinguishes that diagnostic probe from the clean 30-frame steady-state sample.

## Known limits

- This is a detailed visual reconstruction, not a scan, licensed official CAD model or naval construction plan. Overall length, beam and draft are grounded in builder sources; height, exact tunnel sections, underwater lines and fine equipment arrangement are photo-derived approximations. The builder's **32.69 m waterline length** is recorded as a reference but is **not calibrated as an exact hydrostatic contour** in this mesh.
- A light tone/edge difference around parts of the large white wordmark panel remains visible at close range under studio lighting. It is cosmetic; the atlas text is an approximation of the original brand typography, not the official vector master.
- Interior seating, the bar/WC masses and bridge controls are deliberately simplified. The asset is not a complete passenger-capacity or machinery model. There is no rig, opening-door animation, wake or propeller simulation.
- EEVEE and the browser use different environment illumination/tone mapping; glass reflections can differ. Blender's default GLB importer uses dithered transparency, so the clean-reimport PNG can show a little grain that is absent from the source's blended glass and the browser.
- Mobile, Lighthouse, other desktop hardware and LOD switching were not tested. Runtime waterline placement and the existing river reflection pass were inspected; this is not hydrostatic simulation. The appropriate status is **GO for the five Thames replacements on the tested desktop scene**.
