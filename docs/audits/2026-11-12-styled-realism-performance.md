# Styled realism and bounded architecture delivery — 2026-11-12

Owner requested another realism pass followed by substantial loading/performance work, with parallelism where useful. The owner selected **stylized realism with livelier colours**. This extends the earlier quality-first ordinary-building finish; it does not redesign the map, lots, roof silhouettes, routes, landmarks, weather, content or intro.

## Delivered

- Clearer regional ochre, terracotta, sage, blue and mineral colours. Brighter residential frames separate openings from painted walls; commercial trim uses charcoal/blue-grey/bronze instead of pale stone-like bands. Existing geometry-backed facade hierarchy, interiors and construction profiles remain. Shared PBR shading gives dark coated frames a smoother metallic response and varies glazing roughness. No new lighting, render pass, per-building material or external asset.
- City cells initially own only the light far representation. All five families omit near construction profiles there; townhouse far geometry retains its existing simplification. Nearby cells restore the complete procedural/authored finish, nearest first, one cell per update. Existing 140 m prewarming, 111/129 m hysteresis and 180 m eviction bound retained detail. Far buildings remain visible while their near representation is queued.
- Facade-kit loading registers near factories instead of rebuilding the city at once. Mixed cells retain authored townhouse modules; late kits replace procedural near detail safely; failed kit families keep their procedural fallback. Disposal switches active geometry before releasing it and deduplicates aliased far buffers.
- The pure atlas generator runs in one temporary module worker and transfers its arrays. Worker creation/script failure uses the synchronous generator. The worker is terminated after preparation. **All six albedo/normal/ORM hashes remain identical** for ordinary and preserved landmark maps; resolution and texture quality are unchanged.
- One shared native Meshopt worker decodes compressed GLB geometry. Exact decoded bytes and blocked-constructor fallback were tested. KTX2 already had its own worker pool; this work does not claim to add that existing capability. Worker count is bounded rather than proportional to building count.
- Tree GLBs and their atlas start together; trees, phone boxes, lamps and street-prop imports/assembly start concurrently. Tree resource failures release successful atlas/root loads and retain the existing procedural fallback.
- Reduced motion receives finite preparation frames until nearby detail is complete, then returns to idle. Load-completion notifications wake late kit factories; scene teardown removes the subscription. Clock-driven animation remains frozen. The separate Paulista decorative architecture group participates in the same delivery updates.

## Measurements

Startup uses real Chrome, visible tab, 1440×900 CSS, DPR 1, day/clear, disabled HTTP cache, service-worker bypass, local HTTP and the same CPU profiler/hooks on both versions. Three runs per version. The baseline is an overlay of the exact pre-task owning sources, reconstructed from initial reads without changing the working tree. This avoids comparing mixed old/new service-worker modules. It is a local cold-cache comparison, not a public-network or physical-phone claim.

| Metric | Baseline runs, ms | After runs, ms | Median change |
|---|---|---|---|
| `world-ready` | 6510.9 / 6698.3 / 6683.9 | 3426.6 / 3535.8 / 3405.9 | 6683.9 → 3426.6, −48.7% |
| First actual rendered frame | 7183.0 / 7401.2 / 7329.0 | 4131.2 / 4143.8 / 4034.3 | 7329.0 → 4131.2, −43.6% |
| Cumulative long tasks through sample | 6328 / 6399 / 6401 | 2733 / 2466 / 2493 | 6399 → 2493, −61.0% |
| Longest task | 4522 / 4640 / 4661 | 867 / 819 / 773 | 4640 → 819, −82.3% |

The profiler formerly asserted immediately after `world-ready`, sometimes before any frame. It now waits for a real frame and reports that timestamp separately. These are scene-readiness metrics, not LCP/INP or a claim that the HTML panel waits for the scene. GLB bytes are unchanged; approximately 104.1 MiB were observed through the profiled sampling window. This pass reduces CPU work and retained detail, not the total fleet download payload.

Identical full descriptor fixture, 691 lots / 194 cells, kits disabled to isolate allocation (production road filtering removes four of these lots):

| Cached architecture buffers | Before | After initial | After near preparation at (0,35,80) |
|---|---:|---:|---:|
| Unique attribute bytes | 903,357,096 | 116,218,032 | 183,256,104 |
| MiB | 861.51 | 110.83 | 174.77 |
| Unique geometry triangles | 5,781,498 | 738,828 | 1,168,034 |

Initial attribute allocation falls **87.1%**. The near sample builds 25 cells; this is a bounded camera-local sample, not a citywide upper bound or physical VRAM. Materials/atlas payload is unchanged at approximately 21.67 MiB including the preserved legacy maps. Full-scene JS heap, render submissions and frame time are separate measurements.

