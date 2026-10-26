# Asset sources

Every non-code asset that ships in this repository. External assets must be CC0/public domain or clearly permissive; ambiguous licence = not used. Sketchfab is never used.

| Asset | Path | Source | Author | Licence | Use |
|---|---|---|---|---|---|
| Park tree atlas (4 painted trees, 2 used) | `assets/trees/park-atlas.png` | Generated in-project 2026-10-19 (prompt in `assets/trees/README.md`) | project | Original, project-owned | Instanced tree billboards |
| Avatar / memoji | `assets/avatar.png`, `assets/memoji-wave.png` | Site owner | Samuel Catalano | Owner's own | UI + in-world figure |
| A330 airliner | `assets/vehicles/a330.glb` | Generated in-project by `tools/vehicles/a330/build_a330.py` (Blender, original geometry) | project | Project-owned | Flyover aircraft |
| Double-decker bus (London + Glasgow palettes) | `assets/vehicles/double-decker-bus.glb` | Generated in-project by `tools/vehicles/double-decker-bus/build_bus.py` (Blender, original geometry; reference images visual only; external geometry: none) | project | Project-owned | Player + ambient buses |
| Mini Cooper | `assets/vehicles/mini-cooper.glb` | Generated in-project by `tools/vehicles/mini-cooper/build_mini.py` (Blender, original geometry; reference images visual only; external geometry: none) | project | Project-owned | Player Mini + ambient Minis |
| London Black Cab (LEVC TX) | `assets/vehicles/london-cab.glb` | Generated in-project by `tools/vehicles/london-cab/build_london_cab.py` (Blender, original procedural geometry; supplied images visual reference only; external geometry: none) | project | Project-owned | Four existing ambient London cabs |
| Duke of Wellington statue | `assets/landmarks/wellington.glb` | Generated in-project by `tools/landmarks/wellington/build_wellington.py` (Blender, original connected sculptural geometry; supplied photos visual reference only; no reference pixels or external geometry) | project | Project-owned | Existing Glasgow statue visual; procedural fallback retained |
| Reference photos/sheets | `assets/models/source/ref/*` | Visual reference only, not rendered | — | Reference only; never shipped in-world | Modelling reference |
| Architecture atlas, clock faces, noise, sky discs, plaques, pedestrian atlas | generated at runtime (canvas) | Procedural, in-project code | project | Project code | Materials |

North Star upgrade (2026-10-21): all vehicles and landmarks are procedural geometry built in code from public visual references (official sites/Wikimedia photos consulted only as reference). **No external 3D models, textures or HDRIs were added.**

## Regional traffic fleet — 2026-10-26

Three original in-project Blender models, each built by a dedicated script in `tools/vehicles/<id>/` from public blueprints (getoutlines.com) and manufacturer brochures used as visual/dimension reference only; no reference image, external mesh or texture is shipped. Project-owned. Sources per model in `tools/vehicles/regional-fleet/models.json`. Runtime uses six shared semantic finishes, with body finishes cached by the existing traffic paint palette.

| Model | Asset | Region |
|---|---|---|
| Toyota Corolla (E210 sedan) | `assets/vehicles/toyota-corolla.glb` | BR, UK |
| Volkswagen T-Cross | `assets/vehicles/vw-t-cross.glb` | BR, UK |
| Nissan Qashqai (J11 facelift) | `assets/vehicles/nissan-qashqai.glb` | UK |

## Sky and weather — 2026-10-26

Sun/halo/full-moon maps are original runtime canvas generation in `js/world/sky.js`; clouds, stars, layered rain, puddles and ripple masks are original procedural shaders in `sky.js`, `rain.js`, `wet-surfaces.js` and `water.js`. Project-owned code; no external textures, geometry, HDRIs or reference pixels.
