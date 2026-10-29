# Rendering budget

Current measurement record frozen2026-10-21. Final visual approval is recorded in [architecture](3d-city.md); technical release remains blocked by the coplanar-face regression. The final milestone below supersedes earlier operational references; dated measurements remain evidence, **not global performance guarantees**. Follow AGENTS.md validation levels.

## 2026-10-23 scope update

The user reopened the Glasgow/country and distant-horizon art for an urban replacement: remove turbine and rural-field scenery, use varied residential buildings and midrise flats with bounded gardens, and keep the existing map, roads, routes, landmarks and roof forms. The former citywide aggregate triangle ceiling is removed; report measured triangle counts as workload evidence, not a pass/fail gate. Per-building geometry limits, shared-resource/batching rules, culling, and memory budgets remain applicable. No performance or release GO is implied before scoped browser measurements.

## Shared resources and scaling

- Townhouse family: **2 shared materials**, **4 shared maps**, approximately **4.33 MiB** of texture payload including mipmaps. Reuse the same resources across buildings/chunks; variation does not add materials/maps.
- Per spatial chunk: maximum **3 active architecture renderables**: mass, trim, glass.
- Render cost should grow primarily with **visible chunks / geometry**, not individual building count. Triangles still grow with modeled geometry; batching does not make extra houses free.
- Reuse geometry/materials, merge compatible static geometry locally, retain spatial culling, and avoid per-window meshes/draw calls or per-building dynamic lights.
- LOD1 must significantly reduce geometry while retaining silhouette, roof, facade rhythm, doors/windows, glass and material identity. The nine-house benchmark required >=40% reduction.

## Approved evidence

| Benchmark | Active renderables | Materials/maps | Submissions |
|---|---:|---:|---|
| 3 houses / 1 chunk | 3 | 2 / 4 | Same as single polished slice: 8 desktop high, 3 mobile medium |
| 9 houses / 2 new chunks | 6 | 2 / 4 | Up to16 desktop high; 6 mobile medium with both chunks visible |

Nine-house geometry: **LOD0 6,572 triangles**, **LOD1 3,226**, **50.91% reduction**, no new lights. Twelve cached geometries (two levels × three buckets × two chunks), six active meshes. Original three-house control remains separate and shares the materials/maps.

Measured desktop high submissions attributable to the nine lots:

| Camera sees | Color | Normal/GTAO | Shadow/frame |
|---|---:|---:|---:|
| A+B | 6 | 6 | 4 |
| A only | 3 | 3 | 4 |
| B only | 3 | 3 | 4 |
| Neither | 0 | 0 | 4 |

Shadow rendering retained two mass submissions per pertinent execution, up to four/frame in the observed high pipeline. Off-camera casters can remain relevant to the light. Mobile medium measured six color submissions, no normal/GTAO or shadow submissions. Counts depend on tier, frustum and pipeline executions; do not assume a universal multiplier.

## Local benchmark ceilings

For the nine new houses only: LOD0 <=6,700 triangles; LOD1 <=3,500 and >=40% reduction; resident geometry payload <=1.5 MiB CPU and <=1.5 MiB GPU; transient construction CPU <=6 MiB; zero additional materials, maps, lights or shadow maps.

Observed resident attribute payload: **1,410,912 bytes (1.346 MiB)** for both LODs. Observed construction peak after scratch reuse: **4.75 MiB** incremental heap plus backing storage at CDP checkpoints. This is sampled construction memory, not continuous allocation tracing or whole-process RSS. GPU payload is calculated buffer data, not measured physical VRAM. The experiment's guarded scratch capacity is 4096 vertices/bucket; revisit only if new recipes are authorized.

## Measurement contract when a milestone needs comparison

A = approved baseline; B = explicitly scoped change. Same shot/camera, scene seed, theme, resolution, DPR and tier; never count adaptive tier downgrade as a gain.

