# 3D City Fast Track — Roadmap

Status: phases1–9 DELIVERED and visually approved; visual development FROZEN2026-10-21. Subsequent diversity, final art/glass/water and Wembley/Big Ben-Parliament/MASP modernization are also approved. Final technical milestone is NO-GO only for the coplanar-face regression; see the [release gate](../architecture/rendering-budget.md#final-milestone-validation--2026-10-21). The delivery sequence below is retained history, not a new execution queue. Sources: [PRD](../product/3d-city-north-star-prd.md), [rollout TDR](../architecture/3d-city-rollout-tdr.md), [AGENTS.md](../../AGENTS.md). Townhouse design and its validated architecture stay frozen.

## Shortest path

Raise the ordinary **midrise** buildings visible from existing cameras first, prove cheap replication, then add office/tower contrast. Improve shared public-space details once, compose one hero zone, and only then expand regionally. This produces more visible improvement than polishing another townhouse or adding isolated premium assets across the whole map.

Keep the requested nine-stage sequence. Shop/mixed low-rise joins phase6/7 where ground-floor continuity matters; civic/special work waits for a specific regional need. Lighting is a separate scoped sub-pass in the hero-zone stage, so it cannot hide weak geometry or inflate an archetype's apparent gain.

## Priority matrix

| Impact / effort | Best candidates | Action |
|---|---|---|
| High / low | Reuse approved materials, improve base/body/crown hierarchy and limited roof silhouettes in an authorized slice; replicate an already-proven recipe | Do first where visible; no change outside the phase allowlist |
| High / medium | Midrise depth/entrance/parapet, office grid, coherent paving/furniture and planting | Core fast-track work |
| High / high | Hero-zone integration, tower language, regional migration, lighting/shadow changes | After component proof; budget and milestone gate |
| Low / low | Small palette variants and tiny copy/content fixes | Batch only when relevant; avoid distracting from visible massing |
| Low / high | Invisible rooftop equipment, bespoke materials per lot, custom occlusion/streaming, repeated townhouse redesign | Defer or reject |

## Phases and acceptance

Cost is relative (S/M/L), not a time estimate. Paths below are probable edit surfaces, not permission to modify all of them. Each implementation handoff names exact files/lots and respects preexisting working-tree changes.

| Phase | Objective / likely files | Risk / cost | Expected visual gain | Success gate | Validation |
|---|---|---|---|---|---|
| 1 — Freeze foundation | Keep approved townhouses, shared maps, chunk/LOD/culling evidence. Current architecture/art/budget docs; building-slice.js remains unchanged | Low / S | Avoids rework; protects the quality baseline | Existing GO recorded, current docs linked; no new discovery or redesign | Documentation checks only; no replay of old benchmarks |
| 2 — One MIDRISE slice | Choose an existing midrise clearly visible in a normal shot. Archetype-specific builder, building-kit.js allowlist and focused test | Medium / M | Very high: removes the main box/window visual weakness | One lot, same bounds/height; own architectural identity, base/body/crown, real openings, shared resources; normal/detail visual approval | Related tests, diff check, desktop day normal + detail, basic mesh/triangle/resource/call metrics; no regional batching or LOD work yet |
| 3 —2–3 MIDRISES | Reuse the approved recipe/builder; add deterministic limited variation and spatial integration only for selected neighbors | Medium / S–M | High replication gain | Consistent family without clones, no unauthorized replacement, batching/cost growth explained | Related tests + simple A/B while developing; full milestone comparison before broader replication or renderer/LOD changes |
| 4 — One OFFICE slice | Office-specific grid/lobby/crown builder; narrow building-kit integration | Medium / M | High contrast and glass quality | Reads as office, not recolored residential; no incidental transparency/post rewrite | Light validation as phase2; benchmark only if replication/material policy expands |
| 5 — One TOWER slice | Tower-specific mass/setbacks/crown builder inside an existing lot | Medium–high / M | High skyline gain | Distinct silhouette and vertical rhythm visible in a normal shot, no new landmark obstruction | Light slice validation; check relevant shadow/call counts, escalate only for a concrete issue |
| 6 — PUBLIC REALM | Separately scoped surface/furniture/vegetation/waterfront improvements; city.js, parks.js, trees.js, water.js and existing furnishing helpers as needed | Medium / M | Very high collective coherence | Clear streets/plaza/waterfront edges, believable scale; all walking/driving routes and landmark views intact. Optional shop slice improves a visible ground-floor gap | Related geometry/path tests + contextual captures and simple A/B if rendering cost changes; milestone checks before replication |
| 7 — HERO ZONE | Assemble proven archetypes/public realm in one authorized, camera-visible region. Separate lighting/atmosphere proposal; integration files only as required | High / L | Highest perceived premium finish | Whole normal shot approaches North Star; detail shots corroborate. No changed route/camera to manufacture a better comparison | Full milestone: Node, relevant browser suites, desktop/mobile day/night, repeated A/B, accessibility/Lighthouse when applicable, broader review |
| 8 — REGIONAL | Apply proven recipes to one bounded existing region at a time; building-kit.js/real-city.js integration and archetype builders | Medium–high / M per region | Broad visible convergence | Exact descriptor/control preservation, deterministic variety, bounded calls/memory and good normal shots; each region explicitly approved | Milestone validation per region; light checks for subsequent small corrections, not repeated full runs |
| 9 — CITYWIDE | Extend only proven combinations to remaining authorized regions; no new renderer architecture hidden in rollout | High / L cumulative | Coherent whole-city quality | Representative route shots meet art/functional criteria; regional gains hold across tiers and visibility; explicit citywide approval | Full milestone at rollout gates; no all-city big-bang conversion |

Existing probable shared resource owner: building-slice-materials.js. Reuse it where visually appropriate; do not edit it merely to rename or reorganize a frozen system. A new helper/module is justified by archetype-specific geometry, not a general engine rewrite. Preserve the existing exact pinned Three.js/native-module setup.

## Token-Efficient Workflow

- **Sol Medium:** scoped implementation/integration and routine technical decisions inside approved architecture. **Luna:** short documentation, mechanical edits, boilerplate and simple tests when model selection is permitted. Respect the current model lock.
- **Astra:** only a genuinely new major architectural decision, subsystem conflict or structural renderer change risking substantial rework. Report ASTRA REVIEW RECOMMENDED and wait for explicit approval; never auto-invoke. Not needed to execute this roadmap's routine slices.
- Subagents remain off by default. Independence is a prerequisite, not a reason to split every small task. No subagents were used to create these documents.
- **Discovery:** inspect only the candidate lot, normal-shot visibility and touched callers/interfaces. Do not rediscover materials, townhouse quality or approved LOD/culling. Record only the new fact/decision.
- **Implementation:** exact lot allowlist and file scope, one finished slice, related tests. Reuse shared resources; do not bundle unrelated visual passes.
- **Validation:** related tests, one normal capture and one detail capture, basic metrics; a simple A/B only when relevant. Documentation-only changes need document/link/diff checks.
- **Milestone:** broader review and the established repeated comparison only before expansion or when a concrete regression/structural change justifies it. Do not run Lighthouse, every suite or20+ measurements for a small adjustment.
- Keep decisions in these documents; update only the relevant section when a new decision is approved. Large raw benchmark logs/captures belong in artifacts, with a short local summary/link, not repeated chat messages.
- Default final response: change, files, checks, relevant metrics, GO/NO-GO and known issue. Do not reproduce these documents in chat.

Minimal future handoff (replace brackets, do not paste the whole specification):

```text
Read AGENTS.md and the three current city references.
Execute roadmap phase [N], scope [exact lot IDs/region].
Use rollout TDR section [archetype]; preserve [control IDs].
Edit only [files]. Budget [local limits]. Validation [light/milestone].
Stop after [reviewable slice/gate]; no automatic expansion.
```

## Next action and stop rule

No automatic next implementation. The visual system is approved and frozen; final release remains blocked by tests/zfight.browser.py (327 fixture conflicts;191 in live production batches). Preserve the geometry and wait for an explicitly authorized follow-up before any correction. London Eye stays segmented. Do not repeat completed discovery, add archetypes/LOD, optimize, polish, commit or deploy automatically. Physical-mobile validation remains outstanding; final operational WebGL measurements and evidence are in the rendering budget.
