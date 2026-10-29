# Blender asset pipeline (target architecture)

Status: **plan, nothing implemented** (2026-10-29). Runtime stays Three.js 0.169 / WebGL2, no build step, no npm in the shipped site. Roadmap and gates: `docs/plans/3d-asset-pipeline-roadmap.md`. Existing rules still win: `docs/architecture/3d-city.md`, `docs/architecture/rendering-budget.md`, `docs/art/asset-quality-spec.md`, `docs/art-direction.md`.

## 1. Principle

```text
PROCEDURAL LAYOUT (JS)  +  AUTHORED MODULAR ASSETS (Blender)
```

JS keeps: lot descriptors (source of truth), layout, positions, footprints, archetype, recipe, palette, deterministic variation, chunking, LOD switching, culling, day/night state.
Blender owns what the eye reads as quality: window/door depth, cornices, storefronts, roofs, props, vehicles, hero landmarks. No big-bang rewrite: each asset class migrates behind its existing descriptor and keeps the procedural version as fallback until its gate passes.

## 2. Audit of the current state (what the plan builds on)

| Area | Today | Gap |
|---|---|---|
| Runtime | Three 0.169 via importmap, ACES + custom grade pass, MSAA only on `high` tier, analytic glass reflection, one in-browser PMREM of `RoomEnvironment` | no HDRI, no AO, ACES desaturates (compensated by grade pass) |
| Buildings | procedural recipes → mass/trim/glass merged per 32×32 cell, 2 shared materials / 4 generated atlas maps (~4.3 MiB), LOD0/LOD1 (townhouse only) | facades are boxes + atlas texels: no real depth/silhouette, flat window reveals |
| Vehicles | Blender scripts under `tools/vehicles/*` → plain GLB. Mini F56 24.6k tris (sourced, CC-BY-NC-SA), cab 8.2k, DD bus 5.9k, SP bus, regional fleet. Runtime swaps GLB materials for shared semantic ones (`CarBody`, `CarGlass`…) | **no compression**: raw source GLBs in repo (e.g. `honda-hr-v.glb` 47 MB, `mini-cooper-2011.glb` 20 MB, `toyota-corolla.glb` 14 MB; several unreferenced), no LODs, one wheel-split hack in JS |
| Landmarks | procedural `landmark-geometry.js` (3 buckets each), Wellington statue GLB | silhouettes ok, surface detail flat |
| Trees | procedural leaf-card crowns, 1 atlas, 250k tri budget | no LOD2 impostor, no real trunk/branch authoring |
| Textures | canvas/procedural atlases; no KTX2 | memory and GPU upload cost scale with every new map |
| Light | sun + hemi + night glow emissive; no baked light | flat contact shadows, no AO |
| Asset hygiene | `ASSET_SOURCES.md` registry, build scripts per vehicle, `tools/capture.py`, GLB-aware tests | no manifest, no size/tri budget check, no reproducible optimise step |

Findings that change priorities:
1. Raw multi-MB GLBs in `assets/vehicles/` are the largest payload risk; Meshopt + KTX2 attack it directly.
2. Vehicles already have a working Blender → GLB loop, so a vehicle is the cheapest place to prove the full chain.
3. Procedural buildings are a good *layout* layer; only the module detail needs authoring.

## 3. Pipeline

```text
references (photos/blueprints, reference only)
  → Blender (modular source .blend, Python build scripts)
  → UV / PBR / bake (AO, optional curvature; no baked lighting)
  → raw GLB (export script, naming + extras)
  → glTF-Transform validate/inspect
  → dedup / prune / weld / (simplify for LODs) / meshopt
  → texture: resize → KTX2 (UASTC normals, ETC1S colour) with mipmaps
  → production GLB + manifest.json
  → tests (budget, manifest, load, material roles)
  → Three.js (GLTFLoader + MeshoptDecoder + KTX2Loader, shared materials)
  → LOD / instancing / chunking / culling (existing policies)
```

### 3.1 Tooling (all free/open source)

