# Independent desktop graphics audit — 2026-11-01

Status: in progress. Baseline HEAD `f125de9` on `feat/site-gamefication`; working tree was clean at start. Existing Claude worktrees were left untouched. Mobile is outside scope. The Copan and raw vehicle GLB default are protected.

## Method and execution plan

1. Inventory and independently assess the prior audit and current runtime; record confirmed defects separately from hypotheses.
2. Capture desktop baseline along the actual route, day and night; investigate high-priority issues before editing.
3. Resolve verified defects in isolated, reviewable changes; validate in Three.js and compare matched views.
4. Measure desktop performance under reproducible conditions, repeat route review, document limitations and commit coherent milestones.

Browser and GPU captures are serialized. Agents own non-overlapping systems; the primary agent reviews their findings and changes.

## Baseline evidence

Chrome 156 reported ANGLE Metal on Apple M3 Max; viewport 1728 × 907. Initial clear-weather desktop captures at stops 5, 12 and 13, day and night, were saved under `/tmp/codex-graphics-baseline/`. These are preliminary and do not represent complete route coverage. Visual inspection confirms tall towers dominate the views at 12 and 13. Their exact plot IDs still need screen-space verification.

| ID | Priority | System | Status | Evidence and next step |
| --- | --- | --- | --- | --- |
| GFX-001 | P2 | MASP LOD | Fixed and visually checked | Matched forced-LOD captures showed a visible facade change and missing benches. Runtime now retains detailed LOD0; final validation pending. |
| GFX-002 | P2 | Regional buildings | Fixed; visual route views checked | Projected plot positions onto the camera and capped four isolated towers in the London return area; the background towers remain. |
| GFX-003 | P2 | Vegetation lighting | Hypothesis | Tree impostors have baked shading, camera-facing Lambert normals and different shadow participation from LOD0/1. Isolate transitions before changing illumination. |

## Prior audit verification

Pending independent runtime verification. Raw GLBs remain the vehicle default (`js/world/vehicle-assets.js`); 3D NPCs default on desktop (`js/world/scene.js`). Prior SwiftShader timing is not representative of hardware GPU performance.

## Outstanding coverage

Complete route, individual landmarks and vehicles, NPC close/medium/crowd, LOD transitions, before/after evidence, and performance comparison remain pending. No overall visual or performance approval is claimed.

## Asset and NPC inventory (static inspection)

- Eleven raw vehicle GLBs total 135,260,484 bytes (128.99 MiB); this is a directory total, not measured bytes transferred in a cold visit. The loader caches by type and uses processed assets only with `?glb=processed`; raw remains the browser default.
- `assets/processed/vehicles/mini-cooper-2011.lod1.glb` is listed in the manifest but has no identified runtime reference. Its intended pipeline role remains unresolved; it has not been removed.
- Desktop NPC runtime creates a pool of 56 from `assets/npc/npc_pack.glb`; the pack has 21 character variants, two rigs and six walk clips. `npcnear` changes the diagnostic camera; it does not set the population. Visual quality, animation and performance remain unverified in this audit.
- P2 tower candidates were recomputed with the actual route curve: `block-623--38` (86.4 m), `block-672--46` and `block-693--52` (57.6 m each), `block-643--80` (50.4 m), `block-681--93` (72 m), and `block-695--93` (61.2 m). These are in the London return region; screen-to-plot mapping and a contextual remedy remain open. An earlier candidate list based on an approximate curve was discarded.

## Route baseline capture

Captured all 18 current stop indices, day and night, on the untouched `f125de9` worktree with `qa=1&weather=clear`, raw vehicle defaults and desktop NPC defaults. Files: `/tmp/codex-graphics-route-before/`; viewport 1728 × 907 CSS pixels (3456 × 1814 image pixels). All 36 images have grayscale standard deviation above 20, excluding blank captures; contact sheets were visually inspected. These fixed-stop views do not establish approach/pass/recede coverage or individual asset quality. Full matched after capture remains pending.

An experimental MASP LOD1 rebake was superseded after matched forced-LOD captures showed additional visible geometry differences. Runtime now retains LOD0 instead. The complete Node suite passed with zero failures before the latest changes; final browser and runtime validation remain pending.

## Owner-reported landmark transitions

