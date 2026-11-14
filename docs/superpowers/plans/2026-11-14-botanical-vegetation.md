# Botanical vegetation realism

Owner explicitly reopens all vegetation quality, prioritizes realism before a later performance pass, delegates tooling/art choices and asks for internet references. Mobile remains excluded. Baseline commit `736377d`; unrelated `.codex/config.toml` is preserved. No automatic commit/push.

## Direction / binding constraints

Preserve all existing tree/plant centres, planting/lot footprints, heights/clearances, roads, pedestrian paths, landmark sightlines, weather/global lighting, architecture and HTML content. Existing procedural fallback and WebGL/reduced-motion paths remain usable. No dependency, downloaded model weights or unlicensed pixels/geometry. Reference photographs are temporary observation inputs only. Quality costs are measured/reported, never hidden by reducing selected realism.

Chosen approach: original deterministic Blender botanical tree families (oak, plane, birch, spruce, ipê), detailed small foliage and connected tapering branches; shared original leaf/bark textures; two physical mesh LODs at every range; 512px silhouettes retained only as authoring diagnostics. Keep a safe legacy fallback. Low planting becomes curved blades/leaves/twigs/petals in the existing normalized geometry contract. Turf gains fine material relief and subdued patches; no pale-base-skirt recolouring or displaced roots. Existing locations and layouts remain the source of truth. This directly addresses single-tree repetition, 128px silhouettes, octahedral shrubs and over-wide grass blades. Reusing the old 4.2k model alone cannot recover lost morphology; introducing a new engine is unnecessary.

Research: `/tmp/vegetation-realism-references.md` lists actually inspected photographs/URLs and botanical observations. Model author gets `/tmp/vegetation-realism/tree-author-brief.md`. Primary owns scope/runtime/ground design/integration and browser; read-only reference/ground reconnaissance were parallel, only one implementation agent runs at a time. No concurrent edits to a file or browser.

## Tasks / acceptance

- [x] Inspect runtime/consumers and available skills/tools, source photo references. Blender/browser-harness/Serena available; ctx_execute unavailable. Frontend skills applied to preserving content hierarchy/readability and visual consistency, not unrelated UI redesign.
- [x] Capture matched existing desktop city views before any production vegetation mutation.
- [x] Author/review original tree assets: deterministic build, finite normalized geometry/normals, five distinct porous silhouettes, read-back verification and multiple viewpoints. Record actual triangle/image/download costs.
- [x] Replace plant primitives with connected botanical detail and smooth finite normals, all kinds remain within x/z ±.5 and y 0..1, deterministic and ground anchored. Root/placement/circulation tests remain; replace obsolete exact 20-triangle assertions with new meaningful geometry/lighting checks.
- [x] Ground/plant material integration: diffuse/nonmetal, soft leaf transmission, architectural shade on grass, finer continuous turf detail with distance anti-aliasing. Existing paving/asphalt behaviour must remain.
- [x] Integrate five tree variants by region, correct texture × vertex colour, high-quality distance representation, matched silhouettes/ground feet, gentle wind/reduced-motion and shadow contract. No fallback silently substituted in captures.
- [x] Scoped browser/fixture tests first for new behaviours; full Node at milestone; real full-world day/night captures with actual loader/material/environment/postprocessing, errors/shaders checked, EN/PT fallback/reduced motion. No isolated-scene-only GO.
- [x] Final independent review, audit/evidence/current docs/asset provenance and explicit performance/quality limits. No performance optimization pass or mobile claims.

## Ledger

- Existing scene: original authored asset is capped at 4,200/1,100 triangles, 512px maps and 128px single impostor; runtime uses one generic family. Shrubs/hedges are octahedra; lawn tufts have five broad leaves and no received shadow. Current user authorization supersedes the older visual freeze for vegetation only.

- Low-plant regression failed against coarse legacy grass, then passed normalized bounds, finite unit normals, deterministic shape/colour variation and shadow receiving. Existing placement/obstacle test passes at 593 source plants / 10,157 grass clumps / 2,925,216 grass triangles. Hero203,076tri /5renderables /4maps, own vegetation material disposed once. New fine-turf shader compiled in real WebGL. Independent ground review APPROVE after fixing a higher-order derivative in distance fading and guarding zero differential normals.
- Botanical runtime regression failed on the legacy single-family renderer, then passed all five families, regional selection, source centres/crown caps, material/alpha masks, physical mid-range representation, shadow proxies, LOD selection and disposal. Original texture × vertex colour remains multiplicative.

- Final quality decision after quantitative failure: remove active impostors entirely rather than reduce colour/coverage expectations. Basic-material probes at high resolution confirmed faithful albedo; minification lost 3D foliage and changed the bark/leaf mix. Keep two full 3D levels throughout the route, preserve authored normals, and use linear leaf sampling + MSAA alpha-to-coverage. No hash noise, tint compensation or atlas download. A new regression failed against the three-level implementation, then passed five-family near/mid brightness (≤15%) and coverage guards; mid/far geometry, materials, luminance and coverage are identical. User expressly prioritised quality over this extra rendering cost.

- Final bounded gameplay-density pass increased existing leaf/spray size without adding branches/leaves/triangles; normalized envelopes read-back passed. Final model19,683,804bytes. Final actual five-family metrics:≤4.193% near/mid luminance difference,94.96–97.56% coverage, identicalphysicalmid/far. Consumer migration/GLB503fallback/disposal, streetscape, day/night130/150msweeps all pass. Four matched full-world views retain317trees/739plots withzeroJS/shader/GLerrors;v9/twophysicallevels/noatlas directlyconfirmed.267Node tests plusEN/PTfallback/PTreducedmotionpass. No pending review findings. Desktop visual/runtimeGO; no performance/mobile claim. No commit/push.