| Tool | Use | Cost / licence | Notes |
|---|---|---|---|
| Blender 5.2 LTS (installed) | authoring, bake, LOD generation, export | GPL | scripts run headless (`blender -b --python`) like today |
| glTF-Transform CLI | validate / inspect / dedup / prune / weld / simplify / meshopt / resize / KTX2 | MIT | needs Node + npm **on the developer machine only** (dev tool, never shipped); pin the version in `tools/pipeline/README.md`. Verify exact subcommands against the pinned version's `--help` before writing scripts |
| meshoptimizer (via glTF-Transform) | vertex cache/fetch, quantisation, compression | MIT | Three ships `MeshoptDecoder` in `examples/jsm/libs` (same pinned 0.169) |
| KTX-Software `toktx` (or glTF-Transform `ktx`/`etc1s`/`uastc` via the Basis encoder) | KTX2 / Basis Universal | Apache-2.0 / Basis Apache-2.0 | needs install; decoder (`basis_transcoder`) ships with Three's `examples/jsm/libs/basis` |
| Three.js addons | `GLTFLoader`, `MeshoptDecoder`, `KTX2Loader`, `GTAOPass`, `OutputPass`, `PMREMGenerator`, `RGBELoader` | MIT | all already in the pinned CDN version; no new dependency on the site |

Approval needed: installing glTF-Transform (npm) and toktx on the dev machine, since the repo is deliberately npm-free. Proposal: they live in `tools/pipeline/` with their own `package.json` that is **never deployed** (GitHub Pages serves only generated GLB/KTX2, which are committed).

### 3.2 Generated files are committed

There is no build step on Pages, so optimised outputs are committed. Sources and processed outputs stay separate and each output has a manifest row with source hash, tool versions, tris, bytes and texture sizes. Raw source GLBs that are not referenced by runtime move out of `assets/` (see Phase 0).

## 4. Directory structure (proposal, nothing moved yet)

```text
assets/
  processed/            # shipped, generated only (production GLB + KTX2)
    buildings/ vehicles/ landmarks/ vegetation/ public-realm/
  atlases/              # shipped shared atlases (KTX2)
  hdri/                 # shipped PMREM-ready env (small, CC0)
  lightmaps/            # shipped baked AO/static maps (KTX2), if adopted
tools/
  pipeline/             # export.py, validate.py, optimise.mjs, manifest.mjs, budgets.json, README
  <existing per-asset build scripts stay>
sources/                # NOT served (outside assets/); gitignored or Git LFS if sizes demand
  blender/ textures/ hdri/ raw-glb/
```

`assets/vehicles/*.glb` today mixes raw and shipped files; Phase 0 classifies each as shipped, source (move to `sources/raw-glb/`) or delete. Do not delete anything without the owner approving the list.

## 5. Asset classes

### 5.1 Buildings (archetypes: townhouse, mixed low-rise, midrise, office, tower)

Stays procedural: footprint, height, floors/bays, recipe choice, palette, which module goes in which bay, roof family, emissive state, chunk and LOD policy.
Becomes authored (Blender kit, exported as one `building-kit.glb` per region family):

| Module | Variants (start) | Tris LOD0 | Notes |
|---|---|---|---|
| window (sash/casement/curtain-wall unit) | 6–8 | 40–200 | real reveal depth + sill; glass quad separate for the glass bucket |
| door + storefront | 6 | 80–300 | awning optional as separate module |
| cornice / string course / parapet | 5 | 30–120 | extruded profiles, tiled by length |
| balcony / canopy | 4 | 60–200 | |
| roof set (gable, hip, flat + plant, mansard) | 5 | 100–400 | roof-top equipment kit (AC, stair core, water tank) |
| tower crown / podium | 6 | 200–800 | per tower family |

Combination: a bay grid per façade chooses modules by deterministic hash (stable local hash, never the global RNG). Modules are **instanced per chunk** (one `InstancedMesh` per module-material pair per cell) *or* merged into the existing mass/trim/glass buckets when the count is low; the rule is "at most three conceptual buckets" stays for the *architecture* LOD. Decision gate in Phase 3: instanced-modules vs baked-merge, measured on draw calls and memory.
LOD: LOD0 uses modules; LOD1 keeps the current simplified profile (modules with trim stripped); far chunks use the existing procedural facade texture. Existing hysteresis (111/129) is reused unchanged.
Variation: palette via vertex/instance colour; window state via the existing emissive hash; geometry families reused, never cloned.