| ID | Priority | System | Status | Evidence |
| --- | --- | --- | --- | --- |
| GFX-004 | P1 | Sé / MASP startup | Fixed; automated startup scenarios passed | First RAF can run before asynchronous authored GLBs replace procedural groups. Gate first render while the asset attempts settle; preserve a bounded failure fallback and prevent late replacement. |
| GFX-005 | P1 | Sé LOD | Fixed and visually checked | Distant LOD simplifies dome profile, facade depth and tracery enough to change landmark appearance. Keep the detailed authored LOD at all distances; measure impact and verify in desktop scene. |
| GFX-006 | P2 | Shadow snapping | Corrected; static views checked | Snapping now uses the shadow frustum and actual 2048 map dimensions. Motion-specific visual benefit remains unmeasured. |

User screenshots on 2026-11-01 document the procedural-to-authored swaps and two Sé representations. Their priority takes precedence over remaining audit items.

## Hardware baseline (preliminary)

Chrome 156, ANGLE Metal / Apple M3 Max, 1600 × 900, clear day, raw GLBs, desktop NPC default; 120 `requestAnimationFrame` intervals after settling at each stop. Stop 5: median 8.3 ms, p95 8.5 ms, ~1,264 GL draw calls and ~11.56 million submitted triangles/frame; stop 11: 8.3/9.4 ms, ~1,150 draws, ~9.65 million triangles; stop 13: 8.3/8.4 ms, ~1,148 draws, ~8.38 million triangles. Triangles include instancing and passes. Intervals are refresh-paced frame intervals, not GPU execution time; these single samples cannot establish a performance guarantee. Matching after samples and resource-transfer verification remain pending. Raw data: `/tmp/codex-gpu-before.json`.

Across the cold-cache hardware baseline session after stops 5, 11 and 13, Resource Timing reported 26 GLB requests and 143.93 MiB encoded bodies. This covers all GLBs requested by that session, including NPCs and landmarks; it is not the initial-page vehicle payload, and browser transfer/cache behavior can differ in deployment.

## Landmark visual comparison

Sé at the same locked camera, desktop day and night: [day](../evidence/2026-11-01-landmark-audit/se-lod-day.jpg), [night](../evidence/2026-11-01-landmark-audit/se-lod-night.jpg). Columns: original LOD0, original LOD1, current LOD0, current view when the old LOD1 would have been selected. The original LOD1 visibly changes the dome and facade; the current runtime only loads LOD0. Forced selection was used for diagnosis; route-motion and performance checks remain pending.

MASP in the same locked desktop camera: [day](../evidence/2026-11-01-landmark-audit/masp-lod-day.jpg), [night](../evidence/2026-11-01-landmark-audit/masp-lod-night.jpg). Columns: original LOD0, original LOD1, current LOD0, current view when the former distant LOD would have been selected. The original distant mesh removes the benches and changes the facade. Both landmarks now load only their authored LOD0; no GLB files were modified. Extra unique triangles when distant: 3,253 for Sé (4,544 vs 1,291) and 1,326 for MASP (1,568 vs 242); both continue with one visible mesh.

Startup validation: `tests/landmark-startup.browser.py` passed successful loads, failed loads, requests that never resolve, late responses, one landmark ready while the other waits, and the corresponding mixed late-response case. The first scene frame waits for the two attempts. On failure or a five-second timeout, procedural geometry is retained for that visit; a late result does not replace it. An unresolved underlying request can remain pending until page unload. The individual Sé and MASP browser tests passed; the full Node suite passed with zero failures after these changes.

Hardware comparison on the same Apple M3 Max / Chrome desktop viewport: two short runs per state gave medians of 8.3–8.4 ms at stops 5, 11 and 13. Baseline p95 ranged from 8.4 to 16.7 ms; current p95 was 16.7–17.2 ms. These are refresh-paced `requestAnimationFrame` intervals over 120 samples, not GPU execution times; the variability and differing scene work prevent a reliable attribution or a claim of no regression. Further controlled profiling is open. The baseline was served from detached worktree `f125de9` on port 8001; the current worktree was served on port 8000.

Landmark milestone: commit `6a95915`. The five-second fallback and pending-request limitation remain as described above; these checks do not close the rest of the audit.

## Regional towers

