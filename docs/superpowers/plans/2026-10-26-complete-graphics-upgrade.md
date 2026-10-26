# Complete City Graphics Upgrade — Proposed Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent, bounded implementation tasks, or superpowers:executing-plans for tightly coupled art tuning. Primary owns visual direction, scope, integration and final review. This document authorizes no implementation by itself.

**Goal:** Improve all eight visual priorities across the entire route: composition, horizon, asset consistency, volume lighting, regional identity, pedestrians, vegetation/public realm and night presentation.

**Architecture:** Extend the existing stylized city, shared materials, procedural scenery and instanced crowds. Solve composition through visual hierarchy inside existing envelopes; reuse the completed sky/weather and vehicle upgrades.

**Tech stack:** Plain ES modules, pinned Three.js 0.169.0, existing procedural/canvas/shader and Blender pipelines. No site build step or npm dependencies.

**Spec:** Owner's request in this conversation: graphics only, all eight priorities; economical model/tool use and bounded subagents. Existing visual language: `docs/art-direction.md`; resource rules: `docs/architecture/rendering-budget.md`; map/architecture boundaries: `docs/architecture/3d-city.md`.

**Status:** Proposed art direction and sequencing for owner review. Source inspection informs this plan; new baseline captures and visual diagnosis remain Phase 0 work. Do not interpret historical atlas grades as current defects.

## Approaches

1. **Recommended: coherent scene art pass.** Establish a whole-route visual target, then progress from composition/background through materials/light to people/public realm. Reuses existing assets and preserves structural constraints. Tradeoff: less freedom to fix shots through camera or map changes.
2. **Asset-first replacement.** Rebuild individual models before scene tuning. Tradeoff: expensive, can preserve the same composition problems, and risks mismatched detail. Reserve replacement for specific assets that fail silhouette review.
3. **Cinematic redesign.** Change cameras and scene layout as well as art. Tradeoff: strongest framing freedom, but disrupts route/UI relationships and exceeds the proposed preservation boundary. Requires separate explicit scope approval.

The owner has requested the plan, not selected an implementation approach. Approach 1 is the primary's proposal, not recorded owner approval.

## Global Constraints

- Graphics only. No content/UI changes, refactor program, documentation cleanup, new test infrastructure or deployment work.
- Preserve map, roads, route, stop anchors, lot footprints/heights, roof shapes, camera behavior, landmark positions and protected sightlines. Keep walking paths clear.
- Preserve the existing building families and asset identities. Improve materials, bounded details and silhouettes only where the relevant phase explicitly allows it; no citywide archetype rebuild.
- No new engine, SSR, cubemaps, render passes or shadow-casting lights. Reuse current shadow and post tiers. No external dependency without permission.
- Procedural first. External assets must be CC0/clearly permissive, never Sketchfab; provenance recording is part of accepting an asset, not a separate documentation project.
- Reduced motion keeps a complete static visual result. No added drift, twinkle, rain motion, flashing, pedestrian motion or vegetation animation in that mode.
- WebGL-off retains the existing HTML experience. Desktop/mobile and EN/PT panels remain unobstructed.
- Retain shared resources, at most three conceptual architecture buckets per chunk, existing LOD/culling behavior and bounded texture payload. Do not enlarge crowd atlases by default.
- Performance: paired total-plan A/B p95 regression at most +1 ms desktop / +2 ms emulated mobile against Phase 0, with locked tiers. These are cumulative ceilings, not an allowance for each phase.
- English code/comments/commits; pt-BR owner updates. Mark deliberate visual approximations with `ponytail:` and their ceiling. Commit accepted milestones after relevant checks; never push without instruction or discard preexisting changes.

## Shared Visual Review Contract

