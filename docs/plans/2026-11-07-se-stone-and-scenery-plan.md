# Catedral da Sé stone and procedural scenery — design and plan

Date: 2026-11-07 · Branch: `feat/site-gamefication` · Status: **draft for owner review**. This document changes no scenery. Front 1 has a partial source edit (§2.3). Nothing is committed.

Read with: [North Star plan](north-star-full-scene-upgrade.md) · [visual atlas](../audits/full-scene-visual-atlas.md) · [asset quality spec](../art/asset-quality-spec.md) · [rendering budget](../architecture/rendering-budget.md) · [art direction](../art-direction.md)

## 1. Intent

The Catedral da Sé is smooth stone, but its landmark texture shows a brick and mortar grid, day and night. The owner wants it removed (Front 1). The owner also wants every procedural system in the scene (houses, buildings, sidewalks, pavements, grass, benches, lamps) visibly better (Front 2). The procedural city is the frame the rest of the site depends on: map, lots, routes, sightlines and walking paths stay as they are.

## 2. Front 1 — Catedral da Sé: smooth stone

### 2.1 Cause
- The Sé is an authored GLB, baked by `tools/landmarks/se/build_se.py`.
- In `albedo()`, each `stone` and `trim` surface was multiplied by `blocks()`, an ashlar node (`ShaderNodeTexBrick`). That produced the mortar grid.
- The night emissive reuses the same albedo (`EMI` branch), so the grid also showed at night.
- `js/world/se-asset.js` loads the baked file only. No runtime change can remove the grid.

### 2.2 Goals
- No joint lines on any Sé stone surface, day or night.
- Keep: silhouette, string courses and rustication (architecture, not brick), soot and weathering, night-glow strength.
- Done when: normal-shot day and night renders show no joint lines; the LOD0 swap shows no pop or seam; `tests/se-asset.browser.py` and `tests/landmark-assets.browser.py` pass; no console errors.

