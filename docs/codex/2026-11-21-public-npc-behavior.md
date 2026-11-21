# Public NPC behavior — six improvements

Implemented locally on `feat/site-gamefication`, following the installed `game-ai` skill. Extends the existing route simulation; no new runtime dependency or asset. Preserves the 1,000-person population and the earlier uncommitted crowd-avoidance fix. No commit or push.

## Result

1. **Blocked recovery:** measure net progress over time so oscillation does not count as walking. Distinguish a legitimate queue or bus-watching pause from a blockage. Try passing, wait and reverse where necessary. Persistent corner blockages request bounded local A* and rejoin the authored route by walking through waypoints.
2. **Stable passing:** remember the encounter partner and passing side until the encounter clears. Match a leader's speed/headway and yield rather than repeatedly swapping sides. Conservative contact rollback prevents body swaps and sudden contact jumps.
3. **Walkable space:** index existing paving, lawns, obstacles, trees, furniture and kiosk footprints. Check the entire body footprint, including the union of rotated paving slabs, before steering or contact movement. Author-defined corridors cover landmark paving absent from the box list but cannot override lawns or solids. Six MASP crowd cells that occupied low lawn boxes now use existing paved strips in the same region.
4. **Individual bus attention:** deterministic stop, slow, glance and ignore profiles, with reaction delay, finite attention and cooldown. Propagate attention to adult and child head tracking. Moving bodies still face their actual direction of travel. Preserve stationary NPC behavior and reduced motion.
5. **Companions:** stable pairs/trios among compatible nearby walkers on the same route. Match pace, wait for companions and form single file around external encounters or obstacles; safety takes precedence over cohesion.
6. **Route continuity:** remove wraparound across the ends of the open world route. Keep bridge-side lanes in their connected component at the Estaiada ramp mouth. Ease endpoint turns onto the opposite walking track, including lateral speed in the pace calculation; normalize wide plaza curves to avoid speeding up.

Local A* uses a 0.4 m grid within 7.2 m per axis, at most 900 expanded nodes, one search per simulation update near the camera, and per-agent retry delays. A persistent request queue prevents low IDs from starving later walkers. It queries the same body clearance as steering, rejects diagonal corner cuts, smooths clear segments and retains the original route/phase at reentry. This is a local escape route, not a globally optimal navigation service.

## Validation

- `node --test tests/`: **348 passed, zero failed**, final run after the implementation changes. Regressions cover recovery versus legitimate waiting, passing memory, groups, bus timers, zero-time/reduced-motion behavior, obstacle detours, terrain coverage, speed and route endpoints.
- `browser-harness < tests/npc-behavior.browser.py`: adult and child rigs passed, including explicit bus attention/ignore behavior.
- `browser-harness < tests/npc-motion.browser.py`: adult rig at 60 Hz passed: cadence, ground contact, standing/walking transitions, heading, pool reassignment and distant animation timing.
- `tests/hero-garden.browser.py` through browser-harness with service-worker bypass: **36 walkers, 13 trees, 120 simulated seconds**, reduced motion checked; minimum center separation **0.62139 m**.
- `browser-harness < tests/underpass.browser.py`: **two underpasses, four sidewalk directions, eight crossing samples** passed, including portal transitions.
- `OUT=docs/evidence/npc-behavior-six browser-harness < tests/crowd-avoidance.browser.py`: real production navigation geometry and the deterministic **1,000-person** plan, **90 simulated seconds per region**, 0.1 s steps. Checks visible NPCs within 100 m after a two-second settling period. All four regions passed:

| Region | Minimum center separation | Largest step per 0.1 s | Unsafe terrain samples | Prolonged stationary walkers |
| --- | ---: | ---: | ---: | ---: |
| Glasgow | 0.62016 m | 0.23979 m | 0 | 0 |
| MASP / Paulista | 0.62012 m | 0.22639 m | 0 | 0 |
| London / Thames | 0.62001 m | 0.23350 m | 0 | 0 |
| Hero garden area | 0.62096 m | 0.20594 m | 0 | 0 |

The prolonged-stationary check excludes authored idle people and fails a walker visible for more than 60 seconds if its total bounding-range displacement stays below 0.5 m. The simulation also has focused shorter recovery regressions. This finite soak does not establish that every possible crowd configuration is deadlock-free.

Desktop day/night captures at **1728 × 907**, DPR 2, completed with no captured `error`/`unhandledrejection` events; the live Glasgow scene was inspected visually. Captures show scene appearance; the instrumented soak establishes the numerical movement results. No general FPS claim is made.

Evidence: `docs/evidence/npc-behavior-six/{crowd-avoidance.json,verification.json,11-day.png,11-night.png}`. The plan and implementation rulings are in `docs/superpowers/plans/2026-11-21-public-npc-behavior.md`.

## Limits

Collision and support use conservative authored volumes/footprints, not exact mesh physics or a height-aware navmesh. Local navigation is deliberately bounded and can return no route. The soak covers four fixed camera regions and one deterministic population seed. Mobile, the full unrelated browser suite, and a cross-browser performance benchmark were not run. No runtime graphics-quality changes, commit or push.
