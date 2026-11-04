# Pedestrians always present (sprite crowd)

Owner report: when the camera arrives at MASP (and other stops), the sprite pedestrians are created little by little. Cause: `js/world/people.js` drew a walker only within 140 m of the camera (`NEAR`), so the crowd filled in as the camera approached.

## What changed (`js/world/people.js`)

- A walker is drawn when it is within `VIEW_FAR = 900 m` of the camera. 900 m is the scene fog end (`scene.js` fog 240-900 m), so the far edge is fully fog-coloured and the boundary does not show.
- Optional third argument `update(dt, cam, frustum)`: a THREE.Frustum-shaped object also culls walkers outside the view, with a 3 m sprite margin. `scene.js` does not pass it yet (see open items).
- Every drawn walker keeps its walk cycle. Before, only walkers within 140 m animated.
- Separation between walkers runs within 150 m and eases out with a smoothstep from 140 m to 150 m. Before, it switched off at a hard edge (a 0.41 m push jump in one frame).
- Unchanged: positions and routes, kiosk avoidance, `crowd.userData.route`, `walkPace`, instance buffer sizes, reduced-motion freezing, shadow mesh.

## Numbers

Crowd: N = 1000 walkers. Two instanced draws (crowd + shadow), 18,000 triangles submitted per frame (2 x 1000 + 16 x 1000). Unchanged by this change.

Walkers drawn at each stop (same page, same run, interleaved):

| stop | distance to MASP | before (140 m gate) | after (900 m) | after + frustum (not wired) |
|---|---|---|---|---|
| 0 | 60 m | 196 | 883 | 792 |
| 1 | 44.5 m | 226 | 884 | 789 |
| 2 | 29.5 m | 245 | 890 | 780 |
| 3 | 14.8 m | 252 | 897 | 775 |
| 4 (MASP) | 0 m | 262 | 902 | 778 |
| 5 | 43 m | 296 | 919 | 740 |

Arrival:
- Jump to MASP, drawn at 0.1 s / 3 s: before 267 / 268 (0.4 %), after 906 / 904 (0.2 %). The literal 0.1 s vs 3 s check already passed before the change, so it did not catch the pop.
- Crowd at the route start (60 m before MASP) vs at MASP after the jump: before 196 vs 262 (34 % more on arrival), after 881 vs 906 (2.8 %). This is the check that failed before.

CPU per `update()`, median of 150 batches x 10 calls, base and new interleaved in one page, two repeats:

| stop | base ms | new ms | delta ms |
|---|---|---|---|
| 0 | 1.62 / 1.90 | 1.90 / 2.19 | +0.28 / +0.29 |
| 2 | 2.12 / 2.16 | 2.20 / 2.34 | +0.08 / +0.18 |
| 4 | 2.71 / 2.70 | 2.02 / 2.18 | -0.69 / -0.52 |

An earlier four-variant run (60 batches, six stops, extra variants alive in the same page) gave deltas from +0.06 to +1.18 ms. The two runs disagree, so the desktop cost is not settled: the cleaner run is inside the 0.5 ms budget, the earlier run is not. For reference, simply raising the old gate to 900 m (no other change) costs 8-9 ms per update, which is why separation stays within 150 m. Mobile was not measured.

## Tests

- `node --test tests/`: 149 of 149 pass.
- `tests/people-spatial.test.mjs`: six new tests. On the old code, five fail (a walker 250 m ahead inside the view not drawn; no frustum case; a group 250-265 m out not drawn; walk cycle stops beyond 140 m; separation jump 0.41 m per 5 cm). The guard "crowd does not grow over 3 s after a jump" passes on both.
- `tests/people-arrival.browser.py`: passes on the new code (route start 881, MASP 906 at 0.1 s, 904 at 3 s). On the old code its route-start check fails (196 vs 262, 34 %).

## Captures

`before/` (old code, default weather roll, clear) and `after/` (new code, `weather=clear` pinned). Scroll stops 0, 2 and 4, day theme, 1x sprite atlas. Stop 4 is MASP (`taqtile`). The route starts 60 m before MASP, so the approach sequence is these three frames. Screenshots were taken before the 0.1 s / 3 s and route-start checks ran; the numbers above come from the instrumented runs, not from the screenshots.

## Existing browser suite (`tests/people.browser.py`)

Run on the committed code. The suite stops at its first failing check, so the checks below were run separately (the failing ones removed from a copy):

- "feet must follow paving height": fails before this change too. The check expects 0.02 m for every walker, but 420 lane walkers take `PAVE_TOP` (0.1 m). Not changed.
- "reduced motion must not move anyone": fails before this change too. The first update settles 64 overlapping walkers by up to 0.29 m; the old code does the same (64, 0.287 m). Not changed.
- "a visible person is within 5.45 of the road centre": fails after this change at 4.56 m. The walker is a lane walker passing under an underpass, at its designed clear-arch offset (`ARCH_HALF_WIDTH` 5.5 m minus the walker's half-width and margins), 443 m from the camera. The old 140 m gate hid it. The check does not model underpass passages. Not changed; needs a decision (exclude passages, or check against the arch clearance).
- Count (1000), instanced mesh count (at most 3) and the changed-after-update check pass.

## Open items

1. `scene.js` line 288 calls `people.update(dt, camera.position)` and does not pass the frustum. Optional one-line change to pass `frustum` (already computed there in the render loop): fewer drawn instances (about 12-19 %), no visible change, since off-screen sprites are clipped by the GPU. Not edited, per the rule for scene.js.
2. `js/world/npc3d.js` (3D walkers, desktop default) takes candidates from sprite visibility (`A[a] === 0`) with its own 160 m cap. Sprites are now visible out to 900 m, so 3D walkers can be assigned at 140-160 m. Not tested; NPC3D files untouched.
3. Mobile (max-width 767 px) not measured; same code path, CPU cost on phones unknown.
4. CPU delta is not settled (see table). If a repeat on the target machine shows more than 0.5 ms, the levers are a lower `VIEW_FAR` (600 m) or static far frames. Not applied: the clean run is inside budget and both levers reduce visible coverage.
5. Test camera positions are approximated from the stop's route point (plus offset), not from scene.js `shotFor()`.

## Files

- `js/world/people.js`
- `tests/people-spatial.test.mjs`
- `tests/people-arrival.browser.py`
- `before/0-day.jpg`, `before/2-day.jpg`, `before/4-day.jpg`
- `after/0-day.jpg`, `after/2-day.jpg`, `after/4-day.jpg`
- `measure-before.json` (old code, drawn counts per stop, arrival, approach sweep)
- `measure-ab.json` (four-variant run, counts and CPU)
- `measure-cpu.json` (two-repeat base vs new CPU run)
