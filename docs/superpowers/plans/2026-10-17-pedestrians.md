# Pedestrians Implementation Plan

> **For agentic workers:** superpowers:subagent-driven-development. The steps are deliberately lean: they give the interfaces and acceptance checks, and implementers read the code they touch.

**Goal:** add about 160 walking people (men, women and children, with varied skin, hair and clothes) on the sidewalks and paved plazas.
**Spec:** `docs/superpowers/specs/2026-10-17-pedestrians-design.md`
**Architecture:**
- A pure data module, `js/world/crowd.js`, has no three.js dependency so it is Node-testable. It holds the looks and the paths.
- The render module, `js/world/people.js`, uses one InstancedMesh per body part with per-instance colour and a CPU walk cycle.

## Global constraints

- Read `CLAUDE.md`. No build, no npm, three@0.169.0 via the importmap. There is no JS byte limit, but code stays compact.
- Implementers never start servers, never use port 8000 and never run browser-harness. The controller runs the browser checks.
- Never touch `docs/codex/2026-10-16-claude-handoff.md`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `node --test tests/` passes after each task.
- No z-fighting. The people's boxes are animated, so they are not in `tests/zfight.browser.py`, but do not place them coplanar with the ground: feet start at y = paving top + 0.01.
- The route geometry already in the code:
  - The road centre line is `routeCurve(THREE, pts)` in `layout.js`.
  - The road band is |offset| < 5.45.
  - The sidewalk is 5.45–8.75 on each side.
  - Sign and plaque posts sit at an offset of about 7.1 (`furnitureSpots`), and so do kiosks and some trees.
  - Use walking lanes at offsets ±5.95 and ±8.25 so people pass between the kerb and the posts and behind them.

## Task 1: pure crowd data (Sonnet)

**Files:** create `js/world/crowd.js` and `tests/crowd.test.mjs`.
**Produces:**
- `makeLook(r) → { kind: 'man'|'woman'|'boy'|'girl', height, skin, hair, hairStyle: 'short'|'bald'|'long'|'bun'|'ponytail', top, bottom, shoes, shoulder, speed }`.
  - `r` is a seeded `rng` from `layout.js`.
  - Proportions:
    - adults 1.6–1.9 m, children 1.1–1.35 m;
    - head about 0.13 of height, legs about 0.47.
  - **Skin:** `SKIN` has 7 tones from very light to very dark, including at least 2 dark brown tones.
  - **Hair colours:** black, dark brown, brown, blonde and grey. Grey is adults only.
  - **Hair style:**
    - men: mostly short, some bald;
    - women: mostly long, some bun or ponytail;
    - boys: short;
    - girls: long or ponytail.
  - **Clothes:** varied colours, lowercase hex.
  - **Mix:** about 70% adults; about 50/50 men and women.
- `walkPaths(stops, pts)` returns paths as polylines in route space, `{ type: 'lane', offset, dir }`, plus plaza loops `{ type: 'loop', rect: {x0, x1, z0, z1} }`.
  - **Lanes:** 4 per route (±5.95, ±8.25). On each side the inner and outer lanes walk in opposite directions.
  - **Plaza loops:** rectangles for the paved areas below. Read `blocks.js` (the cut and hard rectangles, the MASP corridor, the Copan), `saopaulo.js`, `landmarks.js` (Wembley) and `layout.js` (`GAP`, `RIVER_Z`, `riverStart`/`riverEnd`). The rectangles must not overlap buildings, landmarks, water or the road.
    1. MASP plaza: the open area in front of MASP.
    2. Paulista gap: the free paving in the `GAP` stretch, in front of the Copan.
    3. Thames riverside: between the river bank path and the far sidewalk, from `move` to `riverEnd`.
    4. Wembley plaza: in front of the stadium, beside the figure and the NOW sign, but not on the figure.
- `crowdPlan(stops, pts, seed)` returns about 160 `{ look, path, s0 }`.
  - Roughly 70% go on lanes and 30% on the loops.
  - `s0` is the start phase, between 0 and 1.
  - The same seed always gives the same plan.

**Tests (Node):**
- Generation is deterministic.
- Heights fall in their ranges, and every child is shorter than every adult.
- Hair rules hold: no grey on children, and girls never bald.
- At least 6 distinct skin tones appear in the plan.
- Both lane directions appear on each side.
- Every lane |offset| is between 5.45 and 8.75.
- Loop rectangles do not intersect the road band. Sample the route polyline from `routePoints` with `GAP` and check that the distance from the polyline to each rectangle is at least 5.6.

Commit `feat: crowd looks and walking paths`.

## Task 2: animated people (Sonnet)

**Files:** create `js/world/people.js`, modify `js/world/scene.js`, create `tests/people.browser.py`.
**Consumes:** `crowdPlan` and `routeCurve` from `layout.js`, `blockMaterial` from `textures.js` (the triplanar noise is fine; use the per-instance colour with a white base colour), and `furnitureSpots` if needed.
**Produces:** `createPeople(scene, { curve, pts, stops, reducedMotion }) → { update(dt, camPos), count }`.
- **Instanced parts**, one `InstancedMesh` each: head, hair, hairLong (the back of long hair, scaled to zero when unused), torso, armL, armR, legL, legR, shoes (2 per person). Each uses a unit box with its base at y = 0 or a pivot at the top for the limbs. Colours are set per instance with `setColorAt`.
- **Proportions:**
  - shoulder width about 0.24 × height;
  - torso about 0.3 × height;
  - head cube about 0.13 × height;
  - arm length about 0.36 × height;
  - leg length about 0.47 × height.
- **Walk cycle:** the legs and arms rotate about the hip and shoulder pivots, ±0.5 rad, with arms in opposite phase to legs. The body bobs by 0.03 × height. Steps per second scale with speed.
- **Movement:**
  - On a lane, the person advances along the curve (`getPointAt` / `getTangentAt`) by `speed / curveLength` per second. They are placed at the lane offset and face their walking direction, wrapping at the route ends.
  - On a loop, the person walks the rectangle's perimeter, inset by 0.6 m.
- **Performance:**
  - Update only the people within 140 m of the camera, and hide the rest by scaling them to zero once.
  - `frustumCulled = false` on the instanced meshes.
  - `castShadow = true`; `receiveShadow` is optional.
- **Reduced motion:** set the poses once (standing, no swing) and do not move anyone.
- **Night:** nothing special.
- **Wiring:** scene.js creates the crowd after the city and calls `update(dt, camera.position)` in the frame loop.

**Browser test** (`tests/people.browser.py`, in the style of `tests/vehicles.browser.py`, asserting the page is localhost):
- `createPeople` on a test scene returns a count of at least 150.
- After `update(0.5, ...)`, some instance matrices have changed.
- With `reducedMotion`, they have not changed.
- No visible person sits within 5.45 of the road centre. Check the head instance positions against the curve samples.
- The number of instanced meshes is 12 or fewer.

Commit `feat: walking pedestrians`.

## Task 3: verification (controller)

- Run the browser suites, including `people` and `zfight`.
- Capture a São Paulo stop, the MASP plaza, a London stop, the Thames riverside and Wembley, at day and night.
- Sample FPS and draw calls.
- Send the captures to the user.