### 5.2 Vehicles

Per class budget (LOD0 / LOD1 / LOD2), runtime keeps semantic shared materials; rigs stay "wheel nodes FL/FR/RL/RR + origin at wheel centre" (hero steers FL/FR).

| Class | LOD0 | LOD1 | LOD2 | Textures | Notes |
|---|---|---|---|---|---|
| Hero Mini | ≤ 12k | 5k | 1.5k | none (vertex colour + shared mats), optional 512 AO | today 24.6k exceeds the hero budget |
| London cab | ≤ 8k | 3k | 1k | none / 256 AO | wheels as nodes |
| London bus | ≤ 9k | 4k | 1.5k | destination UV only | livery by material slots (London/Glasgow) |
| Glasgow bus | same GLB | | | | recolour only |
| São Paulo bus | ≤ 9k | 4k | 1.5k | none | |
| Generic cars (Corolla, T-Cross, Qashqai…) | ≤ 3k | 1.5k | 600 | none | ambient budget (asset-quality-spec) |
| Vans / trucks | ≤ 3.5k | 1.8k | 800 | none | |
| A330 | ≤ 4k | 2k | 800 | none | flyover, brief on screen |

Glass: tinted base + fresnel in runtime (already done); authored glass keeps a black frit border and a separate `CarGlass` primitive. Lights: lamp lens as separate primitive for emissive. Compression: Meshopt on geometry, no textures needed for most vehicles. Instancing: ambient cars share geometry and per-axle merged wheel geometry; LOD swap by distance bands (< 60 m LOD0, < 140 m LOD1, else LOD2/cull) once LODs exist.

### 5.3 Landmarks (hero)

Wembley, Big Ben/Parliament, Tower Bridge, MASP, London Eye, Riverside Museum, Estaiada, Sé, Wellington and the rest. Authored in Blender where silhouette or detail repeats (Big Ben, Parliament, Tower Bridge, Eye pods/spokes, Sé facade); procedural stays where it is already good (MASP frame, Estaiada deck sweep).

| Landmark | Approach | LOD0 tris | LOD1 | Texture |
|---|---|---|---|---|
| Big Ben + Parliament | authored | ≤ 12k | 4k | 1K atlas + AO |
| Tower Bridge | authored | ≤ 10k | 3k | 1K atlas + AO |
| Wembley | procedural + authored arch/roof detail | ≤ 9k | 3k | 1K |
| London Eye | procedural wheel + authored pods | ≤ 4k | 1.5k | none |
| Riverside Museum | authored | ≤ 6k | 2k | 512–1K |
| Sé | authored | ≤ 10k | 3k | 1K |
| MASP | procedural | ≤ 2k | | shared |
| Estaiada | procedural | ≤ 4k | | shared |

Silhouette rules: sightlines and heights frozen by the approved map; each landmark is judged first as a flat silhouette at 3 camera distances. Lighting: baked AO only (see §8); no baked sun.

## 6. PBR and textures

Channels: Base Colour (sRGB), Normal (linear), Roughness/Metalness packed (`ORM` or R/M only, linear), AO (linear, baked, mostly merged into ORM), Emissive (sRGB) only where needed (lamps, windows, signs).

| Size | Use |
|---|---|
| 256–512 | props, vehicle detail maps, impostors |
| 1K | building kit atlas, landmark atlas, vegetation atlas |
| 2K | only a hero landmark whose face fills > 400 px on screen at default camera |
| 4K | not worth it: cameras are far and the DPR cap is 1.5; revisit only for a hero closeup |

Texel density target: ~256–512 px/m on hero modules, ~64–128 px/m on mass (matched to on-screen height in `asset-quality-spec.md`, not to resolution fashion). UV rules: single non-overlapping UV0 for tiled modules; trim sheets allowed where tiled; lightmap/AO UV1 only where AO is baked; no mirrored UVs on normal-mapped surfaces; 4 px padding at the lowest KTX2 mip. Always ship mipmaps; set anisotropy from capabilities (capped).

### 6.1 Atlases: when yes / no

