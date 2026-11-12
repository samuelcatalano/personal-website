# Ordinary procedural architecture — design review, 2026-11-12

Status: investigation and proposed direction only. No runtime code changed. Existing uncommitted weather work is preserved. Owner asks for ordinary houses/buildings approaching the finish of an authored model while retaining procedural construction; landmarks are excluded.

## Current evidence

Inspected the current architecture/art/budget references and owning recipe, material, rollout and facade-kit sources. The system has 24 geometry-backed archetypes, real openings, inset sash/reveal detail, metric PBR maps, room-box parallax and curtains, shared mass/trim/glass batches, cached LOD and spatial culling. Do not present these existing features as new work.

The runtime is hybrid: procedural masses/far geometry plus authored GLB facade modules near the camera. Ordinary and some landmark materials share atlas textures even when their material objects differ. An ordinary-only finish must preserve that boundary; changing the shared atlas would also affect landmarks.

[Five current-family close-ups](../evidence/procedural-building-review/current-families.jpg) use real city descriptors, surrounding descriptors for party-wall exposure, loaded existing kits, neutral inspection lighting and orthographic framing. These are current-source reference renders, not proposed after images or captures of the live city lighting. [Fixture output](../evidence/procedural-building-review/capture.log): all five shader diagnostics and GL error codes are zero. Samples are one representative per family, not coverage of all 24 archetypes. A blank townhouse party wall must stay blank when a real neighbor occupies it, even in an isolated inspection image.

Primary visual findings: repeated small-scale surface patterns, similarly sharp edges across different construction materials, fine trim competing with structural hierarchy, and office/tower elevations dominated by repeated grids. Rooms and construction detail already exist; the next gain is coherence and finish rather than indiscriminate geometry.

## Recommended package

1. **Construction profiles:** reusable parametric sections for stone sills, metal frames, timber sash, coping and cornices. Selectively bevel visible LOD0 edges in physical scale, retaining sharp structural breaks and economical distant geometry. No blanket subdivision or rounded building masses.
2. **Facade grammar:** separate base/body/crown, structural bays, slab edges, spandrels and entry hierarchy. Use coherent regional assembly rules within existing lots/heights and current archetype identities. Party-wall exposure continues to use all neighbors before chunking.
3. **Ordinary-only material finish:** improve metric brick/mortar, sandstone bedding, plaster, slate and metal roughness; introduce deterministic multi-scale variation with filtered fine detail. Avoid stretched units, checker tiling and large random stains. Preserve landmark appearance by isolating the material/texture path before modifying shared maps. Prefer bounded shader changes or one shared ordinary set over per-building textures.
4. **Glazing and rooms:** improve the existing box-parallax shader with stable per-room depth, floor/wall differentiation, selected sparse interior silhouettes and coherent blind states. Make glazing roughness/reflectance vary modestly by pane. Keep opaque batching and existing distance/derivative fade; no room mesh or dynamic light per window.
5. **Roof construction:** give existing roofs readable courses, ridge/hip junctions, coping and flashing. Place bounded roof services logically inside current envelopes. Coordinate chimney/gutter/downpipe junctions. Preserve roof silhouette and drainage continuity; remove detail below a projected-pixel threshold through existing LOD rather than hiding roof masses.
6. **Contact and age:** restrained construction-aware occlusion at sill/reveal/ledge/base junctions, runoff below actual projections and downpipes, minor repair variation tied to a stable lot seed. Prefer local baked/analytic contact cues over increasing global AO or adding a pass. Keep weather integration coherent without making dry sheltered walls wet.
7. **Regional authored quality:** refine existing Paulista brise/plaster/metal, London brick/sash/stone and Glasgow sandstone/bay-window families. Limit allowed combinations by building type so a convincing building cannot assemble mismatched details. No new lot placement or random catalogue expansion.
8. **Distance-aware delivery:** preserve mass/trim/glass buckets and shared identities; no individual window materials. Detail belongs to nearby geometry/shaders, with the existing far representation, cached LOD and hysteresis preserved. Near/far opening positions and roof silhouette must match.

## Approaches awaiting selection

- **A — Construction and materials within the existing hybrid generator (recommended):** the full package above, retain currently used GLB modules as compatibility paths and add no external building assets. Biggest likely visible gain without rebuilding the city pipeline. New detailing should be procedural; existing module paths must retain compatible finish/coordinates.
- **B — Materials/glazing only:** lowest geometry risk and quickest iteration, but sharp silhouettes and repeated construction profiles remain. Unlikely to meet the owner's full quality ambition alone.
- **C — Fully procedural replacement of existing GLB facade kits:** removes the hybrid dependency, but is a broader generator migration. Requires output parity across five families, LOD/coordinate/resource/disposal contracts and more validation before rollout. This is distinct from simply improving today's procedural assembly.

GLB is a delivery format, not a visual quality tier. The target should be convincing construction at the actual route camera and in close-ups, not an unmeasured promise of photographic equivalence.

## Proposed implementation sequence after selection

First establish matched before/after examples for a townhouse, shop, residential midrise, office and tower. Implement shared construction/material changes as a vertical slice, verify both procedural and loaded-kit paths, then apply compatible refinements across existing ordinary families. No landmark, road, layout, circulation, camera, weather-system or global-lighting redesign.

Acceptance: same lot IDs/envelopes and party-wall rules; no buried glass or coplanar overlays; LOD alignment; no new per-building materials; valid packed attributes through kit merges; shared resource disposal; actual close-up and live-route improvement in day/night/rain; desktop/375px, fallback and reduced motion retained. Run relevant facade/room/kit tests and full regression at the milestone, plus matched resource and frame-time samples with visible tabs and fixed theme/tier.

The earlier facade audit records inherited citywide memory/envelope test failures; recheck and compare baseline before attributing them to this work. Do not weaken guards. The weather task also leaves performance unapproved. No performance GO until a stable comparison exists; no new arbitrary geometry budget is presented as owner-approved.

## Technical basis

[Three.js MeshStandardMaterial documentation](https://threejs.org/docs/pages/MeshStandardMaterial.html) distinguishes normal/bump shading from actual displaced geometry and documents metallic/roughness PBR. This supports using geometry for visible construction/silhouette and restrained maps for fine surface relief. Existing repository code remains the owning source for its pinned Three.js integration.

Baseline browser checks: `facade-realism`, `building-kit`, `office-facade` and `facade-interiors` passed on the current source. [Raw results](../evidence/procedural-building-review/baseline-checks.log). These validate the starting state, not the proposed changes.

Not performed: runtime implementation, full tests, all-archetype close-ups, physical mobile, GPU-memory profiling or a new performance benchmark. No commit or deployment.
