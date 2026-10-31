# 3D city architecture

> **2026-10-21 update:** the user reopened the visual freeze for the North Star full-scene upgrade. Current state: [visual atlas](../audits/full-scene-visual-atlas.md), [plan](../plans/north-star-full-scene-upgrade.md). Vehicles, all landmarks (London Eye now continuous), lighting, roads and vegetation were upgraded; approved building families are unchanged. The coplanar-face blocker below is resolved (0 pairs).

**TOWNHOUSE SYSTEM = ARCHITECTURALLY VALIDATED**

## Final visual freeze — 2026-10-21

**VISUAL: GO — user approved and frozen. FUNCTIONAL: NO-GO. PRODUCTION-READY: NO.**

The requested declaration `3D CITY VISUAL SYSTEM = PRODUCTION-READY` is withheld pending the final technical gate: the coplanar-face regression fails (327 pairs in its generated fixture;191 also detected in live production box batches, including soil/stone planter edges in parks.js). No geometry was changed or waiver added to make the check pass. This is a concrete technical blocker, not a request to reopen visual development.

Approved delivered scope: townhouse/terrace, shop/mixed low-rise, midrise, office, tower; citywide rollout and deterministic diversity; hero/public realm, vegetation, lighting/atmosphere; shared glass, water; modernized Wembley, Big Ben/Parliament and MASP. No further visual work, rollout, optimization or new LOD is authorized. London Eye remains segmented by explicit decision.

