# Asset sources

## Lossless vehicle delivery — 2026-11-06

The seven `assets/processed/vehicles/*.full.glb` files are losslessly compressed derivatives of the owner-approved Mini Cooper 2011 and the six regional fleet GLBs credited below. They retain the respective source licences and attribution obligations. The runtime prefers these derivatives and falls back to the original full-quality files on failure; the older simplified assets remain an explicit debug opt-in.

Generated with `tools/pipeline/compress-lossless.mjs` using the existing Meshopt tooling, with no geometry simplification, vertex quantization, normal changes, texture resizing or texture recompression. Round-trip checks verify vertex and image bytes, ordered triangles/winding (allowing cyclic index rotation), transforms, and material/rig metadata. The seven files total 81.33 MiB versus 127.25 MiB for their unchanged source GLBs. This is a delivery change within the owner's performance-fix request, not approval for new external models.

Every non-code asset that ships in this repository. External assets must be CC0/public domain or clearly permissive; ambiguous licence = not used. Since 2026-10-27, Sketchfab and NC/SA-licensed assets are allowed when the owner approves the specific asset; record the licence obligations (attribution, share-alike) in its row.

| Asset | Path | Source | Author | Licence | Use |
|---|---|---|---|---|---|
| Mini Cooper S Hardtop 2011 | `assets/vehicles/mini-cooper-2011.glb` | [Owner-supplied model](https://sketchfab.com/3d-models/mini-cooper-s-hardtop-2011-6db3d61688174cb5b82f0206e20c004f), approved 2026-10-29. Prepared in Blender by `tools/vehicles/mini-cooper-f56/prepare_mini_2011.py`: normalized scale/axes, pearl body/bonnet, red roof/mirrors, twin red bonnet stripes matching the previous Mini, four source-detailed wheel pivots; no decimation. | [Nieve5677](https://sketchfab.com/iori308408) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), retain attribution | Replaces the F56 for player and ambient Minis; legacy F56 asset retained unused |
| Park tree atlas (4 painted trees, 2 used) | `assets/trees/park-atlas.png` | Generated in-project 2026-10-19 (prompt in `assets/trees/README.md`) | project | Original, project-owned | Instanced tree billboards |
| Avatar / memoji | `assets/avatar.png`, `assets/memoji-wave.png` | Site owner | Samuel Catalano | Owner's own | UI + in-world figure |
| A330 airliner | `assets/vehicles/a330.glb` | Generated in-project by `tools/vehicles/a330/build_a330.py` (Blender, original geometry) | project | Project-owned | Flyover aircraft |
| Double-decker bus (London + Glasgow liveries) | `assets/vehicles/double-decker-bus.glb` | Original procedural model authored in Blender by `tools/vehicles/double-decker-bus-dd/build_bus_dd.py` (no third-party mesh since the 2026-10-29 rebuild; the earlier Sketchfab "London DD Bus" by jsa201077, CC-BY-4.0, is no longer used). | Original work | No attribution required. |
| Caio Millennium II on Volvo B10M articulated bus (São Paulo livery) | `assets/vehicles/sao-paulo-bus.glb` | Original model authored procedurally in Blender by `tools/vehicles/caio-millennium-volvo-b10m/build_sao_paulo_bus.py` from reference proportions of the real vehicle (no third-party mesh; replaces the earlier Sketchfab "CAIO MILLENNIUM VOLVO B10M" import by Dayzaplandia, CC-BY-4.0, which is no longer used) | Project (original work) | Original, no attribution required | São Paulo articulated bus hero and ambient visuals |
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
| Catedral da Se (Sao Paulo) | `assets/processed/landmarks/se.lod{0,1}.glb` | Generated in-project by `tools/landmarks/se/build_se.py` (Blender; original geometry and baked textures; reference descriptions only; external geometry: none) | Project-owned |

## Tower Bridge — 2026-10-29

| Asset | Path | Source | Licence |
| --- | --- | --- | --- |
| Tower Bridge (London) | `assets/processed/landmarks/towerbridge.lod{0,1}.glb` | Generated in-project by `tools/landmarks/towerbridge/build_towerbridge.py` (Blender; original geometry and baked textures; photos used as visual reference only; external geometry: none) | Project-owned |

## MASP — 2026-10-29

| Asset | Path | Source | Licence |
| --- | --- | --- | --- |
| MASP (Sao Paulo) | `assets/processed/landmarks/masp.lod{0,1}.glb` | Generated in-project by `tools/landmarks/masp/build_masp.py` (Blender; original geometry and baked textures; photos used as visual reference only; external geometry: none) | Project-owned |

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

## NPC POC (North Star, five skinned NPCs) — 2026-10-31

| Asset | Path | Source | Licence |
| --- | --- | --- | --- |
| NPC pack: NPC_A to NPC_E, one shared armature (53 bones), walk clip `NPC_Walk` | `assets/npc/npc_pack.glb` | Generated in-project. Bodies: MPFB 2.0.18 macros (`tools/npc/npc_bodies.py`). Walk: Quaternius UAL1 `Walk_Loop`, retargeted in world space (`tools/npc/npc_retarget.py`, `tools/npc/npc_walk_check.py`). Garments, hair and vertex colours: procedural (`tools/npc/npc_build.py`, `tools/npc/hair_styles.py`, project code). Rebuild with `NPC_OUT=<dir> NPC_UAL=<UAL1_Standard.glb> blender -b --factory-startup -P tools/npc/npc_walk_check.py`, then `-P tools/npc/npc_bodies.py`, then `-P tools/npc/npc_build.py`. | Derived. MPFB base mesh: CC0 1.0 (asset licence, checked 2026-10-31; the MPFB code is GPL-3.0-or-later and is not distributed). UAL1 animation: CC0 1.0 (Quaternius `License.txt` in the pack). |


### NPC textured pack (MakeHuman system assets) — 2026-11-01

| Asset | Path | Source | Licence |
| --- | --- | --- | --- |
| NPC pack v2: 21 people (NPC_A..L, NPC_O..T, plus 3 children NPC_KA/KB/KC on a second child armature `ChildRig` with clips NPC_Walk_C/2_C/3_C, built from MPFB child macros and the same UAL walk and CC0 MakeHuman assets, pack 10.0 MB; O..T reuse bodies of earlier people with other skin, hair and clothes), each a low-poly body proxy (male1591 / female1605) with a skin, a clothes suit, shoes, hair, eyebrows, eyelashes and eyes; one shared armature and the clips NPC_Walk/2/3 | `assets/npc/npc_pack.glb` | MakeHuman system assets pack (`makehuman_system_assets_cc0.zip`, official page https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html, every item listed as CC0; each .mhclo/.mhmat header: "explicitly released as CC0 in september 2020"). Fitted by MPFB 2.0.18 in `tools/npc/npc_mh_build.py`; textures downscaled (skin 1024, others 512, normals 256) and stored as WebP. Bodies, rig and walk clips as in the NPC POC row above. Assets used: skins young/middleage african/asian/caucasian; clothes male_casualsuit01-06, male_worksuit01, female_casualsuit01, shoes01-06; hair short01-04, afro01, long01, ponytail01, braid01, bob02; eyebrow001-012; eyelashes01; eyes low-poly (brown, brownlight, green, blue, bluegreen, lightblue). | CC0 1.0 (checked 2026-11-01 on the official pack page and in the asset files). |

### Owner-reference NPC — 2026-11-04

| Asset | Path | Source | Licence / permission |
| --- | --- | --- | --- |
| Samuel reference character, three skinned LODs, Idle/Walk | `assets/npc/reference/npc_lod0.glb`, `npc_lod1.glb`, `npc_lod2.glb` | Five owner-supplied photographs; local AssetFurnace 0.5.4 / Pixal3D single-view reconstruction, original-photo colour projection, owner-directed eye and abdomen corrections. Authoring scripts: `tools/npc/reference_*.py`, `assemble_reference_npc.py`, `fix_reference_eyes.py`, `compress_reference_glb.py`. Private sources/Blender masters under ignored `assets/models/source/realistic-npc-20261104/`. | Owner explicitly requested this likeness and clothing on 2026-11-04. Photos and Beatles shirt artwork are not declared CC0 or relicensed as standalone assets. No source photographs or model weights ship with the site. |
| Reconstruction / matting / enhancement tools | Local authoring only; not distributed | [Pixal3D](https://github.com/TencentARC/Pixal3D/blob/master/LICENSE), local `raven38/pixal3d-sv-q8_0-v1`; bundled [DINOv3 encoder](https://github.com/facebookresearch/dinov3/blob/main/LICENSE.md); [BiRefNet](https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE); [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE) x4plus | Pixal3D code/flow weights MIT; encoder separately under DINOv3 License (not MIT); BiRefNet MIT; Real-ESRGAN BSD-3-Clause. Owner approved the 63.9 MB Real-ESRGAN download explicitly; images remained local. |
| Reference rig donor and motion | Included as deform bones / retargeted animation in the character GLBs | MPFB 2.0.18 `game_engine` donor used only for weight/rig transfer, not visible likeness. Existing Quaternius Universal Animation Library 1 `Idle_Loop` and `Walk_Loop`, retargeted with the project helper. | MPFB base asset CC0 1.0; MPFB code GPL-3.0-or-later is not distributed. Quaternius UAL1 CC0 1.0, original `License.txt` checked locally. |

**2026-11-06 texture update:** the body sides and the sides/back/top of the head now also take colour from 13 owner-supplied turnaround views (8 body, 6 head; per the owner's note, AI-generated from the front photograph, so likeness in unseen angles is not guaranteed). Reprojected locally by `tools/npc/export_posed_uv.py` + `tools/npc/reproject_views.py`; front of body, back of body and the approved face keep their photo-derived texels. The views stay private (OneDrive folder and ignored scratch); none ship with the site.

Single-view inferred hidden geometry, staging height (1.78 m) and eye colour are documented in [the execution ledger](docs/plans/2026-11-04-realistic-npc.md). The character is an opt-in one-slot pilot (`?referenceNpc=1`), not a crowd-wide replacement.

### Authored tree models — 2026-11-03

| Asset | Path | Source | Author | Licence | Use |
|---|---|---|---|---|---|
| Mighty Oak Trees (three tree variants) | Excluded from runtime | [Owner-supplied model](https://sketchfab.com/3d-models/mighty-oak-trees-4f6ab5594a8a415aba3f958682b9ced5), conversion reviewed with `tools/vegetation/build_trees.py` | [Jagobo](https://sketchfab.com/jagobo) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), attribution required | Excluded after desktop review: all three converted crowns rendered as sparse, detached foliage fragments |
| Realistic Tree | `assets/processed/vegetation/realistic-tree.glb` | [Owner-supplied model](https://sketchfab.com/3d-models/realistic-tree-d989c0f801d847b9a74992ec4ddcfdfc), prepared and optimized with `tools/vegetation/build_trees.py` and `tools/vegetation/build_trees.sh` | [Daniel](https://sketchfab.com/danielpetrov) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), attribution required | Deterministic tree variant with LODs |
| Tree GN | Excluded from runtime | [Owner-supplied model](https://sketchfab.com/3d-models/tree-gn-40da979cb23f492583ec89c4196cff4e), conversion reviewed with `tools/vegetation/build_trees.py` | [TechArtBGN](https://sketchfab.com/TechArtBGN) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), attribution required | Excluded after desktop review: its thin foliage still reads as sparse twigs at game scale |

Use of the supplied tree assets was explicitly requested by the owner on 2026-11-03. The runtime uses the full-canopy Realistic Tree with two mesh LODs and one impostor; the supplied Mighty Oak and Tree GN sources remain recorded above but are excluded because their foliage reads as sparse at game scale. KTX2 texture compression and Meshopt geometry compression are applied by the local pipeline. The original source files remain owner-supplied and are not copied into the shipped site.

- `assets/npc/reference/npc_lod0.glb` is the closing character in `js/world/figure.js`, built from the owner's own reference photos, approved by the owner on 2026-11-04. Its `Wave` clip is procedural (`build_wave` in `tools/npc/reference_rig.py`) on top of the CC0 Quaternius Idle already recorded above.

## Tower Bridge references — 2026-11-07

The Tower Bridge GLBs are procedural. No external 3D model, texture or image ships with them. The references below informed proportions and parts; they are not redistributed.

- Elevation of the Tower Bridge, from R. Routledge, *Discoveries & Inventions of the Nineteenth Century*, 13th ed., 1900: [Wikimedia Commons, File:Tower bridge schm020.png](https://commons.wikimedia.org/wiki/File:Tower_bridge_schm020.png). Licence: public domain (PD-old, scan). Used for the tower and turret silhouette, walkway height, bascule leaves, Gothic lancets and span proportions.
- Official dimensions: [Top facts](https://www.towerbridge.org.uk/stories/top-facts-of-tower-bridge) and [Timeline](https://www.towerbridge.org.uk/stories/timeline-the-construction-of-tower-bridge). Used: crests about 63 m above road, walkways 42–43.5 m above high water, 61 m central span, bascule chambers 27 m high. Figures that conflict between sources (overall width, walkway height) were not used as hard inputs.
- Cross-check of spans: [Structurae, Tower Bridge](https://structurae.net/en/structures/tower-bridge). Not used as model inputs.
- Historical context: [Wikipedia, Tower Bridge](https://en.wikipedia.org/wiki/Tower_Bridge) (construction 1886–1894; Horace Jones and John Wolfe Barry).

Scale decision: the owner, 2026-11-07, kept the frozen envelope, so the bridge is drawn at K = 0.40 of real metres. A real-scale rebuild needs an envelope and sightline review first.

## Mercury Clipper independent asset — 2026-11-09

`assets/uber-boat/exports/uber_boat.glb` and `assets/uber-boat/blender/uber_boat.blend` are original procedural geometry and an originally rasterized 2K livery atlas, created at the owner's explicit request on 2026-11-09. No external 3D model, photograph or downloaded texture is embedded or redistributed. The owner's subsequent request authorized replacing all seven Thames boats with shared instances at uniform 0.40 scene scale, initially preserving their moorings and the river layout. The latest placement correction reduces the runtime fleet to five, only on the Thames, in opposite-facing lanes; Pinheiros and Clyde remain boat-free.

Primary reference sources: [operator fleet](https://www.thamesclippers.com/whats-on-board/fleet), [builder delivery dimensions](https://www.wightshipyard.com/single-post/2017/08/22/wight-shipyard-delivers-iconic-ferries-for-london), [operator Mercury photograph](https://www.thamesclippers.com/media/b3gjs0vs/mx102988.jpg?width=2000&quality=90), and [operator Hunt Mk II floorplan](https://www.thamesclippers.com/media/wm3nr2kw/hunt-mk-ii-floorplan.png). These are references only; their photographs/plans are not relicensed. The nine owner-supplied images were also inspected, with synthetic views subordinate to primary sources. Uber Boat and Thames Clippers branding remain their respective owners' marks and are not declared CC0. Full reference and uncertainty record: [asset reference notes](assets/uber-boat/references/README.md).
