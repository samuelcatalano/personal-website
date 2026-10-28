# Task 1 — São Paulo bus source GLB

## Result

**GO.** Built `assets/vehicles/sao-paulo-bus.glb` by importing and editing the supplied `CAIO MILLENNIUM VOLVO B10M` Sketchfab model by Dayzaplandia (CC-BY-4.0). The build script takes the source path with `--source`; it does not embed a private local path in the script or runtime. The attribution row is in `ASSET_SOURCES.md`.

The imported source had 79,618 triangles and an unrelated 38 m plane. The derivative removes that plane, bakes the orientation and scale into the source meshes, recalculates normals, grounds the origin, and applies the São Paulo lime-green body/dark window finish. Source dimensions indicate an articulated bus; the model-sheet reference also shows the articulation. The reimported mesh bounds are 16.758 × 2.634 × 3.101 m. GLB axes are +X forward, +Y up and +Z right.

The build removes the 14,144-triangle thin wheel-face mesh and two over-tessellated sub-wheel islands (12,992 triangles) from a dark source mesh; the source tire profiles and visible wheels remain. It decimates the remaining source geometry and exports 6,437 triangles after GLB reimport, below the 12k cap. No images or texture files are embedded. Materials use the established roles: `BusBody`, `BusAccent`, `BusGlass`, `BusMetal`, `BusRubber`, `BusSweep`, `BusTaillight`, and `BusTrim`.

### Livery correction after review

The first review rejected the blue livery because the approximate-offset ribbon floated across windows and the articulation. The rebuilt sweep is now projected onto the body, glass, and trim meshes by sideward raycasts, with a 6 mm outward surface offset. It follows x=2.8–6.4 m in the +X body section, crossing the dark window band into the lower body and ending before the articulation. It uses no external texture and adds only 120 triangles across both sides.

The correction and regenerated asset/render set are in commit `1de64d6`.

Six node extras mark axle pivots: FL/FR at x=+5.8 m, ML/MR at x=+0.75 m, RL/RR at x=−5.3 m; each side is y=±0.98 m, z=0.55 m, radius=0.52 m. The source keeps wheel geometry embedded in larger meshes, so these pivots are markers and are not yet parents of individual wheel meshes. Runtime wheel separation/rotation needs to use or replace these markers in the integration task.

## Validation and renders

Blender 5.2.3 ran the build, reimport validation, and final desktop renders:

```text
triangles=6437/12000
dimensions_m=(16.758,2.634,3.101)
grounded_z=-0.003
material roles: BusAccent, BusBody, BusGlass, BusMetal, BusRubber, BusSweep, BusTaillight, BusTrim
images=0; pivot nodes=FL,FR,ML,MR,RL,RR
```

The Blender validator passes for the triangle budget, dimensions, grounded origin, material roles, no images, and pivot extras. Final desktop review images are in `tools/vehicles/caio-millennium-volvo-b10m/renders/desktop/` (`front-34.png`, `side.png`, `rear-34.png`). I reviewed all three; the corrected livery conforms to the visible side surfaces and stays within one body section.

Rebuild and review instructions are in `tools/vehicles/caio-millennium-volvo-b10m/README.md`. Mobile capture and the website runtime were outside Task 1 and were not checked.
