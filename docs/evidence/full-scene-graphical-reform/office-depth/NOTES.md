# Stop-5 office tower depth (block--183--37)

Verdict: geometry depth is in and measured, but the visual acceptance (depth clearly visible at normal stop-5 distance, day) is NOT met. Night reads slightly more layered. Iteration budget (4) is used up.

## Scope

- `js/world/office-slice.js`: `officeDepthRecipe(plot)` (recipe `depth: true`, `reveal: .6`) and a `depthFacade()` branch. The plain recipe (every other office lot: city rollout, facade kit, hero integration, hero background) keeps the HEAD geometry byte-for-byte (FNV hashes in `tests/office-depth.browser.py`).
- `js/world/building-kit.js`: only the `OFFICE_LOT_ID` branch passes `officeDepthRecipe(plot)`. `rollout:false` uses the same branch, as before.
- `js/world/building-slice-materials.js`: unchanged (`applyOfficeFacade` and the pane shader from f87b6c0 still apply).
- Lot ID, descriptor (11 x 11 x 31.5 m), envelope (|x|,|z| <= 5.5 m, y <= 31.5 m) and the three buckets (mass / trim / glass) with shared architecture and glass materials are unchanged.

## Baseline (HEAD 8c27136), measured

- Triangles 1684 (mass 1160, trim 308, glass 216). Coplanar same-direction overlapping pairs: 391.
- The glass was already 0.32 m behind the wall plane. The spec's 6-10 cm recess would reduce the existing depth, so it was not used.
- `tests/office-depth.browser.py` on HEAD: 7 of 8 depth checks fail (no fins proud of the spandrel plane, no slab overhang, no dark soffit band, no podium tone, no per-floor tone variation, no parapet cap, no depth recipe). The glass-recess check passes at 0.32 m (threshold 0.30 m); the new 0.45 m threshold fails.

## Final geometry (depth variant)

| Element | Spec | Built | Why |
|---|---|---|---|
| Core wall plane | unchanged 5.3 m | 5.0 m (inset 0.3 m per side) | Keeps fins and slab edges inside the 5.5 m lot edge |
| Fins on each bay line | 6-8 cm proud | 0.40 m proud (full height) | 8 cm and 14 cm tried; not readable at this distance |
| Slab edges (sills) | 10-15 cm overhang | 0.45 m proud, soffit faces dark | Same |
| Panes and spandrels | glass 6-10 cm behind slab edges | panes and spandrels 0.6 m behind the core plane (1.05 m behind slab edges) | Deep-set; spandrel is a dark band under each slab |
| Ground floor | darker, taller, canopy | 0.8 m recess, darker glass (x0.6), taller lobby, existing canopy and cornice | As spec |
| Roof and parapet | parapet/crown detail | roof overhang 0.2 m per side, parapet cap overhang | Stays inside 5.5 m |
| Glass variation | sky reflection, per-floor value | per-floor tone +-4% (vertex colour); existing sky reflection shader unchanged | Reflection was already active on office glass |

## Triangles and coplanar overlaps

- Triangles: 1684 -> 1000 (-40.6%, budget +40%). Mass 536, trim 248, glass 216. The full-width sill and spandrel faces replace the per-bay reveals.
- Coplanar overlaps: 391 -> 92. Strict regression check passes (no increase).

## Iterations (captures in `iterations/`, day, stop 5, clear)

1. Spec numbers (fins 0.08, slab 0.14, recess 0.32): visually the same as HEAD.
2. Fins 0.14, slab 0.18, recess 0.55: still subtle.
3. Core inset 0.3, fins 0.40, slab 0.45, recess 0.6: geometry clearly deeper (tests pass), but the day frame still reads as cream bands and fine mullions.
4. Spandrel tone darkened (0.36/0.42/0.50): spandrel band barely visible in the day frame.

Why the day frame stays flat: the camera is close to frontal and the sun is frontal. Fin and slab fronts are lit the same as the panes, and the recess sides are edge-on. The 1 m recess is mostly hidden by the protruding slab tops and soffits. Real depth needs one of: a more oblique camera or sun (out of scope, owner decision), stronger value contrast between frame and panes (not tried), or a shadow-casting light (out of scope).

## Tests

- `node --test tests/`: 150 pass, 0 fail.
- Browser (browser-harness on a dedicated headless Chrome, port 9444; local preview on 8000):
  - pass: office-depth (new), office-facade (updated: compares to the depth factory), office-slice, citywide, architecture-archetypes, building-kit, building-slice, midrise-slice, tower-slice, shop-slice, townhouse-chunk, hirise-kit, hero-facades, real-city, final-art.
  - fail, pre-existing, unchanged: zfight ("1112 z-fighting face pairs", same as HEAD). Not fixed; its boxes are world props, not the office tower.
- Not run: WebGL-off, reduced motion, 375 px mobile, console-error capture, Lighthouse.

## Evidence (this folder)

- `before/5-day.jpg`, `before/5-night.jpg`: HEAD, 1728 x 876, weather=clear, stop 5.
- `after/5-day.jpg`, `after/5-night.jpg`: depth variant (final iteration), same framing.
- `crops/tower-{before,after}-{day,night}.jpg`: 2x (DPR 2) close diagnostic of the tower, 980 x 940 crop at (1620, 400) of the 3456 x 1752 frame.
- `crops/zoom-{before,after}-day.jpg`: 460 x 330 crop of two floors at 2x.
- `iterations/iter{1,2,3}-tower-day.jpg`: 2x day crops per iteration (iter 4 is `crops/tower-after-day.jpg`).
- Full 2x PNG frames were not kept (size); they can be regenerated with `tools/capture.py` plus a DPR-2 viewport.
- Capture command: `OUT=... SHOTS="5:day,5:night" QUERY=weather=clear browser-harness < tools/capture.py` (weather must be set; the default rolls rain).
