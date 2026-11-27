# Visual refinement round 2 (progress)

Camera lock: `js/world/camera.js` hash 16a37aa, `js/world/scene.js` hash 5c408f4 (git hash-object, start of round). PerspectiveCamera(40) at scene.js:120. Neither file is touched.

## Batch A: audit and quick wins (done, uncommitted)

Checked on desktop in the Browser pane. Intro loads, CTA morphs "Loading São Paulo · N%" to "Start the Journey", HUD and Options menu render.

| Hypothesis | Verdict |
|---|---|
| Duplicate "Ready to depart." | Not a defect: second copy is `.sr-only` live region |
| "STOP REQUESTED" before boarding | Not a defect: hidden destination-sign state (opacity .35, not visible) |
| Start vs Load CTA redundancy | Not a defect: one button changes label |
| View City vs Hide the Interface | Confirmed: same `setHidden` action, two controls and two labels |
| Restore pill invisible while UI hidden | Confirmed bug: `#ui-restore` was inside `<header class="bar">`, which fades to opacity 0 |

Fixes:
- `index.html`: `#ui-restore` moved out of the header.
- `js/ui.js` `paintHide`: on desktop (>=768px) the pill shows only while the UI is hidden. Options → View City and H hide it. Mobile unchanged.

Verification: node --test 364/364; live check: pill hidden in normal state, appears after H.

Scroll sweep of all stops (13 samples, Sao Paulo to Wembley): panel, Journey counter (0/12 to 12/12), city arrival toast and passport (1/3 to 3/3) update in step. Counter (stops passed) and passport (cities stamped) measure different things and are labelled differently: not a defect. Nav More/Recommendations/Contact: Recommendations and Contact are visible in the desktop bar: not a defect.
Console: only synthetic-event noise (`e.target.closest` came from my own `document.dispatchEvent`, real keys target body) and blocked `navigator.vibrate` before a user gesture (harmless). Four "error fetching the script" entries not traced (likely aborted loads from page reloads).

## Batch B: materials and light (checked, no change)
Audit 2026-11-24 quick wins were already shipped by realism passes (f049239, decfec5): ground macro tint (`textures.js`, `plant-mesh.js`), far-field haze (`backdrop.js` hazeTone), foam alpha (`water.js`), glass variation. Viewed London and Glasgow live: ground, haze, glass and water read well. No safe edit left that is not owner-gated.
Open and owner-gated: facade "candy" palette on mid/high-rise (audit item 3, `palette.js`), facade lattice repetition (item 10).

## Batch C (start): facade palette, approved by owner
`js/world/city.js`: UK_WALLS/BR_WALLS candy hues (terracotta, ochre, mint, salmon, sky blue) pulled toward stone with `hazeTone` (chroma 0.78 UK, 0.86 Brazil). Same array length and order, so RNG, layout and lots are unchanged. Townhouse palette (`houses.js`) and global `palette.js` untouched. Tests 364/364; London loads with no import errors and mid-rises read calmer. São Paulo and Glasgow re-checked live (Glasgow far field no longer shows mint/pink/teal blocks; SP mid-rises read stone with muted green). No pixel-identical before/after frames; perf not measured (colour constants only, no shader or geometry change).

## Arrival toast contrast: rejected as defect
`#arrival` (css/style.css:595) is an opaque near-black gradient with amber dot-matrix text; the low contrast seen in earlier captures was the .4s opacity fade (measured opacity 0.27 mid-transition). No change.

## Auto Ride and postcard (checked, no change)
Auto Ride: one steady pass (~275 px/s of scroll, no stops), toggles off and halts cleanly. Postcard: composed 1600x1000 PNG with LED caption "83 · 2017 SÃO PAULO", three route stamps, name and host. Download was intercepted and previewed in-page, nothing saved. Minor, left as is: stamp rings are thin amber and can get lost over bright facades.

## Guided Tour and Request Stop (checked, no change)
Guided Tour: advances stop to stop with dwells, toggles off cleanly. Request Stop: button shows only during the Guided Tour (hidden in Auto Ride, which has no stops, and when idle); B key sets the sign to STOP REQUESTED. States match the lifecycle.

## Batch E (start): postcard stamps
`js/postcard.js`: each route stamp now sits on a dark translucent disc (same language as the caption bar), ring alpha .9 to .95. Verified in a previewed postcard (São Paulo stop): stamp legible over bright facades. Tests 364/364. Camera hashes unchanged.

## Window lattice (audit item 10): investigated, not changed
Shader-level variation already ships in `building-slice-materials.js`: per-pane tone and roughness, ~30% dark cells on towers, night emissive tone/blind variation (`pane-var-v3`). What remains is the geometric grid (pane bays, sill/lintel depth, balconies/AC units) in `facade-kit.js` / `facade-articulation.js`: per-lot geometry that changes silhouettes and batching, overlaps the Codex-owned urban densification, and needs its own plan and perf gate. Left for an owner decision.

## Facade geometry, option B (implemented, effect subtle)
`js/world/facade-kit.js:75`: midrise style 3 (previously bare below the top-floor hoods) now gets `window_bracketed_sill_06` on floors where `f % 3 === 1`. Existing kit piece, merged into the same chunk accumulators (no new draw call by design). Tests 364/364, no new console errors, camera hashes unchanged. Not demonstrable at the locked camera (sill bands are small at that distance); draw calls/triangles not cleanly measured: `info.render` counters mix passes and were not comparable across reloads. Revert is one line if unwanted.

## Remaining
- Batch A: Auto Ride, Guided Tour, postcard and Request Stop not yet exercised. Arrival toast contrast over busy scenes (London) is a candidate.
- Batches B-E (materials, lighting, urban realism, landmarks, polish) not started.
- No fresh perf baseline yet.
- Browser Pane is 800x600 / 1024 wide in this session; use a larger window for visual captures.

## Big Ben night brightness jump after Tower Bridge (user report)
Cause confirmed: the authored Big Ben swaps LOD0 to LOD1 at ~170 m from the camera (x~290, just past Tower Bridge), and LOD1's atlas reads ~12% brighter at the same glowK (tower region mean luminance 84.5 vs 75.3 at the same frame; lights, exposure and fog were smooth). Owner chose to drop the swap: `js/world/bigben-asset.js` now loads and shows LOD0 only (LOD1 GLB stays on disk, unused; `tests/bigben-asset.browser.py` expects one LOD, not run here). Cost: +8,285 tris at distance (11,588 vs 3,303), same draw calls, saves a 540 KB download; frame time not measurable in the Browser pane (~1 fps), owner may measure in own Chrome. Verified live at camera x 210/296/374: only BigBen_LOD0 present and visible. Tests 364/364, camera hashes unchanged.
