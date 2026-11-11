# NPC movement and material refinement — 2026-11-10

Owner scope: improve existing crowd graphics, primarily realistic and smooth motion. Existing crowd identities, routes, lot/map data, population/pool sizes, GLB, meshes, textures, licences and global lighting remain intact.

## How the crowd works

- `crowd.js` provides deterministic identities and paths for 1,000 simulated people.
- `people.js` owns path positions, headings, eased turn pace, separation and reactions to the hero vehicle. It runs before the visual units.
- `npc3d.js` loads the licensed MakeHuman/Quaternius pack, clones independent skeletons and maintains a camera-local pool (200 desktop / 48 narrow viewport by default). It assigns adult/child bodies, plays measured in-place walks, hides tiny eye/brow details at distance and throttles distant skeletal updates.
- `npc-idle.js` derives standing/greeting clips from the existing skeleton. It restores the pool body after generating a clip.

## Reproduced defects and changes

1. A fully reacting person retained 5% translation while animation pace approached zero. The focused simulation reproduction measured **0.05 m/s** with frozen gait. Translation now uses the same reaction factor as animation pace; the regression requires less than 0.001 m/s after settling.
2. The visual body followed the simulation's vehicle-facing heading even while travelling in another direction. The isolated fixture reproduced **90° sideways travel**. Moving bodies now follow measured displacement, with damped turning capped at 3 rad/s. The same fixture settles at 0° disagreement.
3. Near-zero playback froze a full walking pose. Cadence now follows smoothed measured speed. Below 0.8× clip cadence, the stride blends toward a proper standing pose instead of slowing the whole gait indefinitely. Walking fully resumes without resetting its phase; the zero-weight standing action stops evaluating. Pool assignment immediately installs the new owner's pose.
4. Standing feet were aimed horizontally and could inherit animated toe roll. The generator now reads ankle/toe directions and neutral toe rotation from inverse bind matrices. Adult/child fixtures check that toe joints remain below ankles, soles stay grounded, and heel/toe sole heights differ by less than 25 mm in character-local units. Observed settled differences: approximately **3 mm adult / 6 mm child**; these are fixture measurements, not a certification of every shoe variant.
5. Existing materials now distinguish skin, eyes, cloth and shoes by roughness; existing maps use anisotropic filtering. Contact-shadow size follows person height. No new textures, models, materials per person, geometry or render passes are added by these changes.

## Verification

- `node --test tests/`: **216 passed**. Focused stop regression was observed failing before the fix. An in-memory sign mutation in the reaction factor also fails that regression, without editing runtime files.
- `browser-harness < tests/npc-motion.browser.py`: adult real-loader fixture validates measured cadence, travel heading, turn limit, stopping, flat standing feet, smooth restart, idle-action retirement, camera-jump pool reassignment and accumulated time through distant animation throttling. Passed with `FPS=60` and `FPS=30` fixed simulation steps; these are test inputs, not measured display FPS.
- `RIG=child browser-harness < tests/npc-motion.browser.py`: same checks with the actual child skeleton, at both fixed time steps.
- `browser-harness < tests/npc-idle.browser.py` and `REDUCED=1 browser-harness < tests/npc-idle.browser.py`: adult/child standing/greeting, grounded shoes, rig restoration, cooldown and pool reuse; reduced motion remains static.
- Before/after front and side sequences cover walking, stopping and restarting with the real runtime pool, including more than two continuous walking cycles per view. [Side comparison](../evidence/npc-motion/side-comparison.jpg), [front comparison](../evidence/npc-motion/front-comparison.jpg), [motion video](../evidence/npc-motion/motion-side.mp4). Remaining local captures: `/tmp/npc-refinement/`. The original cycles and their limitations remain; there is no runtime foot IK.
- Integrated captures reviewed: São Paulo desktop/day, London desktop/night and São Paulo at 375×812 emulation. This is a scoped visual check, not the full language/accessibility matrix or a physical-phone test.

## Focused cost comparison

Local Chrome, Apple M3 Max, ANGLE Metal. Baseline runtime: commit `85eb008`. Same route/camera, 200-body pool, simulation without a hero stop, 240 fixed 1/60 s updates per run; first 60 excluded. Alternating before/after/after/before order. Timing is **simulation + NPC update CPU only**, excluding renderer/GPU time. A single 640×400 render per run supplies counts. [Raw measurements](../evidence/npc-motion/perf.json).

| Run | Median CPU update | p95 CPU update | Calls | Submitted triangles | Active pool bodies |
|---|---:|---:|---:|---:|---:|
| Before 1 | 3.5 ms | 5.9 ms | 819 | 1,689,609 | 200 |
| After 1 | 3.6 ms | 6.2 ms | 819 | 1,689,609 | 200 |
| After 2 | 4.4 ms | 6.9 ms | 819 | 1,689,609 | 200 |
| Before 2 | 3.5 ms | 5.6 ms | 819 | 1,689,609 | 200 |

The quality changes add 0.1–0.9 ms median CPU in these samples, with variation between runs. This is not an FPS improvement, whole-city benchmark, mobile result or GPU-memory measurement. Additional blending has a real CPU cost during transitions.

Physical mobile, full product matrix and Lighthouse are not established by this audit. No deployment is part of this task.