- Desktop: 1440×900, DPR1.5, high; mobile emulated: 375×812, DPR1, medium.
- Day/night; warmup2s, sample10s, three repeats per scenario. Report median, p95 and run variation; preserve outliers.
- Approved local p95 regression ceilings: +1ms desktop, +2ms emulated mobile. They are comparison limits, not global FPS guarantees.
- Measure initialization/prewarm separately. For LOD changes, record a moving trajectory across both hysteresis thresholds, actual swaps, intervals, culling passes and geometry identity.

Final nine-house series met all paired p95 limits: maximum +0.1ms desktop, +0.2ms emulated mobile. Initial contact outliers were retained, followed by an explicit confirming series (maximum +0.3ms). Do not erase unfavorable runs or confuse off-camera shots with all-chunks-visible measurement.

Detailed raw evidence remains in the local artifact folder named townhouse-nine-benchmark-2026-10-20; its RESULTADO.md documents captures, source snapshots, instrumentation, construction and limitations. That machine-local artifact is supporting evidence, not a runtime dependency or prerequisite for reading these rules.

## Compatible citywide milestone — 2026-10-21

New ordinary architecture:113 cells,339 active mesh objects,393,088 LOD0 triangles; cached LOD payload72.89MiB. Six decorative Paulista envelopes add4 cells,12 meshes,14,896 triangles and2.05MiB. Combined new groups:117 cells,351 renderables,407,984 LOD0 triangles, approximately74.93MiB resident attribute payload. GPU payload depends on which cached levels have been uploaded; these are calculated buffers, not physical VRAM measurements. Texture payload stays shared at4.33MiB,2 materials/4 maps, zero new lights.

Milestone tests:99 Node tests plus16 architecture browser suites/contracts. One measurement per desktop/mobile day/night scenario:2s warmup,10s sample, same normal hero shot, fixed high/medium tiers and existing1440×900 DPR1.5 /375×812 DPR1 settings. Chrome headless, ANGLE Metal Apple M3 Max; emulated mobile is not physical mobile hardware.

| Scenario | Median ms | p95 ms | Full-pipeline calls | Submitted triangles/frame |
|---|---:|---:|---:|---:|
| Desktop high day |9.3|16.0|501–544|1,008,297–1,009,869|
| Desktop high night |9.6|13.2|542–593|1,007,847–1,009,459|
| Mobile medium day |8.3|10.1|182–192|265,520–265,904|
| Mobile medium night |8.3|12.2|243–259|265,838–266,238|

Whole-scene resident objects:845 renderables,156 unique materials,25 referenced textures (includes landmarks, vehicles, public realm, particles and post-independent scene content). Do not confuse these counts with the new architecture's2 materials/4 maps, or submitted multi-pass triangles with unique LOD0 triangles.

Baseline median16.6–16.7ms / p9517.5–17.7ms, zero console errors; final also zero errors. Browser scheduling cadence changed from approximately60Hz to approximately120Hz between series despite the same host/GPU/settings: report the raw samples, do not claim a measured2× rendering speedup or a calibrated paired p95 improvement. Counts show higher submissions but lower submitted geometry. Local performance GO reflects the observed final workload, not a guarantee on other hardware.

Raw measurements, coverage, preservation audit and six captures are in the local `citywide-rollout-2026-10-21` artifact folder. No repeated A/B series, Lighthouse or additional polish was performed.

## Diversity/completion measurement — 2026-10-21

New citywide groups now contain148 occupied cells,444 active architecture meshes,530,826 unique LOD0 triangles and94.07MiB cached geometry attribute payload. These include the decorative groups; approved controls are additional. The81 newly completed lots add27 ordinary occupied cells. Architectural resources remain2 shared materials/4 maps/~4.33MiB; no new lights. Whole-scene counts are922 renderables,149 materials,25 referenced textures,570 geometries; those include legacy landmarks/public realm/vehicles.

One day sample per scenario,2s warmup+10s sampling, fixed tiers, no adaptive downgrade. Verified dedicated Chrome155 headless/ANGLE Metal Apple M3 Max. Desktop1440×900 DPR1.5 high: median16.7ms, p9520.1ms,491–535 full-pipeline calls,855,789–857,373 submitted triangles. Emulated mobile375×812 DPR1 medium: median16.7ms, p9518.0ms,175–186 calls,229,966–230,362 triangles. Zero console errors. These are frame intervals including browser scheduling, not GPU timings or physical-phone results.