The moving London–Glasgow segment (stops 8.5–11.5) was also repeated three times per version: 1440×900 CSS, DPR 1.5, day/clear, 10 s trajectory, the postprocessing tier explicitly pinned to `high`, cache disabled and service-worker bypass. Median frame times overlap (before 25.2–33.2 ms; after 25.4–31.6 ms), so **no clear steady-FPS gain is claimed**. The median of per-run p95 values moves only 58.4 → 56.7 ms; p99 moves 91.7 → 66.6 ms. Largest observed main-thread task per run falls from 191–228 to 68–80 ms. Median peak reported JS heap falls from 2356 to 1168 MiB (−50.4%). These are `performance.memory` estimates, not RSS or VRAM. Submissions include all render passes; median draw calls remain about 1580 and triangles about 12.48 → 11.85 million. Runtime rendering and large model payloads remain substantial.

## Validation and review

Full Node regression: **240 passed**, zero failures/skips. Existing ordinary-finish, architecture-archetypes, facade-realism, building-kit, office-facade, facade-interiors and render-resources browser fixtures passed; render-resource checks include 1280px and 375px. New streaming fixture initially failed on eager near allocation, then passed with 1.56 MiB initial versus 9.40 MiB complete-near geometry in its five-family sample. Loader and atlas fixtures were observed failing before implementation, then passed worker/fallback, exact output and failure-cleanup checks.

Independent read-only review found one reduced-motion scheduling regression. The update-result regression was observed failing, then the production propagation/wake fix passed the real 375px reduced-motion stop-jump fixture: 16 nearby cells complete, zero pending, WebGL error 0, followed by a stable frame counter while idle. Reviewer rechecked the fix without further blockers.

The legacy `citywide.browser.py` envelope guard remains failing. The pre-task baseline reproduces `source footprint/height` in `architecture-cell--128-32` at approximately (-95.6976, 8.3, 50.6862). Do not weaken that guard or count the suite as passing. Unique-buffer counting/disposal assertions were updated to count aliased far buffers once; their ceilings remain unchanged.

Final streetscape integration passed after creating its expected temporary screenshot directory; the first runner failure was a missing `/tmp/scenery-review/` output folder, after all application assertions had already passed. EN/PT WebGL-disabled startup and PT WebGL/reduced-motion startup passed with empty error arrays. Final city captures cover São Paulo day, London day and Glasgow night; the 375px rain/reduced-motion capture reports WebGL error 0 and zero failed shader programs. Fine geometry still aliases in the existing mobile render path; functional validation does not establish physical-phone image quality.

Evidence: [Node output](../evidence/styled-realism-performance/node.log), [initial broad browser suite](../evidence/styled-realism-performance/styled-browser-suite.log), [final streaming/material/citywide output](../evidence/styled-realism-performance/focused-final.log), [streetscape rerun](../evidence/styled-realism-performance/styled-streetscape-final.log), [fallback/locale startup](../evidence/styled-realism-performance/styled-startup-smoke-final.log), [rain GL probe](../evidence/styled-realism-performance/styled-rain-final.log), [review](../evidence/styled-realism-performance/review.md), [baseline source hashes](../evidence/styled-realism-performance/baseline-source-manifest.json), [runtime source delta](../evidence/styled-realism-performance/runtime-change.patch). Raw startup JSON and the three route-run summaries per version are alongside these files.

Visuals: [London before/after](../evidence/styled-realism-performance/london-comparison.jpg), [São Paulo](../evidence/styled-realism-performance/5-day.jpg), [London](../evidence/styled-realism-performance/9.5-day.jpg), [Glasgow night](../evidence/styled-realism-performance/11-night.jpg), [375px rain/reduced motion](../evidence/styled-realism-performance/mobile-rain-reduced.jpg). Moving people, vehicles and clouds are not synchronized between captures; these are visual inspection evidence, not pixel-difference tests.

**Local scoped GO for the material/delivery change. Global production-readiness remains unestablished**, including the inherited envelope failure and physical-device/rendering limitations.

## Limits

Near cell construction still occurs synchronously, one cell per update; that bounds count, not milliseconds of an unusually heavy cell. Large GLBs, other scene systems, shader compilation and GPU render cost remain. No new dependency/build step, commit, push or deployment. Physical mobile, physical VRAM, Lighthouse and field-network/RUM measurements were not performed. The existing citywide envelope failure prevents a global all-checks-passing declaration.

## Follow-up: house outlines

Owner screenshots identified thick black lines around townhouse fronts. Reproduced in a matched close-up: the two downpipes and front gutter were tagged as roof, causing the shared vertical-roof/spandrel shading to turn them nearly black. `building-slice.js` now assigns those existing pieces to painted trim. Their geometry, placement and counts remain unchanged; procedural and loaded-kit houses share the corrected source. Commercial metal and roof materials are unchanged.

The new `house-drainage.browser.py` regression failed before the fix, then passed for gable/side/hip roofs in procedural and loaded-kit paths. `ordinary-finish` and `facade-realism` passed; 240 Node tests passed. Matching close-ups rendered with WebGL error 0. No new performance benchmark or physical-device matrix was run for this two-line material-role correction. [Browser results](../evidence/house-drainage/browser.log), [Node results](../evidence/house-drainage/node.log).
