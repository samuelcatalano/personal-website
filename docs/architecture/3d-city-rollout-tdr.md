# Fast Rollout Architecture — TDR

Status: delivered architecture / visual freeze2026-10-21. All scoped archetypes, citywide rollout/diversity and final visual passes are user-approved. Earlier slice/replication sequencing below is historical delivery rationale, not new work authorization. The [final technical gate](rendering-budget.md#final-milestone-validation--2026-10-21) remains blocked by the coplanar-face regression; no renderer/visual redesign is authorized. Builds on the [validated city architecture](3d-city.md). Product target: [North Star PRD](../product/3d-city-north-star-prd.md). Execution gates: [roadmap](../plans/3d-city-fast-track-roadmap.md).

## Decision: reuse the delivery pipeline, specialize the architecture

Keep lot descriptors as source of truth. Reuse deterministic recipes, metric UVs, vertex colors/aSurface, shared atlas/materials, mass/trim/glass policies, spatial merging, LOD0/LOD1 and standard culling. Keep archetype geometry specific. No new engine, map format, ECS, editor, streaming system or universal building mega-builder.

The first midrise is a standalone **visual slice**, not a regional batching or LOD project. Target <=3 renderables using existing shared materials/maps where convincing. Declare a local triangle/call budget after inspecting the chosen existing descriptor; do not copy a townhouse triangle allowance onto a larger building blindly. Do not refactor frozen townhouses merely to expose helpers. Extract a minimal shared helper only when a real second consumer requires it and control buffers/behavior can be preserved.

Once an archetype is visually approved, use the existing recipe → local geometry → chunk bucket pipeline for a small replication test. Same geometry + transforms may use instancing when it actually simplifies the result; differing static geometry with compatible material/render policy merges spatially. Landmarks remain dedicated and protected. Architecture cost should scale with visible chunks, material families and geometry, not one set of meshes per building.

## Archetype priorities

Priority reflects the shortest visual path, not an instruction to implement every row.

| Archetype | Visual role | Priority | Complexity | Potential gain |
|---|---|---|---|---|
| Townhouse / terrace | Human-scale street continuity; quality control | Frozen foundation | Low reuse / already proven | High through selective reuse; low from redesign |
| Midrise residential | Main city fabric; facade and height hierarchy | First new slice | Medium | Very high |
| Office / glass midrise | Contrast, vertical rhythm and glass identity | After midrise replication | Medium | High |
| Tower | Skyline anchors and differentiated crowns | After office | Medium–high | High where visible |
| Shop / mixed low-rise | Active ground floors and transitions to streets | At public realm / hero zone | Low–medium | High near camera |
| Civic / special | Local identity and composition anchors | Defer until region needs it | High, case-dependent | High locally |
| Public realm / plaza / waterfront | Connects architecture into a believable city | After core slices; before hero zone | Medium | Very high collectively |

## Geometry, materials, LOD and batching by archetype

All LOD entries below are future replication policies, not work to add during the first visual slice. Reuse the proven LOD mechanism; validate thresholds for the real camera/scale before extending it to another archetype. No LOD2 in this plan.

| Archetype | Specific geometry | Materials strategy | LOD strategy | Batching and reuse |
|---|---|---|---|---|
| Townhouse | Keep approved three-floor brick/plaster/gable language, two recipes/three palettes | Keep exact shared resources | Existing validated LOD0/1 and AABB hysteresis | Existing three buckets/cell; preserve control |
| Midrise residential | Typically4–8 floors when lot permits; base/body/crown hierarchy, visible vertical structure, recessed bays, human entrance, parapet and restrained roof equipment | Start with shared plaster/stone/brick/glass atlas; tint through vertex data | Preserve roof, structure and opening rhythm; simplify sills, narrow frames and profiles | First one three-mesh slice; later merge2–3 lots by existing cell policy; share surface system, keep floor/bay rules specific |
| Office / glass midrise | Structural grid, recessed glazing, entrance/lobby and clear crown; avoid flat blue boxes | Reuse glass/material family initially; do not add transparency/post changes incidentally | Preserve grid and crown; simplify mullions/interior hints | Repeated panes in merged buckets or identical modules instanced if cheaper; office facade proportions remain specific |
| Tower | Distinct continuous mass, setbacks/crown within original height and footprint; restrained mechanical volumes | Shared architectural/glass surfaces; no unique material per tower | Preserve silhouette/crown/setbacks first; reduce small facade detail | Chunk-local compatible batches; repeated geometry may instance; tower massing remains its own recipe |
| Shop / mixed low-rise | Shopfront depth, entrance, awning where appropriate, upper-floor/base distinction | Reuse brick/plaster/glass; any signage must use centralized localized content if user-facing | Keep shopfront outline; simplify small frames/awning supports | Share suitable midrise base modules only after visual fit; avoid copying whole builders |
| Civic / special | Specific civic proportions; existing landmarks unchanged | Reuse surfaces when appropriate; no automatic bespoke atlas | Protect identity and silhouette; assess individually | Dedicated geometry may remain appropriate; do not force landmarks into generic cells or assume three buckets always fits |
| Public realm | Surface layers, edges, furniture, planting, existing water/bridge relationships | Reuse coherent paving/stone/metal/wood families | Detail by visibility/importance, separate from building recipes | Spatially merge compatible static surfaces; instance repeated furnishings/vegetation; keep dynamic water separate |

Target at most three architecture buckets per cell. Combining archetypes into those buckets requires compatible shared materials and render policy. If a desired glass/atlas/shader policy would multiply batches or alter the renderer, stop and flag the conflict rather than quietly breaking the budget. Do not apply townhouse scratch capacities or observed costs to all archetypes.

## Transversal systems: fast gains without rebuilding the city

| System | Practical strategy | Boundary / sequencing |
|---|---|---|
| Global materials / atlas / maps | Reuse existing shared surfaces and metric UVs first; add a measured shared family only for a demonstrated visual gap | No atlas replacement that changes approved townhouses; no per-building maps. External assets only with explicit phase approval and license/provenance in ASSET_SOURCES.md |
| Rooftop language | Few archetype-specific choices: terrace gable, midrise parapet/roof slab, office crown, tower setbacks | Geometry for silhouette; small equipment only where the normal shot reads it |
| Street furniture | Consistent human scale, a small repeatable kit; shared geometry/materials | Public realm pass; no per-lamp dynamic lights |
| Trees / vegetation | Reuse rounded trees with controlled height/shape variation and instancing | Preserve paths/sightlines; no return to pines or indiscriminate grass coverage |
| Road edges / sidewalks | Improve curb/paving hierarchy, entrances and transitions using existing surfaces | Preserve road geometry/route topology, lane/vehicle/pedestrian clearance |
| Plaza treatment | Coherent paving, restrained furniture/planting and spatial hierarchy | Keep current circulation and landmark-facing open space |
| Water / bridge / waterfront | Consistent edges/railings and water response; reuse water system | Do not remodel a protected bridge/landmark or add the reference's bridge without separate authorization |
| Lighting / atmosphere | Separate controlled comparison for directional warmth, shadows and atmospheric depth | After geometry/material identity is proven; preserve day/night and shadow/light budgets, no blanket new lights |
| Skyline composition | Select useful archetypes within existing lot heights; vary rooflines/recipes deterministically | Work from normal shots; never move lots or enlarge heights to imitate the image |

## Replication and safety gates

1. Approve the visual archetype in one safe existing lot, with before/after normal shot and detail; retain an exact allowlist.
2. Prove2–3 examples with limited controlled variation and compatible batches; no citywide replacement switch.
3. Upgrade a hero zone using proven components; keep lighting and public realm separately measurable, then inspect their composition together.
4. Roll out one authorized region at a time. Preserve a control region, descriptors and deterministic generation; compare visibility, frame cost, initialization memory and shadow passes.
5. Citywide rollout requires explicit approval and milestone evidence. Replace old rendering exactly once per selected lot; preserve preexisting changes and avoid destructive Git operations. Scope-controlled changes permit review/reversal without rewriting the map.

Use [existing budgets](rendering-budget.md) as evidence and a measurement contract, not global guarantees. Declare incremental budgets for each new archetype/region before coding. If the pipeline itself needs a genuinely new renderer/material architecture decision, report **ASTRA REVIEW RECOMMENDED** and wait; never invoke Astra automatically.