The prior series used a different scheduling cadence; no calibrated paired p95 improvement/regression is claimed. PERFORMANCE GO is local/provisional for this observed workload, not a calibrated regression certificate. No broad benchmark or repeated A/B was run.

Backdrop:2,129→2,303 instanced boxes (25,548→27,636 unique box triangles),21→14 existing palette colors. Added silhouette segments replace141 window boxes; the result trades a small amount of cheap geometry for better distant massing without new palette materials. Public realm still uses existing box/material batches and existing placements.

Focused validation:15 Node tests,8 related browser contracts (citywide, diversity, five archetype builders, public walks), plus byte fingerprints of66 baseline mesh buffers/transforms/shadow flags unchanged. No map/layout/renderer/lighting source files changed in this pass. Raw metrics/captures and preservation audit: local artifact folder `citywide-diversity-2026-10-21`.

## Hero facade diversity — 2026-10-21

Nine local shops/frontages:12 renderables unchanged across four existing batches;8,874 unique triangles (before10,906,−18.63%),2 shared materials/4 maps. Desktop high observed local submissions/frame:12 color +12 normal/GTAO +8 shadow =32. No new resources/lights or renderer change.

Desktop1440×900 DPR1.5 high/day,2s warmup+10s sample: initial median19.1ms/p9528.2ms exceeded the20.1ms prior reference and triggered investigation. Confirmation with one active task scene and verified GTAO high: median16.7ms/p9518.3ms, zero console errors; whole-scene calls461–523, submitted triangles848,613–850,941. Initial outlier retained; no speedup claim. An investigative BEFORE perf run reported high but had no GTAO pass (initialized at narrow viewport); it is invalid as a matched performance baseline and excluded from comparisons. Final BEFORE screenshot was recaptured with desktop size set before navigation and normal-pass execution verified.

Four related browser contracts plus syntax/diff checks passed. Exact camera and476 unrelated architectural mesh fingerprints match. Evidence/raw initial and confirmation runs: local `hero-facade-diversity-2026-10-21` artifact folder. PERFORMANCE GO local/provisional; not a broad benchmark or physical-device certification.

## Final art pass — 2026-10-21

Architecture buffers (488 meshes), transforms and shadow flags match the BEFORE fingerprints; all building/recipe/chunk/LOD source files remain unchanged. Vegetation163 trees +110 low shrub instances uses2 batches, one additional material, no new textures. Hero realm remains3 meshes/2 shared materials/4 maps,4,688 unique triangles. No new lights/shadow maps; rounded clouds reuse the previous cloud draw structure. Whole-scene count in the final desktop sample:925 renderables,150 materials,25 textures,571 geometries; random cloud counts prevent interpreting whole-scene object deltas as architecture changes.

Desktop high1440×900 DPR1.5 day: confirmed median16.7ms/p9518.7ms,492–534 calls,863,077–864,741 submitted triangles. Mobile emulated medium375×812 DPR1 day: median16.7ms/p9518.6ms,174–185 calls,235,370–235,818 triangles. Each sample uses2s warmup+10s sampling, fixed tiers, dedicated Chrome155 Headless/ANGLE Metal Apple M3 Max; zero console errors.

Initial desktop p9525.4ms triggered investigation: a desktop-initialized high BEFORE gave31.9ms and a subsequent AFTER confirmation18.7ms. All raw samples are retained. Scheduling/load variation is material; no calibrated speedup or stable regression delta is claimed against the operational18.3ms reference. PERFORMANCE GO local/provisional. No wide matrix or dozens of repetitions.

14 related Node tests,4 focused browser contracts, source syntax and git diff --check passed. Circulation tests cover15,650 tree/path probes and9,782 public-space collision probes. Vegetation resource disposal is idempotent and wired into world teardown; that teardown-only addition followed sampling and does not change rendering. Raw evidence and four BEFORE/AFTER camera pairs: local `final-city-art-pass-2026-10-21` folder.

