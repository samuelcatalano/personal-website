# Facade and headlight evidence

Stop 5 office tower (`block--183--37`, `createOfficeSlice` in `office-slice.js`) and the Glasgow bus headlight road pool (`addBeams` in `beams.js`, used by every vehicle at night).

## Cause

- **Facade:** the office glass sits 0.32 m behind the piers and spandrels, but every pane has the same albedo and sky reflection and nothing darkens the recess. The tower reads as one blue-grey field.
- **Headlight:** one 13 × 8 m additive plane at night opacity 0.3. Its brightest part sits between the two lamps and runs several metres past the bonnet, so it reads as a projected decal rather than light from the lamps.

## Change

- `js/world/building-slice-materials.js`: `officeFacadeMaterials()` gives the office glass its own material on the shared atlas and maps. Its shader darkens the top 24 % of each pane (up to 50 %), darkens the pier reveal (up to 26 %) and applies a ±6 % per-pane tone. `applyOfficeFacade()` adds per-vertex pane coordinates; vertex positions do not move.
- `js/world/building-kit.js`: the `OFFICE_LOT_ID` branch calls `applyOfficeFacade()`. Other office lots and all other families keep the shared material.
- `js/world/beams.js`: one lobe per headlamp, widening and fading with range (zero by about 9 m). Night pool opacity 0.3 → 0.16. Pool geometry (13 × 8 m) is unchanged, so the underpass projection still matches.
- Tests: `tests/office-facade.browser.py` and `tests/headlight-pool.browser.py` (new). `tests/vehicle-fade.browser.py`: the pool opacity literal 0.3 → 0.16.

Unchanged: lot IDs, envelopes, heights, office positions (asserted), mass and trim materials, other families, vehicles, wheels, routes.

## Captures

Viewport 1728 × 963 CSS px at DPR 2 (3456 × 1926 source, shown as 1728 px JPEG). Before = HEAD `d193aa9`. After = HEAD plus the three JS files above. Same scroll targets (stop 5 y 6816, stop 11 y 22321), panel hidden.

- `before/`, `after/`: 5-day, 5-night, 11-night (clear); rain-5-day, rain-11-night.
- `crops/`: office, glass and pool crops at native resolution.

Observed: the pool is now two short lobes at the lamps, and the lamp glow stays readable. The recess shadow under each ledge and the inset piers show at native resolution, but the effect is still moderate.

## Limits

- The working tree held other agents' uncommitted edits (`ao-pass.js`, `post.js`, `scene.js`, `sky.js`). They added horizontal banding to the road, so these captures come from HEAD and from HEAD plus the three files only.
- Real mullion and ledge depth needs geometry in `office-slice.js`, which is outside the owned list. Not done.
- `beams.js` holds all headlight code but is not on the owned list. Only the pool footprint and opacity changed.
- The office change also applies with `rollout: false`, because both modes call the same branch.
- Browser: the default browser-harness connection to the user's Chrome had dropped, so captures ran on a dedicated headless Chrome (port 9444).
- Not run: WebGL-off, reduced motion, 375 px mobile, console-error capture.

## Tests (HEAD plus change)

- Browser pass: office-facade (new), headlight-pool (new), beams, office-slice, building-kit, building-slice, citywide, vehicles, vehicle-fade, final-art, underpass, hero-facades, tower-slice, midrise-slice, townhouse-chunk, material-polish.
- Browser fail, pre-existing (same result at HEAD): zfight, "1112 z-fighting face pairs".
- `node --test tests/`: 143 pass, 0 fail.
