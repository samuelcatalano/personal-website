# Ordinary building realism — 2026-11-12

Owner approved the full package A in the current hybrid structure, approved the design contract and direct implementation, then explicitly prioritised quality/design over performance limits. No new approval gate was applied to geometry, memory or timings. [Approved contract](../superpowers/specs/2026-11-12-ordinary-building-realism-design.md), [implementation plan/ledger](../superpowers/plans/2026-11-12-ordinary-building-realism.md), [current-source diagnosis](2026-11-12-procedural-building-design-review.md).

## Delivered

- Procedural beveled glazing beads, commercial mullion sections, sill noses, drip edges and header caps. Cross-sections use actual geometry and normals, not a painted edge. Added profiles fit descriptor bounds; glazing positions and touching party walls remain unchanged.
- Pitched townhouse roof courses follow the actual gable/side/hip support, including the shorter London bay-window roof. Hip courses taper with the existing roof rather than spanning a lot rectangle.
- Ordinary metric atlas is 1024px, with masonry edge relief, mortar/pores, stone grain, slate overlap, restrained plaster relief and roughness variation. Non-repeating world-anchored masonry tone supplements the metric tile; derivative filtering keeps fine shading bounded. Repeated normal noise on plaster was reduced during visual calibration.
- Commercial vertical spandrels receive a smooth coated/metal finish instead of inheriting slate tiling. Office overlays use coherent modern fascia/cornice sections instead of randomly selected dentils/corbels, improving base/body/crown hierarchy.
- Existing opaque room-box parallax now includes variable depth, floor boards/rugs, wall pictures, furniture/shelf/lamp layers and coherent fabric shading. Layers are depth-clipped by the room, with filtering and range fade. Control groups, the special office and default legacy glazing receive room coordinates too; no per-room mesh/light.
- Regional recipes and tints remain deterministic. Construction finish distinguishes commercial frames and residential/Glasgow stonework without expanding the 24-profile catalog or consuming city RNG.
- Existing prefiltered day/night sky environment is reused for ordinary PBR materials. No extra environment capture, target, dynamic light, renderer framework or dependency.
- New detail is integrated before tint/chunk merge in procedural and loaded-kit assembly, plus existing ordinary control groups. The default legacy production path preserves source geometry/silhouettes while converting parts into owned mass/trim/glass with metric UVs and packed room coordinates. Mixed benchmark instances carry explicit surface roles so glass remains glass.
- Landmark/public-realm materials retain the old 512px atlas and original shading path. Landmark and ordinary materials formerly shared atlas images; the new ordinary set is isolated. Old public-realm pieces use a preserved material set rather than inheriting the new architectural finish.

Existing lot descriptors, dimensions, principal roof silhouettes, map, roads/routes, paths, landmarks, cameras, global lights, vegetation and content were not redesigned. Existing GLB facade modules remain in use; no external asset was introduced. Far skyline silhouettes remain intentionally simplified at their viewing scale. The explicit `rollout:false` diagnostic retains the baseline renderer; normal production defaults use the new finish.

## Verification