## Material/landmark finish — 2026-10-21

Same2 shared architectural materials/4 generated maps/~4.33MiB, same opaque water plane/2 triangles, unchanged landmark instancing/matrices/material identities. No new materials/textures/lights/render passes. Reflection is analytic GLSL shared by architecture/landmark glass; landmark roughness/metalness/edge tuning uses bounded masks in existing block materials.488 architectural mesh fingerprints match BEFORE; building geometry/recipes/chunks/LOD/layout sources unchanged.

One day sample each,2s warmup+10s sample, fixed tiers, dedicated Chrome155 Headless/ANGLE Metal Apple M3 Max:

| Scenario | Median ms | p95 ms | Full-pipeline calls | Submitted triangles/frame |
|---|---:|---:|---:|---:|
| Desktop high1440×900 DPR1.5 |16.6|18.5|470–507|862,181–863,525|
| Emulated mobile medium375×812 DPR1 |16.7|18.5|170–174|235,114–235,334|

Whole-scene sample:930 renderables (random cloud count varies),150 materials,25 textures,571 geometries. Zero console errors; actual glass and landmark night uniforms reach1. Operational references18.7/18.6ms are not calibrated paired baselines; no speedup claimed. PERFORMANCE GO local/provisional, FINAL VISUAL NO-GO due remaining legacy landmark silhouettes.

Three focused Node tests (Wembley/Glasgow landmark contracts),four browser contracts (material-polish/building-slice/citywide/landmarks), day/night uniform check, syntax and git diff --check passed. Three same-camera BEFORE/AFTER pairs and raw evidence: local `final-material-landmark-polish-2026-10-21` folder. No broad benchmark.


## Final milestone validation — 2026-10-21

Visual system approved/frozen; **PERFORMANCE: GO local, FUNCTIONAL: NO-GO, PRODUCTION-READY: NO** because zfight.browser.py still fails. No automatic optimization or geometry correction performed.

One day sample per device in the same normal main shot;2s warmup,10s sampling, tier locked only in temporary validation snapshots. Dedicated Chrome155 Headless, ANGLE Metal/AppleM3Max. Desktop1440×900 DPR1.5/high (2160×1350 buffer); mobile emulated375×812 DPR1/medium (375×812 buffer). No CPU throttling or physical-phone measurement. No anomalous sample required an additional performance confirmation.

| Scenario | Median ms | p95 ms | Full-pipeline calls/frame | Submitted triangles/frame | Resident renderables | Unique materials | Referenced textures |
|---|---:|---:|---:|---:|---:|---:|---:|
| Desktop high day |16.7|17.7|493–536|857,365–858,989|932|148|25|
| Emulated mobile medium day |16.7|17.6|168–180|234,554–235,066|929|148|25|

Both scenes contain294 InstancedMeshes and580 resident geometry objects. Renderables count resident scene objects, not only visible submissions. Random clouds/animated content explain some inter-run object/call variation. These are frame intervals including browser scheduling, not isolated GPU timings or a calibrated A/B speedup. Zero console errors observed. The prior18.3ms desktop value remains an operational reference only.

Architectural resources remain2 materials/4 maps/~4.33MiB; scene totals above include vehicles, landscape, landmarks and sprites. Citywide groups:148 cells/444 meshes,530,826 unique LOD0 triangles/~94.07MiB cached attribute payload; all architecture including controls/special groups has488 mesh objects. Townhouse LOD and culling evidence above remains valid; the final suite reran its deterministic contracts, not an extensive moving-camera performance series.

Modernized landmarks: Wembley3 meshes/5,812 unique triangles/8 high submissions; Big Ben-Parliament plus clocks4 meshes/2,496 triangles/10 submissions; MASP3 meshes/552 triangles/8 submissions. Existing pipeline counts include color/normal/shadow; no new materials/maps/lights/passes.