Use for: building kit (windows/doors/cornices share one 1K–2K trim atlas), vegetation (leaf/trunk), public-realm props, vehicle decals. Do not use for: hero landmarks with unique surfaces (own 1K), tiled floors/roads (tiling), any asset where atlas padding would break mipmaps at the distances used. Goal metric: fewer materials/texture switches without worse mip bleeding (check at the LOD1 distance).

### 6.2 KTX2 / Basis

```text
source PNG (linear/sRGB tagged) → resize to budget → mipmaps → Basis → .ktx2 → KTX2Loader (transcode to BC7/ASTC/ETC2 by device)
```

| Map | Mode | Reason |
|---|---|---|
| Base colour, emissive | ETC1S (small) or UASTC if banding visible | colour tolerates ETC1S |
| Normal | UASTC (+ RDO) | ETC1S wrecks normals |
| Roughness/Metal/AO (packed) | ETC1S, UASTC if gradients band | |

Colour spaces tagged on the KTX2 and the Three texture (`SRGBColorSpace` for colour/emissive, `NoColorSpace` for data).

## 7. glTF-Transform and Meshopt chain

Per file: `validate` → `dedup` → `prune` → `weld` (+ optional `simplify` to emit LOD files via a separate invocation, not in-place) → `meshopt` (EXT_meshopt_compression, quantisation tuned per attribute: positions 14–16 bit, normals 8 bit, UV 12 bit) → texture compress (KTX2) → `inspect` → manifest. Vertex-cache and overdraw optimisation come from meshoptimizer's `optimize` in the same step. Runtime: `loader.setMeshoptDecoder(MeshoptDecoder)` and `loader.setKTX2Loader(ktx2.setTranscoderPath(...).detectSupport(renderer))`. Do not invent flags: each script is written against the pinned CLI's documented options.

## 8. Lighting, HDRI, day/night

Runtime: one directional sun, hemisphere fill, HDRI/IBL for reflections only, a few dynamic lights (none new per building). Offline: **bake only static, time-of-day-independent data**: ambient occlusion (and curvature) into the AO channel. No baked indirect light and no baked sun/shadows, because the site has day AND night and a lightmap valid for one state would be wrong in the other. If a later gate proves value, add *neutral* indirect (grey-lit bake, scaled at runtime by hemisphere intensity) before ever considering two lightmap variants. HDRI: CC0 (Poly Haven), 1K–2K equirect → PMREM at load, stylised (low saturation sky, not photoreal), day env + dim night env interpolated by the existing `night` value (extends `updateVehicleEnv`).

## 9. Post-processing and colour

Minimum stack: tone map + grade (existing), subtle bloom (existing), GTAO (new, `high` tier only, half-res), atmospheric fog (existing, tuned), exposure. No DOF, chromatic aberration, heavy motion blur. Colour: output sRGB; evaluate AgX (built in Three 0.169) against the current ACES + custom grade; the sky inverse-tone code (`untone`) must be re-derived if the operator changes, so this is a measured decision in Phase 6, not a swap. Textures: colour = sRGB, data = linear. Emissive for night glow stays HDR-driven by the existing glow loop.

## 10. Vegetation and public realm

Trees: LOD0 authored 3D crown + trunk (1.5–3k), LOD1 simplified crown (600–900), LOD2 camera-facing impostor (2 tris, 512 atlas) beyond ~120 m; instanced; deterministic variation by hash; shrubs/flowers/planters as instanced modules; wind only if a shader-only sway proves cheap (probably not worth it).
Public realm classification:

| Item | Method |
|---|---|
| roads, kerbs, crossings, markings, sidewalks | procedural (data-driven, keep) |
| benches, bins, bollards, lamps, phone boxes, bus stops, planters, fences, signs | Blender authored, instanced, trim/props atlas |
| waterfront edge, steps | procedural + authored railings |
| fountains/statues | authored per landmark |

## 11. Blender automation

`tools/pipeline/blender/*.py` (headless): import → cleanup (apply transforms, merge by distance, normals) → naming convention (`Mod_Window_A_LOD0`, `Veh_Mini_LOD1`) → material normalisation to semantic slots → UV validation (overlap, padding, texel density report) → AO bake → LOD generation (decimate with preserved borders; shading checked) → batch export to raw GLB → metrics JSON (tris, materials, UV islands, bounds). Each asset keeps its own `build_*.py` as today; the shared library lives in `tools/pipeline/blender/lib.py`.