### 2.3 State on 2026-11-07 (done)
- Source: `blocks()` and its use are removed. The tone is the old one (the `noise(3, 6)` ramp and the `noise(45, 3)` grain) times one flat factor per stone type: `.835` for `stone`, `.883` for `trim`. They are calibrated so the LOD0 albedo mean in linear light matches the old bake within 0.2%.
- Built: both LODs baked (`LITCHECK` 73/73 each), converted to `assets/processed/landmarks/se.lod{0,1}.glb` (LOD0 570 KB, was 629 KB), `GLB_V` set to `'3'`.
- Verified: close-up renders before and after, day and night (joints gone in both); `tests/se-asset.browser.py` passes; the Browser pane shows the Sé at journey stop 1.5 with no console errors.
- Not done: commit (owner's call).

### 2.4 Steps used
1. Rebuild both LODs: `blender -b --python tools/landmarks/se/build_se.py`. The `LITCHECK` lines (lit/total per LOD) must match the last run.
2. Convert each LOD with absolute paths: `tools/pipeline/landmark.sh $PWD/assets/models/source/se/se.lod$l.raw.glb $PWD/assets/processed/landmarks/se.lod$l.glb`, for `l` in 0 and 1. LOD1 is not fetched at runtime; it stays in step with its source.
3. Bump `GLB_V` in `js/world/se-asset.js` from `'2'` to `'3'`. Static hosts cache GLBs aggressively.
4. Render day and night: `blender -b --python tools/landmarks/se/render_views.py` (add `-- night` for night), then inspect the facade close-up.
5. Run `tests/se-asset.browser.py`, `tests/landmark-assets.browser.py`, and one capture at stop 5.
6. Commit only the Sé paths: build script, README, `js/world/se-asset.js`, processed GLBs.

The night glow reuses the same tone; checked at night too (close-up render, before and after).

## 3. Front 2 — procedural scenery

### 3.1 Goals
- Every system in §3.4 reaches **B+** or better on the atlas scale (A North-Star ready · B good · C below · D rebuild), measured on the atlas's 35 positions at Phase 7. Exception: the distant backdrop may stop at **B**, because it sits in haze.
- Signature results: tower and office glass reads cyan-blue, not grey; shopfronts carry colour accents; plazas and lawns gain tonal variety.

### 3.2 Non-goals
- No change to map, routes, stops, lots, heights, sightlines or landmark anchors.
- No pedestrians (separate `ped/*` track), no vehicles (done), no sky or weather (done), no landmarks beyond the Sé.
- No external 3D assets without owner approval.
- No townhouse redesign.
- No rollout beyond the regions already authorized.

### 3.3 Anti-goals (failures even when the build works)
- A frame-time drop on mobile, or extra draw calls per prop without batching.
- Shimmer or z-fighting at the normal shot.
- Props or planting that block a walking path or move crowd routes.
- Props in a visual language that clashes with the buildings.

### 3.4 Starting point
Source: atlas 2026-10-21 grades, M1–M5 progress log, 2026-11-03 recapture addendum.
- Already at B+ or better: roads and crossings, trees, planting, lighting and sky, vehicles, Copan, Riverside, University, and the landmarks other than the Sé.
- Still below B+: townhouse, shop, midrise, office and tower (all B); curbs and sidewalks, parks, benches and lamps, ground materials (B); plazas and grass (B-); distant backdrop (C).
- Later changes not yet re-graded: tree and planting refresh (2026-10-31), grass blades (2026-11-03). Re-grade in Phase 0 before any work.

### 3.5 Constraints
- Preserve map, routes, stops, landmark anchors, lot footprints and heights, sightlines, UI, content, accessibility, WebGL-off and reduced-motion behaviour (North Star global constraints).
- Approved families keep their geometry (North Star). Townhouse language is approved and not to be redesigned (art direction).
- Variation is deterministic: stable hash of position or id, never the layout RNG. The crowd sequence and `walkPaths` output stay as they are.
- Procedural only (North Star ruling). External assets need an owner go and an `ASSET_SOURCES.md` entry.
- Textures: generated canvases; mipmaps on; anisotropy ≤ 8; power-of-two; no new texture without a measured pixelation case (asset quality spec).
- Budgets: public-realm props ≤ 200 triangles each, instanced, 6–8 round segments; standard buildings 2 materials and 4 maps per family; townhouse LOD1 cuts geometry by at least 40% (nine-house benchmark, rendering budget).
- Git: implementers do not commit. The primary agent reviews and commits each phase with an `art:` message, naming paths (never `git add -A`). No merge into `main` without owner release.
- Shared checkout: Codex was densifying urban lots here (memory, 2026-10-31). The tree is clean today; confirm before Phases 4–5 touch houses, buildings or lots.

### 3.6 Phases
Each phase needs an owner go to start, and ends with: its tests, a console check, a before and after capture on the same positions, updated atlas grades, and the per-asset acceptance from the asset quality spec (readable within 1 s at its normal shot, no stair-stepping, no z-fighting, within budget, no new console errors).

| # | Phase | Scope | Main files | Tests |
|---|---|---|---|---|
| 0 | Re-baseline (read-only) | Stops 5, 9.5, 11 in day and night, plus Copan, Sé, Tower Bridge, Wembley; desktop 1440×900 and mobile 375 | atlas addendum, `docs/evidence/` | `tests/zfight.browser.py` (current state) |
| 1 | Pavements, sidewalks, plazas | Warm light pavers with joint-free variation, readable curbs, plaza tone, wet-surface contrast. No geometry change | `palette.js`, `textures.js`, `blocks.js`, `parks.js`, `wet-surfaces.js` | `real-city.browser.py`, `city.browser.py`, `wet-surfaces.browser.py`, `palette.test.mjs`, `zfight.browser.py` |
| 2 | Benches, bins, lamps | Rounded rebuilds of benches, bins, bollards, hydrants, markers and lamp posts, instanced by type. Placement and lamp spots unchanged | `street-props-mesh.js`, `street-props.js`, `lamp-mesh.js`, `lamps.js`, `street-lamp.js` | `street-props.browser.py`, `swap-plaza.browser.py`, `public-walks.browser.py`, `scenery.browser.py`, `wet-surfaces.browser.py` |
| 3 | Lawns | Lawn tone and variation on top of the existing grass blades; verge and bed edges. Footprints and walk rings unchanged | `parks.js`, `plant-mesh.js` | `parks.test.mjs`, `squares.test.mjs`, `gardens.test.mjs`, `plantings.browser.py` |
| 4 | Building materials and light | Materials only. Cyan-blue glass on offices and towers, warmer plaster, roof variety, shopfront colour painted into the existing facade atlas, night window glow | `building-slice-materials.js`, `facade-kit.js`, `shop-slice.js`, `tower-slice.js`, `office-slice.js` | `material-polish.browser.py`, `building-slice.browser.py`, `midrise-slice.browser.py`, `shop-slice.browser.py`, `tower-slice.browser.py`, `office-facade.browser.py`, `houses.test.mjs` |
| 5 | Geometry additions | Awnings, canopies, balconies or cornices, one family at a time. Needs a ruling per family (§3.7, item 1) | `tools/buildings/townhouse-kit/`, `kit-loader.js`, `kit-place.js`, `houses.js`, `building-kit.js` | `townhouse-lod.browser.py`, `townhouse-chunk.browser.py`, `building-kit.browser.py`, perf A/B |
| 6 | Distant city | Warm window-band and roof tones on the backdrop, in instanced buckets | `backdrop.js`, `country.js`, `hero-background.js` | `backdrop.test.mjs`, `backdrop-ground.browser.py`, `diversity-backdrop.test.mjs`, `sky-weather.browser.py` |
| 7 | Final validation | 35-position traversal, desktop high and mobile medium, EN and PT, day and night, WebGL off, reduced motion | evidence folder, atlas | `node --test tests/`, relevant browser suites, perf A/B |

Phase 1 comes first because it changes no geometry. Phase 4 is material-only, so it needs no geometry ruling.

### 3.7 Owner decisions (open)
1. **Geometry on approved families (Phase 5).** May awnings, canopies, balconies and cornices be added to townhouses and shops? If not, Phase 4 stops at paint.
2. **Codex.** Has its urban density work (memory, 2026-10-31) landed? If not, Phases 4–5 wait.
3. **External assets.** Stay procedural-only (current ruling), or allow licensed benches and lamps with `ASSET_SOURCES.md` entries?
4. **Approval cadence.** Approve the whole sequence now, or one phase at a time?

### 3.8 Calls made without the owner (check these)
- Location: `docs/plans/`, as CLAUDE.md and the North Star plan do. Not `docs/superpowers/`, which CLAUDE.md marks as historical. English prose, like the other repo docs.
- Order: lowest risk first (ground, furniture, lawns, materials, geometry, backdrop, validation).
- Grades: the atlas scale, with the one backdrop exception above.
- Colours: take them from `js/world/palette.js` and the art direction; the owner reviews the captures.
- Review: this document was checked against the constraints inline. No subagent (CLAUDE.md keeps subagents off by default).
- Nothing committed; the owner decides when.

## 4. Validation (every phase)
- Node: `node --test tests/` (full run before Phase 7; related files per phase).
- Browser: the per-phase suites, run with browser-harness.
- Captures: `OUT=<dir> SHOTS="5:day,11:night" GRID=1 browser-harness < tools/capture.py`. Add `MOBILE=1` for 375 px and `QUERY=weather=rain` for rain.
- Matrix: desktop and 375 px mobile; day and night; EN and PT; WebGL off; reduced motion; zero console errors. Lighthouse accessibility only if the UI changes (target ≥ 95).
- Performance: before and after on the same route with `tools/perf`, reporting renderables, draw calls and triangles.

## 5. Risks
- **Budget.** Citywide counts are already high (rendering budget, 2026-10-21 milestone: about 530k unique LOD0 triangles and 94 MiB of geometry). Each phase reports its delta.
- **Invariants.** Prop placement and lamp spots feed walk clearance and wet-surface masks. Change mesh internals only, never positions or RNG order.
- **Glare.** The 2026-11-03 night defects (Glasgow headlight glare, Eye pods, Riverside outline) are lighting items. Phase 2 must not move lamp glow.
- **Z-fighting.** The atlas recorded 0 coplanar pairs at commit 60d7670; memory recorded 1,085 at b4f7518. Re-check in Phase 0 before any ground change.
- **Sé night look.** The tone choice also changes the night glow, because the EMI branch reuses the albedo.