Final checks:101/101 Node tests;31/32 browser suites. The legacy z-fighting scan initially timed out; a sorted X-interval candidate sweep retains every original face predicate and now reports327 conflicting pairs. A separate live-scene probe confirms191 pairs in production box batches, including parks.js soil/rim faces. This gate is not waived. Syntax:54 ES modules/32 Python suites; git diff --check clean. Fallback/EN-PT/navigation/reduced-motion/resize contracts pass. Five visual smoke captures show no new regression; London Eye remains segmented. Lighthouse and physical-mobile validation were not run.

Evidence: machine-local artifact folder `city-final-milestone-freeze-2026-10-21` contains raw samples, suite results, coplanar diagnostic, source-preservation audit and exactly five smoke captures. Validation hooks and adaptive-tier lock exist only in the temporary snapshot, not shipped source. No commit/deploy.

## North Star full-scene upgrade — 2026-10-21

New resources: one display-space grade ShaderPass after OutputPass (both tiers; full-screen, no texture fetch beyond the frame); one road-marking mesh (vertex colours, 1 material); vehicle family shared per type (sedan/hatch/SUV/cab/van ≤ 3k tris each, Mini 4.5k, bus 4.2k); landmark creators reuse the shared atlas mass/trim/glass buckets (Eye 3.9k, Estaiada 0.7k, Sé 4.7k, Tower Bridge 5.7k, Heathrow 0.9k, plane 2.3k, Copan 4.0k, Riverside 0.6k, University 4.0k, City Chambers 6.9k, Wellington 1.3k tris). No new textures, lights, shadow maps or cubemaps.

One sample per device, 2 s warmup + 10 s, same hero shot, Chrome (ANGLE Metal, Apple M3 Max), cache disabled: desktop 1440×900 DPR 1.5 median 8.3 ms / p95 9.3 ms; emulated mobile 375×812 DPR 1 median 8.3 ms / p95 9.3 ms (both at the 120 Hz scheduling cap). Zero console errors. Frame intervals include browser scheduling; not a calibrated A/B or physical-device result. Draw calls/triangles not re-instrumented in this pass.

Gates: 101/101 Node, 32/32 browser suites including the strict coplanar guard (0 pairs). PERFORMANCE GO local; physical mobile still unvalidated.

## Vehicles/night baseline — 2026-10-21 (official for the vehicles/Heathrow/night-lighting plan)

Captured before phase 1 at commit 0e5531b. Contract above: desktop 1440×900 DPR 1.5 high, emulated mobile 375×812 DPR 1 medium, 2 s warmup + 10 s sample, cache disabled, day, Chrome (ANGLE Metal, Apple M3 Max). Draw calls and submitted triangles are counted per frame by wrapping WebGL2 `draw*` calls in the test page only (all passes: shadow, normal/GTAO, colour, post). Calls/tris shown as median per frame (min–max). Heap = `performance.memory.usedJSHeapSize`; `renderer.info.memory` is not reachable without shipped instrumentation.

| Scenario | Repeats | Median ms | p95 ms | Calls/frame | Submitted tris/frame | JS heap MiB |
|---|---:|---:|---:|---:|---:|---:|
| Desktop high, hero shot | 3 | 8.3 / 8.3 / 8.3 | 9.0 / 8.9 / 8.8 | 430 / 438 / 433 (429–458) | 863.1k / 863.6k / 863.3k | 226–231 |
| Mobile medium, hero shot | 3 | 8.3 / 8.3 / 8.3 | 9.2 / 9.2 / 9.1 | 168 / 175 / 169 (166–183) | 238.7k / 239.1k / 238.7k | 185–206 |
| Supplementary: desktop, London stop 10, day | 1 | 8.3 | 8.7 | 761 | 1,006.5k | 244 |
| Supplementary: mobile, London stop 10, day | 1 | 8.3 | 9.1 | 183 | 222.5k | 183 |
| Supplementary: desktop, London stop 10, night | 1 | 8.3 | 8.6 | 849 | 1,006.6k | 243 |
| Supplementary: mobile, London stop 10, night | 1 | 8.3 | 9.1 | 267 | 222.4k | 216 |