The reported towers are in the London return section, not the Glasgow region. Camera projection identified the prominent `block-623--38`, `block-672--46`, `block-693--52` and the immediately adjacent rear `block-595--80`. Their heights changed respectively from 86.4/57.6/57.6/79.2 m to 21.6/18/21.6/25.2 m, retaining footprints, plot IDs and RNG consumption. Three other rear towers remain at 50.4/72/61.2 m. Day/night views at matching stops and viewport: [12 day](../evidence/2026-11-01-landmark-audit/towers-12-day.jpg), [12 night](../evidence/2026-11-01-landmark-audit/towers-12-night.jpg), [13 day](../evidence/2026-11-01-landmark-audit/towers-13-day.jpg), [13 night](../evidence/2026-11-01-landmark-audit/towers-13-night.jpg). Moving vehicles and weather details were not frozen; camera pose was not independently logged in these captures. Targeted Node tests, `citywide.browser.py` and `diversity.browser.py` passed. Independent code review found no concrete issue.

## Shadow snapping

The light-space snapping increment now derives from the orthographic frustum and shadow map dimensions: 0.078125 m per axis for the current 160 m / 2048 map, replacing a two-texel step. Direction, map size and frustum are unchanged. Review confirmed the calculation; desktop static views at stops 0, 1 and 5 showed no obvious regression ([stop 1 comparison](../evidence/2026-11-01-landmark-audit/shadow-snap-stop1.jpg)). These stills do not prove reduced shimmer during movement.

## NPC loading fallback — GFX-007 (P1)

Previously, failed NPC GLB loading rejected the entire world startup. The loader now keeps the sprite crowd on failure, timeout or failed assembly; late GLBs are not adopted and their resources are released. The browser test passed success, failed fetch, timeout and late response; Node tests cover partial assembly cleanup. [Failure comparison](../evidence/2026-11-01-landmark-audit/npc-load-failure.jpg): forced NPC fetch failure before (no WebGL world) and after (3D city with sprite crowd), both desktop day. A load exceeding five seconds uses sprites for that visit; the underlying request itself is not canceled. Visual quality of the five NPC bases and walk animation still requires close, unobstructed review.

## Vehicle visual replacement during fade — GFX-008 (P2)

An ambient vehicle changing its body, beams or bus livery during an active fade could escape the existing fade state or restore the old paint. The shared update helper restores the original materials, performs the change, and reapplies the same fade factor; it only traverses on mutation. Node tests and a browser test using actual Three.js objects passed. [Controlled desktop comparison](../evidence/2026-11-01-landmark-audit/vehicle-fade.jpg): same route camera, regional bus held at a diagnostic position, fade factor 0.5 and Glasgow reskin; before the paint opacity was 1, after it was 0.5. Traffic positions were not frozen, and natural route-trigger coverage remains open.

## Reproducible desktop sampling

`tools/qa/hardware-stats.py` samples the active Chrome desktop at 1600 × 900, verifies a clean source worktree and visible scene frames, and records renderer identification, rAF intervals, draw/triangle calls, resident geometry/texture counts and GLB resource timing. The revision-to-server correspondence and completion of unrelated asynchronous assets must still be verified by the operator; the graphics tier can change automatically. Timing is rAF cadence, not GPU execution time. [Clean-worktree baseline at 6a95915](../evidence/2026-11-01-landmark-audit/hardware-baseline-6a95915.json) was captured on Apple M3 Max; comparison against final committed state remains pending.

## Crowd visibility after camera jumps — GFX-009 (P2)

The 3D crowd could select walkers using stale sprite visibility after a large camera move; frozen and reduced-motion scenes also skipped visibility updates. Sprite visibility now updates first, invisible candidates are excluded, and stationary poses remain frozen. Seven targeted Node cases and desktop browser scenarios for an 897 m camera jump with zero delta and reduced motion passed, as did `people.browser.py`. Commits: `da22cc7`. Close visual review of NPC faces and walking remains open.

## Failed bus model replacement — GFX-010 (P2)

A failed São Paulo bus upgrade could apply its light metadata to the already loaded London model. The metadata update now requires the requested asset to be active. Desktop `vehicles.browser.py` passed, including the failed replacement scenario; an actual visible lighting defect from this path was not established. Commit: `c88e3d1`.

A subsequent clean-worktree sample at `3599e49` is recorded in [hardware current](../evidence/2026-11-01-landmark-audit/hardware-current-3599e49.json). At stops 5/11/13, median frame intervals were 8.35/8.3/8.4 ms and p95 16.7/16.7/16.8 ms. Draws per world frame were approximately 1214/1143/1142 and submitted triangles 10.81/9.56/8.39 million. The comparable `6a95915` baseline, automated quality tier, asynchronous loading and limited samples constrain attribution; these measurements do not establish GPU execution time or guarantee absence of regression.