- Desktop 1440×900 DPR1.5 high; mobile 375×812 DPR1 medium. Use the actual application with its panel visible; add UI-hidden detail views only as supplementary evidence.
- Phase 0 and final traversal: every stop and half-stop, same route and fixed conditions. Intermediate phases: hero, São Paulo 5, London 9.5, Glasgow 11 and contact 17; expand where the phase changes other shots.
- Compare day/night and deterministic `?weather=clear` / `?weather=rain`; include one sunset transition and adjacent-region transitions. Pin the regional weather roll for any natural-weather traversal comparison.
- Compare the same camera, scroll progress, seed, theme, viewport/DPR, tier and settle time. A fractional stop must interpolate adjacent stop marks; do not pass 9.5 directly to the integer stop helper.
- Each phase shows a small BEFORE/AFTER contact sheet and records accept/rework for its visual criteria. Present it to the owner before expanding the treatment across all regions.
- Use existing checks relevant to changed behavior. New tests only for a new nontrivial behavior or a reproduced regression, never as an independent project. Preserve reduced motion, no-console-error behavior and resource cleanup.
- Full existing Node regression at milestones. Full paired performance at meaningful integrated gates and final: 2 s warmup, 10 s sample, three paired repeats per scenario, median/p95/run variation. Keep outliers; do not count adaptive quality reductions as improvement.
- Physical-phone and Safari results must be labeled unverified until actually checked. Browser scheduling/frame intervals are not isolated GPU timings.

## Review Focus

1. A fixed downward-looking camera can expose scenery edges or make background detail compete with the landmark: inspect moving transitions, not only stills.
2. A warm daylight treatment can crush night or storm visibility: inspect vehicle, pavement and pedestrian separation in all weather/theme combinations.
3. More vegetation/detail can hide the bus, entrances or protected landmarks: review the panel-visible mobile view and the full route.
4. A richer crowd can expose billboard turns, foot sliding, halos or excess texture cost: inspect walking and camera changes at both tiers.
5. Global palette/light changes propagate through sky, river, glass and wet reflections: review those surfaces together, including sunset and wet night.

## Phase 0 — Whole-route Visual Target and Baseline

**Files inspected, unchanged:** `js/world/camera.js`, `scene.js`, `layout.js`; current art direction and weather validation record.

- [ ] Capture the shared baseline matrix and a full-route contact sheet; identify current defects rather than repeat completed upgrades.
- [ ] Annotate each regional shot with primary subject, supporting shapes, foreground/middle/background separation, distractions and protected sightlines.
- [ ] Define three compact regional palette/material boards and one common scale/detail reference using existing scene assets. Golden daylight is the clear-weather target; rain keeps its approved storm identity.
- [ ] Select one representative fixed shot per region for look development, plus one difficult night/rain shot. Show the proposed visual target to the owner.

**Output consumed by every phase:** annotated shot list, regional boards, exact capture settings, baseline source revision and paired performance baseline. No scene changes yet.

## Phase 1 — Composition and Horizon

**Owners/files:** primary; `js/world/backdrop.js`, `hero-background.js`; `sky.js` and `mood.js` only for shared haze alignment.

- [ ] Establish quiet regions behind the vehicle and landmark by tuning background color, local contrast and detail frequency within current envelopes.
- [ ] Differentiate near skyline, middle silhouettes and far haze; reduce repeated silhouettes through bounded facade/detail treatment, not increased skyline height or moved lots.
- [ ] Refine finite-ground/horizon transitions and regional backdrop continuity. The existing backdrop already contains layered rows and detailed infill: enrich its hierarchy rather than add another scenery system.
- [ ] Review the moving route and mobile contact sheet; accept only if all target subjects remain legible and no ground edge, skyline seam or conspicuous repetition appears.

**Output:** approved background contrast/depth treatment inherited by all later phases. Camera changes remain outside this phase.

## Phase 2 — Asset Coherence and Regional Identity

**Files:** `js/world/palette.js`, `building-slice-materials.js`, `glass-reflection.js`, `landmark-materials.js`; targeted existing regional builders `saopaulo.js`, `glasgow.js`, `country.js`; vehicle finish in `vehicle-assets.js` / `vehicles.js` only after checking actual loaded visuals.

