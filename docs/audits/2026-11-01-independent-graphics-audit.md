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
| GFX-001 | P2 | MASP LOD | Fix in progress | Matched forced-LOD captures showed a visible facade change and missing benches. Runtime now retains detailed LOD0; final validation pending. |
| GFX-002 | P2 | Regional buildings | Investigating | Stops 12–13 show tall towers. Candidate plots near x=631–696 are in the London return region; map screen objects to IDs before selecting a contextual correction. |
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
| GFX-004 | P1 | Sé / MASP startup | Fix in progress | First RAF can run before asynchronous authored GLBs replace procedural groups. Gate first render while the asset attempts settle; preserve a bounded failure fallback and prevent late replacement. |
| GFX-005 | P1 | Sé LOD | Fix in progress | Distant LOD simplifies dome profile, facade depth and tracery enough to change landmark appearance. Keep the detailed authored LOD at all distances; measure impact and verify in desktop scene. |
| GFX-006 | P2 | Shadow snapping | Confirmed in code, visual impact unverified | The 2048 shadow map uses the earlier `160 / 1024` snapping step, equivalent to two current shadow texels. Inspect shadow motion before changing it. |

User screenshots on 2026-11-01 document the procedural-to-authored swaps and two Sé representations. Their priority takes precedence over remaining audit items.

## Hardware baseline (preliminary)

Chrome 156, ANGLE Metal / Apple M3 Max, 1600 × 900, clear day, raw GLBs, desktop NPC default; 120 `requestAnimationFrame` intervals after settling at each stop. Stop 5: median 8.3 ms, p95 8.5 ms, ~1,264 GL draw calls and ~11.56 million submitted triangles/frame; stop 11: 8.3/9.4 ms, ~1,150 draws, ~9.65 million triangles; stop 13: 8.3/8.4 ms, ~1,148 draws, ~8.38 million triangles. Triangles include instancing and passes. Intervals are refresh-paced frame intervals, not GPU execution time; these single samples cannot establish a performance guarantee. Matching after samples and resource-transfer verification remain pending. Raw data: `/tmp/codex-gpu-before.json`.

Across the cold-cache hardware baseline session after stops 5, 11 and 13, Resource Timing reported 26 GLB requests and 143.93 MiB encoded bodies. This covers all GLBs requested by that session, including NPCs and landmarks; it is not the initial-page vehicle payload, and browser transfer/cache behavior can differ in deployment.

## Landmark visual comparison

Sé at the same locked camera, desktop day and night: [day](../evidence/2026-11-01-landmark-audit/se-lod-day.jpg), [night](../evidence/2026-11-01-landmark-audit/se-lod-night.jpg). Columns: original LOD0, original LOD1, current LOD0, current view when the old LOD1 would have been selected. The original LOD1 visibly changes the dome and facade; the current runtime only loads LOD0. Forced selection was used for diagnosis; route-motion and performance checks remain pending.

MASP in the same locked desktop camera: [day](../evidence/2026-11-01-landmark-audit/masp-lod-day.jpg), [night](../evidence/2026-11-01-landmark-audit/masp-lod-night.jpg). Columns: original LOD0, original LOD1, current LOD0, current view when the former distant LOD would have been selected. The original distant mesh removes the benches and changes the facade. Both landmarks now load only their authored LOD0; no GLB files were modified. Extra unique triangles when distant: 3,253 for Sé (4,544 vs 1,291) and 1,326 for MASP (1,568 vs 242); both continue with one visible mesh.

Startup validation: `tests/landmark-startup.browser.py` passed successful loads, failed loads, requests that never resolve, late responses, one landmark ready while the other waits, and the corresponding mixed late-response case. The first scene frame waits for the two attempts. On failure or a five-second timeout, procedural geometry is retained for that visit; a late result does not replace it. An unresolved underlying request can remain pending until page unload. The individual Sé and MASP browser tests passed; the full Node suite passed with zero failures after these changes.

Hardware comparison on the same Apple M3 Max / Chrome desktop viewport: two short runs per state gave medians of 8.3–8.4 ms at stops 5, 11 and 13. Baseline p95 ranged from 8.4 to 16.7 ms; current p95 was 16.7–17.2 ms. These are refresh-paced `requestAnimationFrame` intervals over 120 samples, not GPU execution times; the variability and differing scene work prevent a reliable attribution or a claim of no regression. Further controlled profiling is open. The baseline was served from detached worktree `f125de9` on port 8001; the current worktree was served on port 8000.
