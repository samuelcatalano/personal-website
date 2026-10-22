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
| Reference photos/sheets | `assets/models/source/ref/*` | Visual reference only, not rendered | — | Reference only; never shipped in-world | Modelling reference |
| Architecture atlas, clock faces, noise, sky discs, plaques, pedestrian atlas | generated at runtime (canvas) | Procedural, in-project code | project | Project code | Materials |

North Star upgrade (2026-10-21): all vehicles and landmarks are procedural geometry built in code from public visual references (official sites/Wikimedia photos consulted only as reference). **No external 3D models, textures or HDRIs were added.**
