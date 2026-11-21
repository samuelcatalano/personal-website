# Public NPC behavior implementation plan

Goal: implement the six improvements explicitly requested after the crowd collision fix.
Architecture: extend the existing deterministic route simulation and reuse authored geometry. No new navigation engine, dependency, assets or render-quality controls. Preserve 1,000 people, reduced motion, existing uncommitted work and the scene's HTML fallback. Desktop only; no commit or push.

Scope and implementation choices:
1. Detect lack of intended progress over two seconds; distinguish bus attention and legitimate queues. Try a free passing side, wait, then reverse along the same safe route when necessary. Expose state through simulation diagnostics for repeatable checks.
2. Keep encounter partner, passing side and yielding priority until partners have passed or separated. Do not change decisions every frame.
3. Build a spatial query from existing low obstacles, trunks, furniture and lawns. Check candidate steering against walkable bounds and obstacle footprints; reject unsafe movement. Reuse the same data in desktop tests.
4. Give identities deterministic bus-interest, reaction delay, attention duration and cooldown. Keep moving/glancing, slowing and stopping profiles. Preserve reduced motion and resume after departure.
5. Assign stable, small companion groups to compatible nearby walkers without changing their authored routes or allocation. Regroup by matching progress; yield in single file during encounters; prioritize obstacle and body safety over cohesion.
6. Remove modulo wrap across the ends of the open world route. Split bridge-side sidewalks at the ramp mouth and reflect smoothly at the actual endpoints of each connected run.

Execution (inline, no delegated work):
- [x] Route continuity: reproduce positive and negative sidewalk seam jumps, implement connected runs and endpoint easing; run spatial regressions.
- [x] Passing memory and recovery: failing sustained/crossing/blocked encounters, implement stable state and recovery; verify no starvation or false stuck reports while waiting.
- [x] Walkable-space integration: tests for obstacles, corners and blocked sides; spatially index scene geometry, constrain steering and contact; desktop garden/tunnel checks.
- [x] Bus attention: deterministic delay, heterogeneous profiles, finite attention and cooldown tests; implement and validate resume/reduced motion.
- [x] Companion groups: stable assignment, temporary single-file yielding and regrouping tests; implement using existing path ownership.
- [x] Integration: full Node suite, desktop real population/geometry/long encounters, live visual captures, final diff review and handoff report.

Review focus: initial overlaps; variable dt; queue versus deadlock; narrow paths with no passing space; obstacle corners; stationary people; bus departure/re-entry; group separation; open-route endpoints and Estaiada gap; zero-time and reduced-motion updates.

Ruling: the six MASP subcells were inside the rendered central lawn; the old geometry test discarded all boxes below 0.25 m. Move only those subcells into the existing paved front/west corridors and test low lawns as obstacles. This corrects route data without changing city geometry or regional counts.
Ruling: landmark-mesh paving is absent from the low-box index. Existing authored corridors provide fallback support only where neither a lawn nor a solid blocks the body; they do not override obstacles.

Validation ledger: spatial/behavior regressions pass for open endpoints, bridge mouth, locked passing side, constrained-sidewalk recovery, legitimate queues, obstacle detours, blocked corridors, individual attention timers, stationary time, companion regrouping and group dead ends. Adult/child rig browser tests observed the ignored-bus regression fail before integrating simulation attention into head tracking, then pass afterwards.

Ruling: progress recovery measures net displacement over time, not instantaneous speed; a real-route test caught a follower oscillating within 4.4 cm that otherwise looked active. Legitimate queues behind an advancing or bus-watching leader remain exempt.
Ruling: a Thames child track needs more than the original 0.55 m offset at a lawn corner. Allow a terrain-verified plaza offset up to 0.75 m, retaining the 0.20 m sidewalk limit; never expand into an unsafe surface. A focused obstacle-detour regression failed before this change and passed afterwards.

Ruling: the real-route soak exposed constrained corners that sidestepping and reversing cannot escape. Add dependency-free local A* only after blocked recovery, bounded to 900 expanded nodes and one search per simulation update near the active camera. It uses the exact same body/terrain query, avoids nearby people, follows waypoints at walking speed, and rejoins the original route without teleporting. Initial placement also rejects isolated free pockets with no walkable exit.
Ruling: plaza terrain offsets may reach 1.25 m only when verified free; outward corner travel is normalized so a wider arc does not accelerate the walk. Ordinary crowd sidesteps remain 0.55 m and sidewalk separation remains 0.20 m.

Final validation: all 348 Node tests passed. Desktop behavior (adult/child), adult motion at 60 Hz, garden (120 seconds plus reduced motion), both underpasses/four lane directions, and real-space crowd soak (1,000 NPCs, four regions, 90 seconds each) passed. Day/night desktop captures completed with no captured runtime errors. See `docs/codex/2026-11-21-public-npc-behavior.md`. No mobile, commit or push.