Frame intervals sit at the 120 Hz scheduling cap, so frame-time ceilings are only meaningful if work grows past it. Ceilings for this plan: calls ≤ +5%, submitted tris ≤ +5%, desktop p95 ≤ +1 ms, mobile p95 ≤ +2 ms (vs hero baseline; the London rows are tracked as supplementary evidence). Zero console errors.

## Vehicles/Heathrow/night-lighting final — 2026-10-21

Same harness as the baseline above (HEAD e053b4b + near-side frontage fix). Hero shot is the official comparison.

| Scenario | Repeats | Median ms | p95 ms | Calls/frame | Submitted tris/frame | vs baseline |
|---|---:|---:|---:|---:|---:|---|
| Desktop high, hero | 3 | 8.3 | 9.5 / 9.3 / 10.0 | 438 / 432 / 422 | 866.6k / 866.2k / 865.5k | calls −0.5%, tris +0.4%, p95 +0.7 ms ✅ |
| Mobile medium, hero | 3 | 8.3 | 9.7 / 10.1 / 10.0 | 164 / 163 / 174 | 238.7k / 238.7k / 239.4k | calls −1.4%, tris +0.1%, p95 +0.8 ms ✅ |
| Supplementary desktop, stop 10 day | 1 | 8.3 | 9.4 | 670 | 1,061–1,065k | calls −12%, tris **+5.4–5.8%** |
| Supplementary mobile, stop 10 day | 1 | 8.3 | 9.9 | 171 | 244.0k | calls −7%, tris **+9.8%** |
| Supplementary desktop, stop 10 night | 1 | 8.3 | 9.5 | 748 | 1,064k | calls −12%, tris +5.7% |
| Supplementary mobile, stop 10 night | 1 | 8.3 | 9.8 | 234 | 244.5k | calls −12%, tris +9.9% |

Bisection by commit at stop 10 (desktop/mobile tris): baseline 1,006.7k/222.2k → lighting 1,011.6k/225.1k → Heathrow removal + riverside fill 1,054.2k/240.6k → vehicle models 1,055.3k/244.0k → A330 + traffic 1,068.8k/244.6k. The London-stop triangle growth comes mainly from the requested rebuild of the old airport site (new buildings also render in the shadow pass); trimming traffic did not change it measurably. Zero console errors; 33/33 browser suites, 106/106 Node tests. Frame intervals stay at the 120 Hz cap.

## City density / environment pass — 2026-10-23

Changes: 21 own-RNG plots filling the band behind Parliament/Big Ben (Big Ben sky window kept ≤ 24 m within ±14 m), behind Tower Bridge and a London back row; denser mid-band backdrop (2,303 → 2,812 instanced boxes); more tower/office/midrise crown, spandrel, reveal and glass-tint variety; facade material fix (no baked window glare band, metre-scale plaster/brick variation, stronger bump, ground grime, uniform per-pane night windows); 3D low-poly tree family (3 types, spatially chunked + frustum-culled instancing); instanced K6 telephone kiosks facing the road. Existing 500 plot descriptors unchanged.

A/B vs HEAD (3 runs each, same harness):

| Scene | Desktop calls | Desktop tris | Desktop p95 | Mobile calls | Mobile tris | Mobile p95 |
|---|---|---|---|---|---|---|
| Hero | ~485 → ~508 (+5%) | 919.6k → 1,049.5k (+14%) | 9.3–9.7 → 9.3–9.7 ms | ~183 → ~196 | 259.7k → 292.1k (+12%) | 9.6–9.8 → 9.7–9.9 ms |
| London stop 10 | ~699 → ~750 (+7%) | 1,132.4k → 1,407.2k (+24%) | 9.1–9.6 → 8.5–8.7 ms | ~194 → ~195 | 266.7k → 327.4k (+23%) | 9.5–10.0 → 9.7–9.9 ms |
| Stack 13.5 | ~622 → ~690 (+11%) | 1,028.4k → 1,242.0k (+21%) | 9.2–9.6 → 8.4–9.6 ms | ~190 → ~201 | 269.5k → 313.5k (+16%) | 9.8–10.0 → 9.6–10.0 ms |