- Full Node regression: **240 passed**, no failures/skips; includes modulepreload integrity. [Raw output](../evidence/ordinary-building-realism/node-final.log).
- Final browser suites: `ordinary-finish`, `architecture-archetypes`, `facade-realism`, `building-kit`, `office-facade`, `facade-interiors`, `render-resources` passed. [Raw output](../evidence/ordinary-building-realism/browser-final.log).
- New fixture checks independent ordinary/landmark atlases and 1024/512 resolutions; preserved map/normal/ORM hashes **1485052815 / 4103241495 / 3868138199**; legacy landmark detail range and absence of the new spandrel shader; actual beveled normals; unchanged glazing; complete attributes; bounded added construction; idempotent application; real material/room shader compilation; generic legacy silhouette/room coverage; mixed benchmark glass roles; and idempotent owned townhouse disposal.
- Bay-roof support regression was observed failing before the exact roof-span correction. Mixed benchmark glass regression was observed failing before per-instance role metadata. Both now pass. No historical memory/triangle guard was relaxed.
- Office facade regression now compares original mass/glass and the original trim prefix exactly to the depth factory, requires appended construction trim and checks the complete resulting envelope. This updates the expected feature contract while retaining the original geometry checks.
- Resource test retains two existing environment targets and checks single disposal; desktop/375px high/medium rendering passes. Independent static review found the roof-support, benchmark-role and townhouse-disposal issues; all were corrected and the reviewer rechecked the fixes cleanly. A subsequent async control-kit regression also failed before fixing lost room coordinates/profiles during the GLB swap, then passed after awaiting the replacement. The reviewer confirmed that fix.
- Integrated matrix covered three cities, day/night/rain, 375px and reduced motion without captured errors or failed shader programs. Final production legacy integration was followed by fresh three-city captures and mobile rain/reduced-motion capture. [Final-source output](../evidence/ordinary-building-realism/source-final-matrix.log).
- EN/PT WebGL-disabled startup and PT WebGL/reduced-motion startup passed, with populated content and empty error arrays. [Startup output](../evidence/ordinary-building-realism/startup-final.log).
- A later full-scene GL interrogation found recurring `1282` despite clean console/program diagnostics. Draw-call instrumentation proved `uWetReflection` sampled the current framebuffer attachment. A repeated perspective-reflection regression reproduced the error, then passed after unbinding that sampler during the self-pass and restoring it in `finally`. No reflection feature was removed. [Initial integrated failure](../evidence/ordinary-building-realism/integration-gl-failure.log), [regression GREEN](../evidence/ordinary-building-realism/wet-green.log), [final complete-scene GL 0](../evidence/ordinary-building-realism/gl-verified.log). Independent static review confirmed restoration and per-scene state behaviour.
- Full matched-family renders and route images are local browser evidence, not an ImageGen concept or photographic-equivalence claim. [Five-family after](../evidence/ordinary-building-realism/families-after.jpg), [before/after selection](../evidence/ordinary-building-realism/comparison.jpg), [London route](../evidence/ordinary-building-realism/london-day.jpg).

## Geometry and texture cost

Representative fixtures use real descriptors and loaded existing facade kits, identical model framing, with the existing shared PBR environment newly applied to the after materials. Counts below are unique fixture geometry triangles, not multi-pass frame submissions.

| Family | Before | After |
|---|---:|---:|
| Townhouse | 4,168 | 9,684 |
| Shop | 2,252 | 4,856 |
| Midrise | 6,022 | 17,194 |
| Office | 6,380 | 22,492 |
| Tower | 6,244 | 30,044 |

The ordinary atlas has four shared generated maps: 1024px albedo/normal/ORM and 512px emission. Calculated payload with mipmaps is **17.33 MiB**. Preserved landmark/public-realm maps add **4.33 MiB**, shared with each other; architecture-atlas total about **21.67 MiB**, versus the former single 4.33 MiB set. This is calculated texture payload, not physical VRAM.

Route snapshots of active and cached rollout buffers report **1067–1293 MiB** and about **7.16–8.68 million resident geometry triangles**, varying with lazy cells/viewport/reduced-motion positioning. The sampled rollout remains **687 lots, 194 chunks, 582 meshes, two active materials**. These figures exclude other scene systems and are not draw-call/frame-time counts or a complete browser-memory bound. Near and cached representations are counted once per unique geometry. Non-townhouse far fallback currently retains the construction present in its procedural source; reducing that cost belongs to the later performance pass.

No fresh timing A/B or physical-device performance claim. The owner chose to preserve this visual finish first; increased geometry/memory and potential startup/frame-time cost are explicit follow-up work, not hidden by reducing quality. One capture runner hit its 5-second IPC evaluation timeout during startup; a longer tool-side wait completed the final captures without changing an application timeout.

## Outcome and limits

**Local visual/functional GO for this scoped finish.** Not a universal photorealism, performance or production-readiness claim. Physical phones, physical GPU-memory tools, Lighthouse and exhaustive close-ups of every regional combination were not run. Historical citywide budget/envelope diagnostics are not reclassified as passing. Default runtime inspection also confirmed three upgraded legacy groups with 72 glazing triangle pairs. No push/deployment; unrelated weather changes remain preserved.
