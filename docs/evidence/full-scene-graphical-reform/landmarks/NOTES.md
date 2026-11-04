# Landmark glow and finish fixes (Task 5/6 slice)

Before and after captures of the four landmark defects from the [baseline](../README.md). Code: `js/world/landmark-materials.js` (`capStripGlow`, `finishLondonEye`), `js/world/landmarks.js` (wiring). Test: `tests/landmark-glow.browser.py`.

## Method

- "Before" = `HEAD` (aefe627, code identical to e9225d4) served from a clean snapshot. "After" = the same snapshot plus only the two changed modules. Other uncommitted work in the shared tree was excluded.
- Capture: 1728x963 viewport, DPR 2 (3456x1926 originals), UI hidden, `js/scroll.js` stop scroll, 7 s wait, weather `clear` or `rain`, theme `day` or `night`. Driven through Chrome DevTools MCP (the shared browser-harness daemon was unavailable). Same steps as `tools/capture.py`, not the same runner.
- Frames in `before/` and `after/` are 1400 px wide. Crops in `crops/` are native resolution.

## Defects

| # | Defect | Cause | Change | Peak emissive luminance (bloom threshold 0.95) | Evidence |
|---|---|---|---|---|---|
| 1 | Estaiada X bloom, night | Cool edge strips, `glowK` 3.2, vertex brightness 1.0 | `capStripGlow(...)` scales this landmark's strip vertices so `glowK` is effectively 0.9. Shared material untouched | 2.6 -> 0.73 | `crops/estaiada-9.5-night-left-*.jpg`, `crops/estaiada-5-night-*.jpg` |
| 2 | Eye pods and rim overexposed, night | Rim `glowK` 1.0 and pods 1.2 on pale colours | Rim `glowK` 0.45. Pods get a dark glass body (`#6f8294`) with warm emissive `glowK` 0.3 | Rim 0.79 -> 0.36 | `crops/eye-9.5-night-*.jpg` |
| 3 | Riverside roof outline, night | Roof-edge cool strips, `glowK` 3.2 | `capStripGlow(..., .5)` | 2.6 -> 0.41 | `crops/riverside-11-night-*.jpg`, `crops/riverside-11-rain-night-*.jpg` |
| 4 | Eye rim low contrast in rain | Pale rim against the overcast sky | When `visitWeather.lon.rain > 0`, rim colour lerps to `#5b6b7a` (full at rain 0.5+). No new mesh | Rim lum 0.79 -> 0.14 (rain) | `crops/eye-rain-9.5-day-*.jpg` |
| 5 | MASP dark band under body | See below | Not changed | n/a | `crops/masp-5-day-underside-*.jpg` |

## MASP (defect 5): not fixed

- The default scene renders the authored GLB `assets/processed/landmarks/masp.lod0.glb` (200 OK). `masp-asset.js` hides the procedural group. The GLB is outside the owned files.
- The GLB already closes the underside: a downward plate at y = 8.0 (2 triangles, x ±17.2, z ±6.5). Its material is `FrontSide`.
- The procedural fallback (`?landmarks=procedural`, same framing) shows the same dark area under the body. The band is most likely the shadow of the suspended body on the plaza, not a missing surface. This is not confirmed with a shadow-off capture.
- z-fighting: 0 exact duplicate triangles. 1,984 coplanar overlapping non-adjacent triangle pairs exist in the GLB (for example the sill band y 8.0-8.4 against the column face at x = -17.2). The material is one atlas, and no flicker shows in stills. The structural overlap is a candidate for removal when the GLB is rebuilt in `tools/landmarks/masp/build_masp.py`.

## Side effects and deviations

- Estaiada stays and deck-edge strips (vertex brightness 0.11 and 0.6) also dim with the same factor. Cables read as thin grey lines at night rather than bright lines. The pylon edges still read as metal.
- No separate emissive core mesh in the Eye. An extra 32-instance mesh breaches the Eye triangle budget (3,872 of 4,000). The core is the body's warm `glowK` 0.3 instead.
- Day pods change from pale yellow to dark slate glass (day rendering only).

## Checks

- `node --test tests/`: 143 pass, 0 fail.
- `tests/landmark-glow.browser.py` (run as in-page JS on the after tree): pass. Strip peaks 0.73 / 0.41 under 0.95; Eye rim 0.785 clear, 0.14 rain; Eye 32 instances, 3 children.
- `tests/landmark-geometry.browser.py` (in-page JS, same tree): pass. Eye triangles 3,872 of 4,000, light triangles 5,945 of 6,000, two shared light materials, MASP free-span rays clear.
- Not run: `material-polish`, `zfight`, `landmarks`, `masp-asset`, `landmark-startup` browser suites; mobile 375 px; WebGL off; reduced motion; EN/PT.