- [ ] Compare architecture, trees, crowd and vehicles at final screen size for saturation, roughness, edge softness and perceived scale; identify actual outliers.
- [ ] Establish a consistent material range for plaster, brick, stone, metal, asphalt and glass. Preserve variation through the existing shared resources and deterministic tint/detail mechanisms.
- [ ] Apply regional accents: São Paulo warmer concrete/plaster and varied facade rhythm; London brick, pale stone and restrained painted details; Glasgow sandstone and cooler subdued context. These are proposed art choices, adjustable after boards.
- [ ] Improve entrances, glazing and roof/facade readability through material contrast and existing detail slots. Do not change structural recipes, roofs or building envelopes.
- [ ] Review isolated outlier silhouettes. If material/detail tuning cannot solve one, propose a named replacement separately, with reuse/licence/resource implications, before rebuilding it.
- [ ] Accept when the three regions are distinguishable without text while their vehicles, people and buildings still belong to one visual world.

**Output:** stable regional material treatments; accepted asset-outlier list. Do not expand into new building families.

## Phase 3 — Volume Lighting and Surface Integration

**Files:** `js/world/sky.js`, `mood.js`, `post.js`, `water.js`, `glass-reflection.js`, `wet-surfaces.js`, `landmark-materials.js`.

- [ ] Tune existing key/fill, exposure and grading for facade depth, readable recessed openings and separated roofs; preserve existing light direction/shadow architecture.
- [ ] Keep shadows colored and readable, avoiding flat ambient wash and clipped warm surfaces. Match river, glass and puddle response to the actual sky.
- [ ] Check sunny, cloudy, rainy and sunset states together; retain completed celestial veiling, regional rain and wetness behavior.
- [ ] Accept only if vehicle/body shapes and architecture read at 375 px, highlights retain detail, and wet reflections support rather than overpower the street.
- [ ] Run the first integrated paired performance gate for Phases 1–3 against Phase 0 before adding crowd/public-realm richness.

**Output:** accepted common lighting response; night receives its final art pass in Phase 6.

## Phase 4 — Pedestrian Appearance and Human Scale

**Files:** `js/world/people.js`, `sprites.js`, `crowd.js`; `figure.js` only if the separate hero avatar is visually inconsistent.

- [ ] Review the current 28-look, multi-view walking atlas at actual screen size. Existing people are already animated instanced billboards; do not treat the hero Memoji as the crowd system.
- [ ] Improve silhouette, clothing values, body proportions, face simplification, grounded feet and shadow softness within the current technique and atlas budget. Increasing resolution is not the default solution.
- [ ] Improve apparent variety and group rhythm within existing placement/path slots, retaining path coordinates, crowd count, walking logic and clear entrances. Introduce no new behavior system; any actual redistribution needs a separate scope decision.
- [ ] Review facing changes, view transitions and foot contact in motion. Reduced motion must keep convincing stationary poses.
- [ ] Accept when individuals remain readable without white fringes, conspicuous twins, sliding feet or obvious flat-card turns in the representative views; retain a declared billboard ceiling where appropriate.

**Output:** accepted crowd style and distribution, coherent with Phase 2 materials.

## Phase 5 — Vegetation and Public Realm

**Files:** `js/world/tree-mesh.js`, `trees.js`, `parks.js`; existing regional furniture/planting builders only where needed.

- [ ] Refine crown silhouettes, trunk/canopy proportion, foliage value grouping and varied leaf density using the existing procedural tree families. Preserve canopy footprints/centers and the current 250k tree-triangle ceiling unless separately approved.
- [ ] Balance dense and open areas through existing bounded planting and understory; keep the bus, walking loops and landmark views clear.
- [ ] Improve how benches, planters, paving, beds and tree bases meet the ground through restrained material/detail treatment. Avoid uniformly scattering more props.
- [ ] Review repetition along the moving route, transparent foliage against sky, night foliage and static reduced-motion appearance.
- [ ] Accept when plazas feel intentionally arranged, planting has readable depth and contact, and no new obstruction or alpha shimmer dominates a shot.