**2026-10-29 exception:** the owner approved Asset Pipeline Phase 4. Tree LOD0/LOD1/LOD2 is authorized within the existing planting data and 160 m batches; this does not reopen building LODs, map/layout changes or broader city rollout. Runtime details are recorded in [the asset-pipeline architecture](blender-asset-pipeline.md#phase-4-runtime-slice--2026-10-29).

**2026-10-31 exception:** the owner reopened graphical work for all buildings and houses only. This supersedes the visual-work restriction above for architecture; map/layout, roads, routes, landmark positions/sightlines, vehicles, pedestrians, vegetation, props, global lighting, and mobile remain outside this authorization. The completed refresh is documented below.

Production flow and policies below remain authoritative. Dated boundaries and intermediate NO-GO notes are delivery history, superseded by the user's final visual approval. See [final measurements and release gate](rendering-budget.md#final-milestone-validation--2026-10-21) and [art direction](../art-direction.md).

Known limits: physical mobile not validated; WebGL/browser scheduling, runtime/GPU and random cloud counts affect observed metrics; submitted triangles include multiple passes, not unique geometry; London Eye remains segmented. No physical-VRAM or universal-FPS guarantee. Five smoke shots (main/skyline/Wembley/London/MASP) show no new visual regression; final technical release remains blocked as above.

## Source of truth and flow

Existing lot descriptors remain the source of truth: ID, kind, position, footprint and maximum height. Preserve generated map data, routes, landmarks, walking paths and logic. Replace the authorized lot's renderer, never layer duplicate buildings onto it.

```text
plot → deterministic recipe → local geometry → spatial chunk
     → mass / trim / glass → merged batches → shared materials/atlas
     → LOD → culling → render
```

- Two structural recipes and three palettes; deterministic window/emissive variation from local stable hashing. Do not consume the city's global RNG.
- Palette and window variation use vertex colors, aSurface and UVs; no per-building material/texture/uniform clones.
- Calculate architectural exposure using real neighbors **before** chunk partitioning. A chunk boundary does not make a party wall exposed.
- Spatial cells are 32×32. Merge local geometry by rendering policy, preserving positions, normals, UVs, aSurface, colors, indices when present, and computed bounds.
- At most three active renderables per chunk: mass, trim, glass. Keep material and texture identities shared across chunks and the control group.

## LOD and culling

LOD0 preserves the approved visual slice. LOD1 simplifies small trim, sills and profiles while preserving mass, silhouette, roof, facade rhythm, door/window placement, glass and material identity.

Each experimental chunk has three stable meshes and cached LOD0/LOD1 geometry. Switch mesh.geometry before any frame render pass; never rebuild/merge on a switch, clone materials, crossfade or render both levels together. Dispose active and inactive geometries on teardown. Shared materials/maps are not owned by an individual chunk.

Distance is camera-to-chunk **AABB**, not center distance:

| State | Rule |
|---|---|
| Initial | <120 → LOD0; >=120 → LOD1 |
| Outward | LOD0 → LOD1 only at >129 |
| Inward | LOD1 → LOD0 only at <111 |
| 111–129 | Preserve current level |

There is no approved LOD2 or visibility cutoff at 240. Keep standard Three.js frustum culling with frustumCulled=true and valid boundingBox/boundingSphere after merge. Active geometry bounds must be correct; the aggregate chunk AABB serves LOD selection. No custom occlusion/streaming system.

Do not set group.visible=false based on the camera frustum: camera, normal/GTAO and shadow rendering have separate visibility requirements. Use the existing normal/GTAO behavior, including opaque glass participation.

| Bucket | castShadow |
|---|---|
| Mass, including principal roof | true |
| Trim | false |
| Glass | false |

## Validated boundary and ownership

- Original control chunk: block-827--54-0/1/2, origin (820,−81), three houses. Its approved visual/geometry/batching behavior remains the control; it was not converted to the new LOD experiment.
- Chunk A: block-679--80-0..4; X [678,710), Z [−96,−64).
- Chunk B: block-712--80-0..3; X [710,742), Z [−96,−64).
- The nine experimental lots are each 6×9, maximum height12. Two new chunks plus the control make three chunks in this local validated area, not a citywide chunk migration.

Relevant modules: js/world/building-slice.js (recipes, geometry, chunks, LOD/disposal), building-slice-materials.js (shared materials/atlas), building-kit.js (allowlists and integration), real-city.js (assembly wrapper), scene.js (update before rendering and teardown). Existing map generators and post.js remain separate.

Historical designs under docs/superpowers/ preserve previous proposals. They are not instructions to repeat discovery, add five archetypes, download assets or expand the current validated implementation.

## Compatible citywide rollout — 2026-10-21

The user explicitly authorized this rollout after the hero region. The earlier dated rollout boundary above remains historical evidence, not a restriction against this authorization. Future redesigns still need scope approval.

`city-rollout.js` classifies existing descriptors; `building-kit.js` preserves all approved allowlists first, then routes compatible ordinary plots through deterministic recipes and 32×32 cells. Each occupied cell merges mass/trim/glass across compatible archetypes into three stable meshes using the same material identities. Bounds may straddle cell edges. Exposure uses the full source neighborhood. No map, route, landmark, lighting or public-realm layout changes.

- Terrace envelopes 4.8–12m wide, 7–12m deep, 6–16m high reuse townhouse geometry with a fitted 2/3/4-floor recipe. Existing benchmark profiles and buffers remain unchanged. Only these townhouse geometries receive the existing LOD0/1 simplification and AABB hysteresis. Other archetypes retain their approved detail at both cached chunk states.
- Shops use the approved commercial builder where its dimensions fit. Residential midrises normally require at least12m height (see the compact completion below); office at least12m; tower-compatible office/midrise envelopes require at least40m and9.8m width/depth. Special residential flats remain on the legacy renderer; never relabel them as shops to obtain coverage.
- Stable hashes vary shared-atlas vertex tints, opening/window states, office/midrise bays and lobby/base height, and tower chamfer/setbacks. No per-building materials/maps or global RNG consumption.
- The six remaining decorative Paulista towers expose their existing column/crown/antenna envelopes through the existing generator callback and use the same chunk pipeline in `landmarks.js`. The approved hero pair stays separate.
- New groups own only their cached geometries and dispose them once. `scene.js` uses the existing architecture update before all passes; no new renderer/LOD framework. No LOD2.

`createCityBuildings(plots, {rollout:false})` retains the baseline renderer for focused control tests. Production defaults to the compatible rollout. Legacy suites explicitly select that baseline; `tests/citywide.browser.py` verifies the production default, bounds, resources, chunks, determinism and approved controls.

Initial rollout coverage:358 newly converted ordinary plots plus6 existing decorative envelopes;35 previous approved buildings unchanged;92 low residential plots retained. The diversity/completion pass below supersedes these coverage totals.

## Diversity/completion pass — 2026-10-21

Historical intermediate result: this pass alone was VISUAL NO-GO. Subsequent Hero Zone diversity, art/material work and landmark modernization received final user visual approval; see the final freeze above.

- Citywide recipes add eight wall tints, six brick tints, roof/glass tints through existing vertex colors. Townhouses vary 2/3 bays where width permits, entry via the existing recipe, roof pitch and bands. Shops vary canopy/base treatment; their existing seeded bays/entries remain. Midrises vary bays, vertical/horizontal emphasis, base height and rooftop equipment; offices vary grid, spandrel proportion, pier treatment and equipment. Original approved allowlists keep their exact buffers.
- Towers use straight, stepped and asymmetric upper sections. A stable spatial ordering chooses a locally underrepresented family within42m; height/footprint remain fixed. No new archetype, materials or textures.
- Of92 previously generic residential lots: **A25** adapt safely to compact midrise recipes; **C56** use the same compact recipe without sills/floor bands at rear positions z<=−100; **B11** retain countryside/Glasgow identity. Compact recipes support6–12m envelopes, human entrances and reduced upper openings. They are residential, not reclassified shops. Exact preserved descriptors are recorded in the task coverage artifact.
- Coverage is now439 ordinary converted lots +6 decorative =445;35 approved controls remain;11 special generic lots remain. Existing data totals491 descriptors including decorative envelopes.
- Backdrop has no lot descriptors. Four inexpensive mass profiles replace repeated boxes/window boxes, using existing muted palette, instanced box buckets and existing fog. No facade modules, new lights or atmosphere changes.
- Existing parks receive stone paths, planter rims, slatted benches and lamp bases/caps at existing positions. Planting, circulation and the approved hero realm remain unchanged.

At this intermediate stage the Hero Zone frontage remained repetitive. The subsequent local facade pass and final user approval supersede that visual blocker; the backdrop remains deliberately inexpensive.

## Local Hero Zone facade diversity — 2026-10-21

The user authorized variation of the nine existing `SHOP_LOT_IDS` / `SHOP_INTEGRATION_IDS` around the initial-camera plaza. This supersedes their frozen-facade status only; no tower/skyline or citywide change. `heroShopRecipe()` in `shop-slice.js` selects four compositions from stable hash + lot position: broad plaster/stone, narrow vertical brick, commercial canopy/stepped parapet, and corner glazing/inset roof pavilion. Upper and storefront bays, central/lateral entries, window proportions, canopy, base/body surfaces and cornices differ geometrically; shared vertex tints complete the palette. All other shop callers retain the prior recipe.

The existing four merged batches stay at12 renderables,2 materials/4 maps. Nine-lot geometry falls10,906→8,874 triangles. Footprint/height ceilings and party-wall exposure remain intact.476 other architectural mesh fingerprints and the exact initial camera match the task baseline. Visual GO subsequently approved by the user; the facade system is now frozen.

## Architecture visual refresh — 2026-10-31

The owner authorized a complete graphical refresh across building and house families, reopening the architecture-only freeze. Existing plot descriptors, footprints, heights, route/layout, batching, shared materials, culling and LOD remain the source of truth. The initial refresh introduced twelve deterministic visual archetypes, selected from the plot ID and region:

- Townhouse/terrace: brick terrace, side-gable terrace, hip-roof terrace.
- Shop/mixed low-rise: high-street shop, wraparound shop.
- Midrise: stone tenement, banded apartment.
- Office: horizontal office, vertical office.
- Tower: straight, stepped, asymmetric.

Regional tinting covers São Paulo, London, countryside and Glasgow. Existing Blender kits gained restrained facade/roof details within their modules and three semantic buckets. The standalone house generator gained recessed openings, brick ground floors, sills and a roof ridge without changing its callers or seeded random sequence. Backdrop profiles and existing building-landmark materials were extended; Copan received eleven facade fins within its existing bounds. No external assets or dependencies were added.

Current desktop citywide measurement (`tests/citywide.browser.py`): 628 converted lots in 183 chunks; 549 active architecture renderables; 781,928 submitted geometry triangles; 142.35 MiB geometry attributes; 2 shared materials and 4 maps. The historical 2026-10-29 measurement was 794,730 triangles / 144 MiB, but it is not a same-commit baseline, so the difference is not attributed to this refresh. The five kit GLBs themselves increased by 896 triangles (+6.1%) and 96,000 bytes, with material/module counts unchanged. Frame time was not measured.

Targeted family tests, citywide bounds/resources/determinism, desktop console smoke and one six-view capture pass at stops 5, 9.5 and 11 (day/night) passed. Captures are machine-local under `/tmp/architecture-final/`. Physical GPU timing, mobile, rain variants, the full regression suite and individual facade close-ups were not checked; no production-readiness claim is implied.

## Architectural variety and infill — 2026-10-31

The catalog now has 24 geometry-backed profiles: the twelve existing styles plus twelve regional compositions. The city gained 24 separated urban lots and eight low rural rear-row homes. Placement uses the existing plot callback, regional rollout and shared mass/trim/glass chunks; the Copan source and geometry were not modified. New urban lot descriptors have unique IDs, deterministic profiles and no descriptor overlap; their positions remain outside the existing landmark, park and pedestrian masks. Selected desktop approach/pass/recede captures for São Paulo, London, Glasgow and Wembley were reviewed in day and night; the landmarks remained readable in those views.

`tests/citywide.browser.py` now reports 660 converted lots, 185 chunks, 555 architecture renderables, 830,256 submitted geometry triangles and 161.15 MiB of geometry attributes (2 shared materials / 4 maps). Against the previous documented sample of 628 lots, 183 chunks, 549 renderables, 781,928 triangles and 142.35 MiB, this is +32 lots, +6 renderables, +48,328 triangles (+6.2%) and +18.80 MiB (+13.2%). The geometry payload remains below the existing 180 MiB check. This is a structural before/after comparison, not a paired frame-time benchmark; frame time was not measured.

Focused Node tests passed 31/31. Desktop browser checks passed for the 24-profile catalog, visual-family diversity, citywide bounds/resources and the city builder; no browser errors were reported. The 14-view day/night route capture is under `/tmp/architecture-density-final/`; a four-view Glasgow recheck after correcting two profile assignments is under `/tmp/architecture-density-glasgow-final/`. Mobile, rain and physical-GPU timing were not checked.


## Final runtime inventory

The counts in this inventory are the 2026-10-21 snapshot. The 2026-10-31 citywide measurement and its live test results above supersede those counts for current rollout coverage.

- Existing descriptors remain source of truth:483 ordinary plots plus8 decorative Paulista envelopes.439 ordinary +6 decorative envelopes use the citywide pipeline;35 previously approved buildings (including the other2 decorative envelopes) remain controls, and11 special generic plots remain deliberately preserved.
- Citywide groups:148 occupied32×32 cells,444 active bucket meshes; all architecture including preserved/control groups totals488 mesh objects. The final validation does not alter any of their buffers, recipes, LOD, shadows or placement.
- Archetype modules remain separate; deterministic recipes/palettes/bay/window states use local hashes. Towers retain straight/stepped/asymmetric families; local Hero shops retain four facade compositions. No material per building.
- Shared architecture:2 materials/4 generated maps (~4.33MiB). Existing LOD0/1 applies to supported townhouse geometry; other archetypes retain their detail in both cached states. No LOD2. Existing AABB thresholds/hysteresis and standard per-pass culling remain unchanged.
- Public realm reuses existing paving, furniture, planting and circulation. Analytic opaque glass and two-triangle animated water reuse existing controls. No SSR, realtime cubemaps, new lights or renderer framework.
- landmark-geometry.js replaces only Wembley/Big Ben-Parliament/MASP with dedicated merged mass/trim/glass groups using the shared atlas. Three buckets each plus the existing clock InstancedMesh; owned geometry is disposed at world teardown. Sao Paulo's optional MASP callback replaces production geometry exactly once while preserving box-only callers.

## Tree and planting refresh — 2026-10-31

The owner reopened visual work for existing vegetation only. Five distinct procedural crown families are used in the existing 160 m tree chunks, with detailed LOD0/LOD1 and a family-matched atlas impostor at LOD2; tree placement, centers, clearance caps, update/disposal behavior, and landmark/path checks are unchanged. Existing park beds now use shared instanced low-poly flowers, shrubs, and hedges. Hero and countryside pocket gardens use the same low-plant geometry inside their existing footprints. `createBoxes`/`buildMeshes` owns park batches; `hero-realm.js` owns its merged inputs. No map, lot, camera, route, landmark, pedestrian, lighting, or mobile behavior was changed by this scope.
