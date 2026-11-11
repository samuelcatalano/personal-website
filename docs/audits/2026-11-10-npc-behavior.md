# NPC behavior and foot contact

Owner authorization on 2026-11-10: implement all seven proposed NPC refinements. This extends the earlier [motion checkpoint](2026-11-10-npc-motion.md); it preserves that working-tree implementation and adds no models, textures, dependencies or render passes. Map, path footprints, population and pool sizes are unchanged.

## Implemented behavior

| Requested refinement | Runtime behavior |
|---|---|
| Independent gaze | Neck and head share a damped yaw, limited to 0.55 rad combined. Identity-specific 2.5-second attention windows select the bus, a nearby person or an existing landmark, then return forward. |
| Natural standing | Occasional five-second weight transfers, with 9–13 seconds of quiet between them. Pelvis, chest, wrists and fingers move subtly; the original breathing remains. |
| Supporting steps during turns | At low travel speed, alternating feet lift and reposition during a body turn. Each step lasts 0.38 seconds and lifts about 4.5 cm at unit scale. |
| Walking personalities | Stable relaxed, purposeful and compact profiles adjust arm swing and chest lean. Leg clips, measured stride and physical route speed remain authoritative. |
| Distant cadence | A staggered time deadline targets 20 skeletal poses/second independently of display FPS. All accumulated mixer delta is retained. Near characters still animate each frame. |
| Anticipated encounters | A 2.5 m spatial grid predicts encounters up to two seconds ahead. Stable priority and eased pace reduction avoid mutual deadlock; nearby parallel companions match pace. Existing bounded separation remains the safety net. |
| Foot support and IK | An analytic two-bone solve preserves knee bend plane and segment lengths. Contact anchors constrain stance feet; animated shoe orientation retains heel/toe roll. Anchors release on swing, excessive correction or pool reassignment. |

## Boundaries and integration

- `npc-motion-state.js` owns pure profiles and the distant sampling deadline.
- `npc-pose.js` owns upper-body expression and restores the mixer pose before applying the next overlay, preventing accumulated rotations.
- `npc-foot-contact.js` owns stance anchors, supporting steps and leg IK.
- `npc3d.js` retains loading, identity assignment, skeleton ownership, normal walking and existing greetings. Scene landmark bounds provide gaze targets.
- Detailed posing is camera-local: at most 24 eligible bodies on desktop or 12 at narrow-viewport startup, within 100 m horizontally. Foot contact/support steps are a subset, bounded to eight desktop or four narrow-viewport bodies within 90 m. These ranges include the normal elevated camera, whose nearest pedestrians are around 60 m away. Tiny/distant bodies retain the original clips. This bound is part of the implementation, not a citywide full-body IK rollout.
- Ground height comes from the existing path/pavement level. This is not a terrain raycaster or an arbitrary-stair locomotion system. No new footstep sounds or UI controls are introduced.
- Reduced motion skips the new procedural pose, gaze, stepping and IK updates. Pool reuse restores the base skeleton and clears old foot anchors and attention.

## Verification

Behavioral checks cover fixed 30/60/120 Hz time steps for distant cadence, recovery after prolonged slow frames without replaying old poses, anticipated passing and recovery, companion pacing, adult/child rigs, gaze target categories and return, profile differences without frozen arm swing, occasional body/finger motion, normalized joint rotations, foot support under body displacement, lifted turning steps and anchor reset. Existing walk/idle/greeting and pool-reassignment checks remain applicable.

Final Node regression: **222 passed**. The greeting test identifies the four permanent standing people by their path data, because yielding walkers can now legitimately run a weighted standing action too. All procedural offsets are restored before action transitions or greeting generation, and distance deactivation clears gaze/anchors before reentry.

Commands: `node --test tests/`; `browser-harness < tests/npc-behavior.browser.py`; `browser-harness < tests/npc-behavior-budget.browser.py` and `MOBILE=1` variant; `browser-harness < tests/npc-motion.browser.py` and its `RIG=child` / `FPS=30` variants; `browser-harness < tests/npc-idle.browser.py` and its `REDUCED=1` variant. The orbit-camera fixture activated exactly 24 expressive / 8 contact bodies at desktop width and 12 / 4 at 375 px.

Integrated desktop/day, desktop/night and 375×812 mobile-emulation captures used the normal route camera with JavaScript errors, unhandled rejections and console errors monitored. Final desktop/night and mobile/day captures both reported zero errors, with eight and four contact-enabled bodies respectively. Local scene captures are under `/tmp/npc-round2-review/city-final/`. Physical phones and Lighthouse were not tested.

The isolated adult/child fixture observed approximately 1.4 cm of standing weight transfer and 4.3 cm of turning-foot lift. Its short supported-foot displacement test stayed below 1 mm of drift; this is not a claim about every footfall in the city. Front/side walking, stopping and restarting sequences use the actual runtime pool and original GLB.

## Cost and evidence

The baseline is the local motion-refinement state immediately before this request, including its uncommitted fixes. It is not bare commit `85eb008`. Baseline file hashes and raw measurements are preserved with the evidence.

An initial sequential A/B became unstable: baseline medians varied from 4.0 to 22.6 ms, and updated medians from 4.6 to 25.2 ms. These measurements are retained, not used as a stable performance verdict. The follow-up interleaves both simulations in alternating order every fixed step, keeping external timing conditions closer.

Local Chrome on Apple M3 Max / ANGLE Metal, 200-body pool, same route/camera, no stopped hero, 300 fixed updates at 1/60 s; first 60 excluded. CPU time measures simulation plus NPC update, excluding renderer/GPU time. Renderer counts come from one 640×400 draw after each sequence. This is a scoped CPU/resource comparison, not a whole-city frame-rate or physical-phone benchmark.

| Final interleaved sample | Median CPU update | p95 CPU update | Calls | Submitted triangles |
|---|---:|---:|---:|---:|
| Before this request | 4.3 ms | 7.0 ms | 817 | 1,689,245 |
| All seven refinements | 5.9 ms | 8.4 ms | 817 | 1,689,245 |

The final bounded implementation adds approximately 1.6 ms median / 1.4 ms p95 CPU update in this sample. An earlier interleaved sample, before the normal-camera range correction and finger relaxation, measured 4.1 → 5.1 ms median and is retained separately. No whole-city FPS or physical-mobile performance improvement is claimed.

Evidence: [side motion](../evidence/npc-behavior/motion-side.mp4), [side poses](../evidence/npc-behavior/side-comparison.jpg), [front poses](../evidence/npc-behavior/front-comparison.jpg), [initial measurements](../evidence/npc-behavior/perf-first-attempt.json), [interleaved measurements](../evidence/npc-behavior/perf-interleaved.json), [baseline hashes](../evidence/npc-behavior/baseline-files.sha256).
