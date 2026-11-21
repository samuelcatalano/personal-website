# Public NPC crowd avoidance

## Cause and correction

The contact solver displaced rendered route positions, but the route parameter continued through neighbours. Each next frame rebuilt positions from those advancing route parameters and discarded contact displacement. This caused queues to interpenetrate and opposing walkers to exchange positions abruptly. The previous anticipation could slow a follower but had a 35% minimum pace and no passing sidestep.

`js/world/people.js` now feeds longitudinal contact correction back into route progress and retains the lateral offset. Anticipation matches a follower to available headway, allows a complete stop, and introduces a gradual passing sidestep for plaza counterflow. Sidesteps and contact corrections share the existing displacement envelope (0.20 m on sidewalk lanes, 0.55 m on other walking paths). The stationary NPCs participate as obstacles. No route footprints, population counts, render quality settings, assets or dependencies changed.

The public `createPeople` interface is unchanged. Its production caller is `scene.js`; `npc3d.js` consumes the same position, direction and pace arrays and already derives animated speed from actual displacement.

## Evidence

The new Node regressions reproduce a head-on positional jump of 0.8278 m/frame at 30 FPS, a follower crossing its leader, and an intersecting sidewalk queue against the original source. They pass after the correction. Head-on checks cover 30, 60 and 144 FPS, clearance, forward progress and bounded displacement. The queue and zero-time checks cover sustained following and paused encounters.

Matched desktop Chrome runs use the real route, seed 1017, all 1,000 NPCs and 90 simulated seconds at 0.1 s per step in each region. Measurements cover visible-route NPCs within 100 horizontal metres of the sampled camera, after two seconds of settling. Counts below are pair-samples with centre distance under 0.50 m, not distinct people or exact mesh intersections.

| Camera region | Before: minimum gap | After: minimum gap | Pair-samples under 0.50 m, before → after |
| --- | ---: | ---: | ---: |
| Glasgow | 0.385 m | 0.657 m | 304 → 0 |
| MASP / São Paulo | 0.405 m | 0.614 m | 304 → 0 |
| London approach | 0.407 m | 0.712 m | 299 → 0 |
| Start garden | 0.369 m | 0.626 m | 125 → 0 |

The first three regions' maximum displacement per 0.1 s fell from 1.15–1.17 m to 0.177–0.185 m. Longstanding discontinuities at the global sidewalk route seam occur in both original and corrected code; displacements over 2 m are excluded from the regression's contact-continuity measurement. They are not fixed or claimed as part of this collision correction.

Machine-readable results are in `docs/evidence/npc-crowd-avoidance/before-after.json` and `crowd-avoidance.json`. The repeatable browser regression is `tests/crowd-avoidance.browser.py`.

## Validation

- `node --test tests/`: 325 passed, zero failures.
- Desktop real-route crowd regression: passed in all four regions, 90 seconds per region; minimum permitted centre distance 0.60 m, contact displacement below 0.25 m per 0.1 s.
- `tests/hero-garden.browser.py`: passed for 36 walkers and 13 trees, 120 simulated seconds, paving/lawn/obstacle clearance and reduced motion. Minimum sampled pedestrian centre gap 0.541 m.
- `tests/underpass.browser.py`: passed for both tunnels and all four lane directions. The runner adjusted its relative module imports to root imports because it ran from the existing fixture tab.
- Live Glasgow scene: 48 rendered NPCs persisted across a two-second sample; 46 moved more than 2 cm. Desktop close-up captured in `docs/evidence/npc-crowd-avoidance/11-day.png` and visually inspected.
- `git diff --check`: passed.

Skills: globally installed `game-ai` at `~/.agents/skills/game-ai`, plus systematic debugging, TDD, Ponytail and verification. No mobile checks, commit or push.
