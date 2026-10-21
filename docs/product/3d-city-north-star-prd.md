# 3D City North Star — PRD

Status: FINAL VISUAL GO / visual development frozen2026-10-21. The user approved the delivered citywide system and all scoped art/landmark work; this document does not authorize further development or deployment. Technical production readiness is NO pending the coplanar-face gate in the final rendering budget. Current rules: [AGENTS.md](../../AGENTS.md), [architecture](../architecture/3d-city.md), [budgets](../architecture/rendering-budget.md), [art direction](../art-direction.md).

## Vision and problem

Make the existing scroll-driven portfolio feel like a polished city-builder: a coherent, premium stylized city in real-time 3D. The supplied city reference is the **NORTH STAR VISUAL**, not a literal map, static backdrop or demand for total photorealism.

Original gap: the first approved townhouses outpaced surrounding box buildings. Delivered scope now covers townhouse/terrace, shop/mixed low-rise, midrise, office and tower families, deterministic citywide diversity, public realm/vegetation, final art/glass/water and the three authorized landmark modernizations. The user has approved this visual outcome; it is no longer a discovery or vertical-slice task.

## Scope and non-scope

Evolve existing lots and public-space surfaces through reusable archetypes, then measured regional replication. Preserve the bus journey, map topology, lot limits, recognizable landmarks, sightlines, pedestrians and accessible HTML content. Each phase needs an explicit lot/region boundary and user authorization.

Not objectives: copying the reference literally; full photorealism; switching engines/frameworks; rewriting the map; replacing the scene with an image; creating landmarks to match the reference; changing everything simultaneously. Lighting, vehicles and landmark remodeling are separate scopes, not incidental parts of a building slice.

## Concrete visual objectives

| Priority | Reference quality to pursue | Evidence in the existing scene |
|---|---|---|
| 1 | Facades with depth and material identity | Recessed openings, readable structural rhythm, coherent wall/frame/glass response; no sticker windows or voxel stacks |
| 1 | Stronger ground-floor treatment | Human-scale entrances, distinct base/storefront, deliberate alignment with existing sidewalks |
| 1 | Low-rise / midrise / tower hierarchy | Distinct massing and rooflines at normal camera distance; midrise is not an enlarged townhouse |
| 2 | Sophisticated skyline and architectural variety | Controlled archetype/height/roof variation within existing lot caps, preserving landmark silhouettes |
| 2 | Richer streets, plaza and waterfront | Clear curbs/edges, coherent paving, furniture and planting; routes remain continuous |
| 2 | Convincing vegetation and furniture | Rounded tree variation, believable scale and reusable furnishings; no visual/path obstruction |
| 3 | Cinematic atmosphere and premium composition | Separate lighting pass for warm directional light, coherent shadows and depth; improve a hero zone after archetypes are proven |

## Art principles

Use the existing [art direction](../art-direction.md): stylized realism, low/mid-poly, believable proportions, facade hierarchy, restrained detail and clean silhouettes. Geometry earns its cost through silhouette/depth/occlusion; maps handle microdetail. Favor shared resources and a coherent family over unique materials and maximal variety. The reference guides relationships and quality, not exact objects or positions.

## Definition and metrics of success

Delivery gates used during the completed rollout (retained for traceability, not an instruction to repeat them):

- Every new archetype has one visually approved slice, recognizable in a **normal existing shot**, plus a detail capture. Detail-only improvement does not pass.
- New slices match or exceed the approved townhouse's finish while retaining their own architectural identity; use the same framing for before/after comparison.
- The eventual hero zone shows at least three clearly distinct architectural families and readable low/mid/high massing, provided existing lots permit them. Do not invent lots to meet this composition target.
- Every changed building stays inside its source footprint/height; zero changes to unauthorized lots and zero new route or landmark obstructions.
- Each replication gate reports renderables, triangles, materials/maps and draw calls against a declared local budget; wider validation uses the [established measurement contract](../architecture/rendering-budget.md). Observed townhouse counts are not citywide performance guarantees.
- Accessibility and content behavior remain intact; the milestone matrix and validation effort follow AGENTS.md.
- A phase ends with a visible, reviewable result and GO/NO-GO. Citywide success requires regional evidence and explicit approval, not only attractive close-ups.

Completed route: **midrise → replication → office/tower → public realm/shop → hero zone → regional/citywide → diversity/art/materials/landmarks**. See the frozen [roadmap](../plans/3d-city-fast-track-roadmap.md). Final observed desktop/mobile metrics, test results and the blocking coplanar-face failure live in the [rendering budget](../architecture/rendering-budget.md#final-milestone-validation--2026-10-21). Known limits: physical mobile not validated, segmented London Eye accepted, WebGL/browser metrics runtime-dependent. No further polish, rollout, commit or deploy is implied.