Medians stay at 8.3 ms (120 Hz cap); p95 within ±1 ms desktop / ±2 ms mobile. Most of the triangle growth is the 3D trees across colour/normal/shadow passes (chunking cut it from +50 % to +24 % at stop 10). 102/102 Node tests, 34/34 browser suites, zero console errors.

## Scene polish pass — 2026-10-23

Legacy lots → rollout recipes, gap-fill lots (+106), roof/palette variety, instanced lamp posts, clustered tree crowns, lens-glow headlamps. A/B against 173a2f9 (perf3, REPS 2, desktop 1440×900 DPR 1.5 / mobile 375×812):

| View | Calls (base → new) | Tris (base → new) | Frame median / p95 |
|---|---|---|---|
| São Paulo 1.5 desktop | ~620 → ~640 | 1.18 M → 1.35 M | 8.3 / 8.7–9.0 ms (both) |
| London 13.2 desktop | ~680 → ~675 | 1.23 M → 1.59 M | 8.3 / 8.7–9.2 ms (both) |
| London 13.2 mobile | ~197 → ~198 | 313 k → 383 k | 8.3 / 9.0–9.2 ms (both) |

Frame time sits at the 120 Hz cap on this machine, so the triangle increase is not yet visible in timing; heap +30–40 MiB. Tree triangles stay under the 250 k test budget (235 k).

## Townhouse modular kit pilot — 2026-10-29

Desktop visual comparison: pre-integration commit `fe6b720da45189a2faffa3d658aadc82f33ac98e` versus raw-kit integration commit `7c715258c5fd9b59576cf900478a43ea65ca6ff7`. The fixed desktop comparison scene uses the same 1440×900 renderer, camera and lot descriptors. Full-scene desktop captures were also taken at stop 5/day and stop 11/night. LOD states were explicitly selected through the pilot update hook.

| Pilot state | Baseline draws | Current draws | Baseline triangles | Current triangles |
|---|---:|---:|---:|---:|
| Nine lots, LOD0 | 6 | 6 | 6,572 | 104,270 |
| Nine lots, LOD1 | 6 | 6 | 3,226 | 3,226 |
| Three-lot control | 3 | 3 | 2,334 | 2,334 |

The nine-lot pilot occupies two spatial chunks, each with three active renderables; the control occupies one chunk with the same three buckets. Per chunk, current pilot draw calls are 3 versus 3 for the control (0% change; within the 10% gate). Triangle counts are workload measurements only. Counts are unique geometry triangles in the isolated one-pass desktop comparison, not whole-scene multipass submissions or frame-time evidence.

`node tools/pipeline/check.mjs` reports the raw kit at 1,812,724 bytes (1.73 MiB), 24,780 triangles, 3 source materials and no textures. The runtime townhouse family still uses 2 shared materials and 4 generated maps (~4.33 MiB).

Visual review found readable raised window/door details at LOD0, intact roof silhouette and facade rhythm, grounded bounds, and no visible z-fighting in the fixed day/night captures. LOD1 retains the procedural facade and roof rhythm at 3,226 triangles. The three-lot control geometry and counts are unchanged.

The required lossless optimizer produced a 688,108-byte candidate with the same 24,780 source triangles. It pruned `TEXCOORD_0`/UV because the source GLB does not reference UVs in its materials. The site merges loaded module geometry with procedural geometry that has UV attributes; the optimized candidate therefore fails pilot adoption and leaves the procedural fallback visible. It is not visually or functionally equivalent and was discarded. The raw GLB remains shipped. The current optimizer CLI has no keep-UV option; its `smooth` mode also changes normals and is not an equivalent preservation path.

Evidence screenshots and the discarded candidate are in machine-local `/private/tmp/townhouse-evidence/`; full-scene baseline screenshots are in `/private/tmp/townhouse-baseline-capture/`. Browser checks passed for building-slice, building-kit, citywide and zfight; Node tests passed 116/116. The citywide browser check needed a 30-second browser-harness IPC timeout because the default 5-second IPC timed out twice; the test itself passed unchanged. No mobile, Lighthouse, physical-device, deployment, or full-pipeline performance benchmark was run. Further townhouse rollout remains approval-gated.