**Output:** coherent vegetation/public-realm finish; no new park/layout system.

## Phase 6 — Night Hierarchy and Wet-night Finish

**Files:** `js/world/lamps.js`, `lamp-mesh.js`, `beams.js`, `sky.js`, `mood.js`, `wet-surfaces.js`, `water.js`, `post.js`; reuse existing emissive windows and landmark illumination.

- [ ] Establish brightness hierarchy: vehicle/landmark focal lights, supporting street pools, restrained occupied windows, dim background. Avoid uniform window glow and excessive bloom.
- [ ] Balance warm practical lights with cool ambient separation; keep dark vehicle paint, road edges and pedestrian shapes readable.
- [ ] Tune existing lamp/headlight pools, halos and analytic wet reflections together. Retain tier limits and acknowledge that reflections cannot reproduce scene geometry/occlusion.
- [ ] Preserve Glasgow drizzle, London rain and São Paulo downpour identities; do not increase flash strength/frequency or add new lights.
- [ ] Accept when both dry and wet night remain readable on mobile, light sources have visible cores, reflections feel connected to their sources and the bus remains the focal subject.

**Output:** integrated day/night/clear/rain look, completing all eight priorities.

## Phase 7 — Whole-route Visual Acceptance

- [ ] Repeat Phase 0's full traversal and contact sheets using the same conditions; review transitions and every region, not just selected attractive shots.
- [ ] Confirm all eight priorities have a visible BEFORE/AFTER improvement and no adjacent shot is sacrificed to improve another.
- [ ] Run the final cumulative paired performance gate and affected existing regression checks. Show the owner accepted images, measured limits and remaining visual approximations.
- [ ] Commit accepted graphical milestones locally. No push, broad documentation rewrite or unrelated cleanup.

## Economical Execution and Ownership

- **Sol primary:** direction, shared palette/light decisions, composition, integration, visual review and final acceptance. Keep one owner for `sky.js`, `mood.js`, `post.js` and shared materials.
- **Terra:** one bounded implementation module per task after the primary provides the accepted look and interface. Candidate: backdrop treatment, then tree finish; never edit a shared file concurrently.
- **Luna:** inventories, locating parameters, capture metadata and mechanical checks. Do not delegate important visual judgments to Luna.
- Start sequentially through Phases 0–3. After materials/light stabilize, crowd and vegetation can proceed independently in disjoint files. Integrate and compare before final night tuning.
- Send agents only their task, named files, accepted visual reference, constraints, interface and completion criteria. No inherited full conversation, duplicate recon or extra agents for trivial edits.
- Use Token Saviour to route reads; Serena for symbol retrieval when available, `rg` otherwise. RTK for noisy command output; Ponytail for minimal complete edits; Caveman for concise updates. Skill count is not a goal.
- Browser-harness owns capture/navigation. Chrome DevTools MCP investigates specific trace/console issues; Spector captures isolated WebGL failures. Use specialist browser diagnostics sequentially, never race independent controllers over one measurement.
- ImageGen is optional only after a demonstrated raster-asset need; preserve procedural assets by default. No speculative generators or new tools.
- Existing subagent-driven development, systematic debugging and verification-before-completion apply when execution reaches their relevant step. No exhaustive benchmark per small tweak.

## Completion Gate

All eight visual priorities improved across all three regions; owner-reviewed fixed-shot comparisons and moving traversal; mobile/day/night/clear/rain/sunset consistency; preserved route/UI/sightlines and reduced-motion appearance; cumulative p95 ceilings met. Any scope exception or unverified device remains explicitly labeled. The plan does not claim photoreal reflections, volumetric clouds or full 3D crowds.
