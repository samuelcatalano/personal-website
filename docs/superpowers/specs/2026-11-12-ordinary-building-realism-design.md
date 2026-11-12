# Ordinary building realism — selected design

## Intent and selected approach

Owner selected **A — full construction/material package within the current structure** on 2026-11-12. Target: ordinary houses and buildings that read as carefully authored architectural models at the route camera and in close-ups. New detailing remains procedural; existing GLB facade modules remain supported. No promise of photographic equivalence or a file-format-based quality level.

Alternatives considered: materials/glazing only (less geometry risk, insufficient construction/silhouette improvement) and replacing all facade GLBs with procedural equivalents (a larger migration, unnecessary for the selected goal). Neither is selected.

[Grounded current-source review and five-family evidence](../../audits/2026-11-12-procedural-building-design-review.md).

## Scope and fixed boundaries

Include all existing ordinary townhouse, shop, midrise, office and tower families, their loaded-kit/far procedural representations, and ordinary legacy/backdrop equivalents where the same defect would remain visible. Preserve existing identities and regional profiles; do not expand the archetype catalog.

Preserve lot IDs/positions, widths/depths/heights, footprints, principal roof silhouettes, adjacency/party-wall exposure, routes, roads, paths, landmarks and their sightlines, pedestrians, vehicles, planting, UI, cameras and global lighting. Do not discard or fold unrelated weather changes into the implementation. Keep no-build ES modules and the pinned Three.js version; no new dependency, external model, dynamic light or rendering pass.

## Visual contract

1. **Profiles and edge finish:** add controlled near-detail construction profiles and small bevels to visible stone/metal/timber elements. Keep structural breaks sharp; no general subdivision or rounded building masses. Reuse local parametric geometry and existing bucket merges. Simplify tiny competing ornament where necessary to improve readability and contain cost.
2. **Facade hierarchy:** make entrance/base, repeated structural body and roof termination legible through existing regional recipes. Coordinate bay spacing, caixilho/mullion sizes, sill/lintel depth, slab edges and spandrels. Changes remain within existing facade margins; do not reposition openings between near/far states or add openings to touching party walls.
3. **Materials:** improve metric brick/mortar, sandstone, plaster, slate and metal with physical-scale relief and filtered multi-scale roughness/colour variation. Avoid repeated checker patterns, stretched bricks, excessive grain or arbitrary stains. Ordinary-only changes must preserve landmark shader/material/texture appearance: material clones currently share atlas texture identities. Isolate that path before changing maps; never allocate one material or map per building.
4. **Windows/interiors:** refine existing box-parallax rooms with stable room depth, floor/wall differentiation and sparse bounded interior cues; vary blinds coherently and glazing modestly by pane. Keep opaque batching, packed room coordinates and existing distance/derivative filtering. No mesh/light per room; no arbitrary full-scene reflections or physical transparency pipeline.
5. **Roofs:** improve course/ridge/coping/flashing readability and construction junctions; coordinate existing roof services and drainage within existing envelope. Preserve the principal roof silhouette and roof mass in both LODs. Small construction trim may simplify at distance; no new global culling or LOD system.
6. **Contact/age:** add restrained contact cues at opening reveals, ledges and bases, with runoff tied to actual construction. Use local analytic/baked cues within existing shaders/attributes rather than increasing global AO. Preserve existing weather integration and keep sheltered dry surfaces plausible.
7. **Regional coherence:** Paulista brise/plaster/metal, London brick/sash/stone and Glasgow sandstone/bays retain distinct assemblies. Deterministic recipes restrict incompatible combinations and consume no global city RNG.
8. **Distance-aware quality:** keep mass/trim/glass, at most three active renderables per existing spatial chunk, shared materials/maps, cached near/far geometry, hysteresis and standard per-pass culling. Fine shading must filter/fade rather than shimmer. Both procedural and loaded-kit paths must carry matching pane/room metadata and compatible finish.

## Builder decisions within this contract

Primary implementer chooses exact profile cross-sections, restrained bevel dimensions, surface colours, material filtering and bounded room silhouettes through matched rendered comparisons. Existing abstractions take precedence; no general-purpose new architecture engine. Reuse an existing ordinary-only shader branch when sufficient; if atlas isolation is necessary use one shared ordinary set, not per-lot textures. Record texture/geometry payload changes and simplifications in the final audit.

## Delivery and acceptance

Establish matched current/after comparisons for one representative of each of the five families; build the shared near-detail/material slice first, then integrate across affected ordinary paths. Retain full-building oblique views and route-scale views so close-up polish does not hide composition regressions. Validate day/night/rain plus desktop/375px, reduced motion and WebGL fallback as appropriate to affected behaviour.

Required checks: deterministic recipes; unchanged lot/envelope/adjacency contracts; exposed glass not buried behind backing; closed wall spans and corners; no new coplanar overlays; near/far opening alignment; packed room/material attributes preserved across loaded-kit merges; bounded shared resources and idempotent disposal; real shader compilation/pixel checks. Run relevant existing facade/room/kit suites during implementation and full Node regression at milestone. Preserve existing failing guards and compare baseline/current rather than weakening them.

Performance: preserve draw/light/pass counts by architecture. Compare calculated geometry/texture payloads and matched frame-time samples with fixed theme/tier/camera and visible tabs. Existing audits record inherited memory/envelope guard failures and inconclusive weather timing; these are not a clean performance baseline. No arbitrary new owner-approved numerical budget or universal FPS claim. If a change shows a repeatable cost increase, simplify its implementation; any unresolved cost must be reported explicitly without declaring performance GO.

## Approval boundary

Approach A and this contract were approved on 2026-11-12, with implementation authorized without further confirmation. Owner subsequently prioritised quality/design over performance: triangle, memory and timing costs are measurements, not blockers for this pass. Preserve correctness, content, landmarks and layout. No deployment is included. The primary agent implements and integrates in the current checkout; subagents are not selected for implementation.