## 12. Budgets (hypotheses to benchmark, not guarantees)

| Class | LOD0 | LOD1 | LOD2 | Textures | Materials | Expected instances | Memory (GPU) |
|---|---|---|---|---|---|---|---|
| Building kit module | 40–800 | 50% | impostor facade | 1K–2K trim atlas | 1 shared | thousands | ≤ 20 MB KTX2→GPU |
| Vehicle ambient | ≤ 3k | 1.5k | 600 | none | ≤ 6 shared | ≤ 40 | ≤ 8 MB |
| Vehicle hero | ≤ 12k | 5k | 1.5k | ≤ 512 | ≤ 12 | 1 | ≤ 4 MB |
| Landmark | 2–12k | 1.5–4k | silhouette | 512–1K (≤ 2K hero) | 3–8 | 1 each | ≤ 30 MB total |
| Tree | ≤ 3k | 900 | 2 | 1K atlas | 2 | ≤ 400 | ≤ 6 MB |
| Public-realm prop | ≤ 200 | 100 | cull | shared atlas | 1 | hundreds, instanced | ≤ 4 MB |
| Lightmap/AO | n/a | | | 512–1K per hero, 256 per module | | | ≤ 16 MB |

Global ceilings: initial transfer budget for authored assets ≤ 12 MB gzip (target), no single GLB > 2 MB after Meshopt, total GPU texture memory ≤ 150 MB on desktop, frame p95 within the project's +1 ms desktop / +2 ms mobile regression limits (`rendering-budget.md`).

## 13. Performance rules and GO/NO-GO

Reuse: shared materials, instancing for repeated modules, spatial chunks, existing AABB LOD hysteresis, standard frustum culling, lazy loading of non-hero GLBs by region (Glasgow assets load as the bus approaches). Every phase ends with a paired A/B on the same shot: **GO** = p95 regression within limits, draw calls ≤ +10%, tris ≤ +15% unless visual gain is shown, zero console errors, tests green, payload within budget. **NO-GO** = any limit broken without a documented mitigation; rollback = keep the procedural/old GLB path behind a flag until the gate passes.

## 14. WebGPU

Not now. Experimental branch later: `WebGPURenderer` + same assets, benchmark vs WebGL2, decide. The main pipeline stays WebGL2-compatible (KTX2 and Meshopt are renderer-agnostic).

## 15. Asset sourcing

Order: CC0 → public domain → clearly permissive → self-authored/procedural. Record in `ASSET_SOURCES.md`: asset, source URL, author, licence, modifications, usage (and approval for NC/SA). **Open conflict:** the owner's 2026-10-27 decision allows Sketchfab and NC/SA assets with per-asset approval (Mini, cab and bus exist this way), while this plan's brief says "do not use Sketchfab". Until the owner confirms, new sourcing in this pipeline avoids Sketchfab; existing registered assets keep their rows. `.gitignore` already excludes `assets/models/source/`.

## 16. CI / build (future)

A single `node tools/pipeline/check.mjs` (no CI service required first): validate GLB, verify manifest hashes, enforce `budgets.json` (file bytes, tris, texture size, material count per class), list unreferenced GLBs in `assets/`. A GitHub Action can run the same script later; not part of this task.

## 17. Risks

1. Dev tooling (npm/toktx) in an npm-free repo → isolate in `tools/pipeline/`, never deployed.
2. KTX2 transcoder + Meshopt add decode time and a worker/wasm fetch → measure cold load; fall back to PNG/uncompressed below a size threshold.
3. Instanced modules vs merged buckets can raise draw calls/memory → Phase 3 gate.
4. Day/night vs baked light → AO only.
5. Licence provenance of sourced meshes (Sketchfab) → registry + owner approval.
6. Scope creep: migrating buildings citywide before the kit is proven → no citywide rollout without gate.
7. Concurrent tools editing the same repo (Codex and Claude) → single owner per phase, branch per phase.
