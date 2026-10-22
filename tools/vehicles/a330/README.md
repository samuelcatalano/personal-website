# A330 asset

Original geometry, no third-party mesh or texture.

| | |
|---|---|
| Generator | `build_a330.py` (`blender -b --factory-startup -P build_a330.py -- a330-original-poc.glb`) |
| Approved POC (immutable) | `a330-original-poc.glb` |
| Production asset | `assets/vehicles/a330.glb` (copy of the approved POC) |
| Runtime loader | `js/world/vehicle-assets.js` → `loadVehicleAsset('a330')`; `scene.js` swaps the procedural A330 body for it, keeping `nav`/`strobe`; the procedural model stays if loading fails |
| Axes / origin / scale | three.js forward +X, up +Y, right wing +Z; origin at fuselage centre; 40.1 m long, 38.2 m span, scene units = metres, runtime scale 1 |
| Geometry | 14,608 tris, 8,476 verts, 6 objects (12 glTF primitives), 6 materials, 0 textures, 312 KB |
| Shadows / culling / LOD | no shadow-map casting (ground blob shadow as before); standard frustum culling, bounds verified; no LOD (single instance, visible only around the first UK stop) |

In-scene A/B at the flyover (stop 6.75, procedural vs GLB, 3 runs each, `rendering-budget.md` contract): desktop high calls ~575→~588 (+2.4%), tris 1,058k→1,081k (+2.2%), p95 within run noise (8.8–9.2 ms both); mobile medium calls ~165→~170, tris 244k→256k (+4.8%), p95 9.0–9.1 → 8.9–9.0 ms. Zero console errors.

Known limits: night readability relies on scene ambient (no emissive cabin windows, by design); nav-light positions come from the procedural model (≤0.4 m from the GLB wingtips).
