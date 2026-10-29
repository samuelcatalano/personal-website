# Asset sources

Every non-code asset that ships in this repository. External assets must be CC0/public domain or clearly permissive; ambiguous licence = not used. Since 2026-10-27, Sketchfab and NC/SA-licensed assets are allowed when the owner approves the specific asset; record the licence obligations (attribution, share-alike) in its row.

| Asset | Path | Source | Author | Licence | Use |
|---|---|---|---|---|---|
| Mini Cooper S Hardtop 2011 | `assets/vehicles/mini-cooper-2011.glb` | [Owner-supplied model](https://sketchfab.com/3d-models/mini-cooper-s-hardtop-2011-6db3d61688174cb5b82f0206e20c004f), approved 2026-10-29. Prepared in Blender by `tools/vehicles/mini-cooper-f56/prepare_mini_2011.py`: normalized scale/axes, pearl body/bonnet, red roof/mirrors, twin red bonnet stripes matching the previous Mini, four source-detailed wheel pivots; no decimation. | [Nieve5677](https://sketchfab.com/iori308408) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), retain attribution | Replaces the F56 for player and ambient Minis; legacy F56 asset retained unused |
| Park tree atlas (4 painted trees, 2 used) | `assets/trees/park-atlas.png` | Generated in-project 2026-10-19 (prompt in `assets/trees/README.md`) | project | Original, project-owned | Instanced tree billboards |
| Avatar / memoji | `assets/avatar.png`, `assets/memoji-wave.png` | Site owner | Samuel Catalano | Owner's own | UI + in-world figure |
| A330 airliner | `assets/vehicles/a330.glb` | Generated in-project by `tools/vehicles/a330/build_a330.py` (Blender, original geometry) | project | Project-owned | Flyover aircraft |
| Double-decker bus (London + Glasgow liveries) | `assets/vehicles/double-decker-bus.glb` | [London DD Bus](https://sketchfab.com/3d-models/london-dd-bus-a2a2736856a7452bbbaf712e07ed8eb4) on Sketchfab, built by `tools/vehicles/double-decker-bus-dd/build_bus_dd.py`. Modifications: full source tessellation retained on visible bus surfaces, textures removed, hidden/internal non-visible faces culled (saloon preserved as a dark mesh), re-materialed to the runtime `Bus*` roles (new `BusStripe` slot), paint regions (skirt, swoosh, window frames) cut by exact planes, destination blinds and lamps rebuilt as decals, 64-segment tyres and 48-segment rims rebuilt with tread grooves, wheels re-rigged as FL/FR/RL/RR nodes. The Glasgow livery is an original stylised repaint from reference photos of a First Glasgow bus (lime front, white diagonal sweep, lilac band, violet rear; colour blocking only, no logos or text reproduced); extra Glasgow-only paint slots `BusSkirtF/BusSweep/BusLilac/BusRear` fall back to the London body/skirt colours. Source file is gitignored (`assets/models/source/`) | [jsa201077](https://sketchfab.com/unityjsa7) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/); attribution required: "London DD Bus" by jsa201077, modified (geometry filtered, re-materialed, re-rigged, repainted) | Player + ambient buses (replaces the procedural bus in `tools/vehicles/double-decker-bus/`) |
| Caio Millennium Volvo B10M (São Paulo electric livery) | `assets/vehicles/sao-paulo-bus.glb` | Sketchfab source metadata: "CAIO MILLENNIUM VOLVO B10M", modified by `tools/vehicles/caio-millennium-volvo-b10m/build_sao_paulo_bus.py` (hero transforms, mesh cleanup, semantic repaint, articulation bellows assigned to metallic `BusMetal`, and texture-free blue sweep; supplied high-resolution geometry preserved without triangle caps) | [Dayzaplandia](https://sketchfab.com/dayzaplandia) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/); attribute "CAIO MILLENNIUM VOLVO B10M" by Dayzaplandia, modified | São Paulo articulated electric bus hero and ambient visuals |
| Toyota Corolla 2020 | `assets/vehicles/toyota-corolla.glb` | [Toyota Corolla 2020](https://sketchfab.com/3d-models/toyota-corolla-2020-6d7d34ee42734d1ab28a6b1f1c5fc4fc), normalized and material meshes joined by `tools/vehicles/regional-fleet/prepare_source_glb.py` | ItsDiyor | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/); attribution required, modified | BR/UK ambient fleet |
| Volkswagen T-Cross 2021 | `assets/vehicles/vw-t-cross.glb` | [2021 Volkswagen T-Cross 280 TSI](https://sketchfab.com/3d-models/2021-volkswagen-t-cross-280-tsi-e7a833769e774e62a6500c294cb1aea6), normalized and material meshes joined by `tools/vehicles/regional-fleet/prepare_source_glb.py` | Ddiaz Design | [CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); attribution required, derivative remains CC-BY-NC-SA-4.0; modified | BR/UK ambient fleet |
| Nissan Qashqai 2018 | `assets/vehicles/nissan-qashqai.glb` | [2018 Nissan Qashqai](https://sketchfab.com/3d-models/2018-nissan-qashqai-ef3c5a9808b44b44ac600ad4431b8680), normalized and material meshes joined by `tools/vehicles/regional-fleet/prepare_source_glb.py` | Ddiaz Design | [CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); attribution required, derivative remains CC-BY-NC-SA-4.0; modified | UK ambient fleet |
| Honda HR-V e:HEV 2022 | `assets/vehicles/honda-hr-v.glb` | [2022 Honda HR-V e:HEV](https://sketchfab.com/3d-models/2022-honda-hr-v-ehev-e9128a46adc34e5e995ab7e8ad36339c), normalized and material meshes joined in Blender by `tools/vehicles/regional-fleet/prepare_source_glb.py` | [tonielpro520](https://sketchfab.com/tonielpro520) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/); attribution required, modified | BR/UK ambient fleet |
| Land Rover Range Rover Supercharged 2008 | `assets/vehicles/land-rover-range-rover.glb` | [2008 Land Rover Range Rover Supercharged](https://sketchfab.com/3d-models/2008-land-rover-range-rover-supercharged-43fe3d9855ef409892d976bd8850d819), normalized and material meshes joined in Blender by `tools/vehicles/regional-fleet/prepare_source_glb.py` | [Ddiaz Design](https://sketchfab.com/ddiaz-design) | [CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); attribution required, derivative remains CC-BY-NC-SA-4.0; modified | BR/UK ambient fleet |
| Mercedes-Benz E63 AMG S Wagon 2018 | `assets/vehicles/mercedes-e63-amg-s-wagon.glb` | [2018 Mercedes-Benz E63 AMG S Wagon](https://sketchfab.com/3d-models/2018-mercedes-benz-e63-amg-s-wagon-da7dc289aeee4c8590762a1218b1bc6d), normalized and material meshes joined in Blender by `tools/vehicles/regional-fleet/prepare_source_glb.py` | [SINNIK](https://sketchfab.com/sinnik) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/); attribution required, modified | BR/UK ambient fleet |
| Mini Cooper (F56) | `assets/vehicles/mini-cooper.glb` | [2014 Mini Cooper S (F56)](https://sketchfab.com/3d-models/2014-mini-cooper-s-f56-bec89391257c426d824a8b0434bbcf6b) on Sketchfab, built by `tools/vehicles/mini-cooper-f56/build_mini_f56.py` (owner-approved 2026-10-27). Modifications: filtered to visible parts without triangle decimation (~127.7k exported triangles), textures removed, re-materialed to the runtime `Car*` roles, bonnet stripes/roof/mirror caps split into `CarRoof`, 96-segment tyres with four shallow circumferential grooves, wheels re-rigged as FL/FR/RL/RR nodes. Source file is gitignored (`assets/models/source/`) (file removed from the repo 2026-10-29; rebuild with the listed script) | [Ddiaz Design](https://sketchfab.com/ddiaz-design) (owner's brother) | [CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); the derivative GLB stays CC-BY-NC-SA-4.0, attribute Ddiaz Design | Player Mini + ambient Minis |
| London Black Cab (LTI TX4) | `assets/vehicles/london-cab.glb` | [LTI TX4 London Taxi](https://sketchfab.com/3d-models/lti-tx4-london-taxi-9e57abf043744b86adbbc96083da637b) on Sketchfab, built by `tools/vehicles/london-cab-tx4/build_cab_tx4.py`. Modifications: decimated from 825k to ~8.2k tris, hidden faces culled, textures removed, re-materialed to the six runtime `Cab*` buckets with vertex colours (lamps white/amber/red, added amber roof-sign slab and radiator backing), tyres and rims rebuilt as revolves, wheels re-rigged as FL/FR/RL/RR nodes. Source file is gitignored (`assets/models/source/`) | [Nieve5677](https://sketchfab.com/iori308408) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/); attribution required: "LTI TX4 London Taxi" by Nieve5677, modified (decimated, re-materialed, re-rigged) | Four ambient London cabs (replaces the procedural cab in `tools/vehicles/london-cab/`) |
| Duke of Wellington statue | `assets/landmarks/wellington.glb` | Generated in-project by `tools/landmarks/wellington/build_wellington.py` (Blender, original connected sculptural geometry; supplied photos visual reference only; no reference pixels or external geometry) | project | Project-owned | Existing Glasgow statue visual; procedural fallback retained |
| Reference photos/sheets | `assets/models/source/ref/*` | Visual reference only, not rendered | — | Reference only; never shipped in-world | Modelling reference |
| Architecture atlas, clock faces, noise, sky discs, plaques, pedestrian atlas | generated at runtime (canvas) | Procedural, in-project code | project | Project code | Materials |

North Star upgrade (2026-10-21): city architecture and landmarks use procedural geometry built in code from visual references. The regional ambient fleet now uses the attributed Sketchfab models listed above. No external HDRIs were added.

## Regional traffic fleet — 2026-10-26

Six user-supplied Sketchfab models, normalized and batched in Blender by `tools/vehicles/regional-fleet/prepare_source_glb.py`. Supplied geometry and authored materials are retained; models are 155k–497k triangles with 6–31 source materials. Paint materials are tinted to the ambient metallic palette at runtime; wheels are split from source geometry for animation. Per-model attribution, source URLs, dimensions and wheel data are recorded in `tools/vehicles/regional-fleet/models.json`.

| Model | Asset | Region |
|---|---|---|
| Toyota Corolla (E210 sedan) | `assets/vehicles/toyota-corolla.glb` | BR, UK |
| Volkswagen T-Cross | `assets/vehicles/vw-t-cross.glb` | BR, UK |
| Nissan Qashqai (J11 facelift) | `assets/vehicles/nissan-qashqai.glb` | UK |
| Honda HR-V e:HEV | `assets/vehicles/honda-hr-v.glb` | BR, UK |
| Land Rover Range Rover Supercharged | `assets/vehicles/land-rover-range-rover.glb` | BR, UK |
| Mercedes-Benz E63 AMG S Wagon | `assets/vehicles/mercedes-e63-amg-s-wagon.glb` | BR, UK |


## Sky and weather — 2026-10-26

Sun/halo/full-moon maps are original runtime canvas generation in `js/world/sky.js`; clouds, stars, layered rain, puddles and ripple masks are original procedural shaders in `sky.js`, `rain.js`, `wet-surfaces.js` and `water.js`. Project-owned code; no external textures, geometry, HDRIs or reference pixels.

## Big Ben + Palace of Westminster river frontage — 2026-10-29

| Asset | Path | Source | Licence |
| --- | --- | --- | --- |
| Big Ben + Palace of Westminster river frontage | `assets/processed/landmarks/bigben.lod{0,1}.glb` | Generated in-project by `tools/landmarks/bigben/build_bigben.py` (Blender; original geometry and baked textures; photos used as visual reference only; external geometry: none) | Project-owned |

## Townhouse modular kit — 2026-10-29

| Asset | Path | Source | Licence |
| --- | --- | --- | --- |
| Townhouse facade module library | `assets/processed/buildings/townhouse-kit.glb` | Generated in-project by `tools/buildings/townhouse-kit/build_townhouse_kit.py` (Blender; original authored geometry and simple role materials; no external meshes or textures) | Project-owned |

Rebuild command: `blender -b --factory-startup -P tools/buildings/townhouse-kit/build_townhouse_kit.py`. Module names, counts, geometry, role hierarchy, and valid bounds are asserted by the generator; see `tools/buildings/townhouse-kit/README.md` for the coordinate and anchor contract.

## Shop and midrise modular kits — 2026-10-29

| Asset | Path | Source | Licence |
| --- | --- | --- | --- |
| Shop facade module library | `assets/processed/buildings/shop-kit.glb` | Generated in-project by `tools/buildings/shop-kit/build_shop_kit.py` (Blender; original authored geometry and simple role materials; no external meshes or textures) | Project-owned |
| Office facade module library | `assets/processed/buildings/office-kit.glb` | Generated in-project by `tools/buildings/office-kit/build_office_kit.py` (Blender; original geometry, role materials only) | Project-owned |
| Tower facade module library | `assets/processed/buildings/tower-kit.glb` | Generated in-project by `tools/buildings/tower-kit/build_tower_kit.py` (Blender; original geometry, role materials only) | Project-owned |
| Midrise facade module library | `assets/processed/buildings/midrise-kit.glb` | Generated in-project by `tools/buildings/midrise-kit/build_midrise_kit.py` (Blender; original authored geometry and simple role materials; no external meshes or textures) | Project-owned |

Rebuild commands: `blender -b --factory-startup -P tools/buildings/shop-kit/build_shop_kit.py` and `blender -b --factory-startup -P tools/buildings/midrise-kit/build_midrise_kit.py`.
