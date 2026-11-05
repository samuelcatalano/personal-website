# Landmark reconstruction checkpoint — 2026-11-05

## Scope and decisions

- Improve Copan, London Eye, Tower Bridge, Riverside Museum, University of Glasgow, Wembley.
- Preserve Catedral da Sé, MASP, Ponte Estaiada and Big Ben/Elizabeth Tower. No shared lighting, map, route or renderer edits unless a regression check proves safety.
- Use original Blender-authored GLBs with the current Three.js transforms and procedural fallback. No npm or new runtime dependency. Keep landmark budgets: ≤8k triangles and 3–8 draw calls each; no baked lighting; no external meshes/textures.
- Six agents get unique asset folders/GLB outputs; primary owns runtime integration, registry, tests and final validation. No commits/pushes.

## Reconnaissance

- Branch `feat/site-gamefication`; worktree clean before work.
- Integration: `js/world/landmarks.js` builds procedural landmarks; `js/world/landmark-geometry.js` owns Copan/Eye/Bridge/Wembley/University/Riverside geometry; `scene.js` already upgrades Tower Bridge from Blender GLB with procedural fallback and LOD.
- References consulted: [Copan photos](https://www.copansp.com.br/fotos.html), [São Paulo city restoration note](https://prefeitura.sp.gov.br/web/licenciamento/w/prefeitura-de-s%C3%A3o-paulo-avan%C3%A7a-em-revitaliza%C3%A7%C3%A3o-do-centro-com-investimento-hist%C3%B3rico-para-requalifica%C3%A7%C3%A3o-do-edif%C3%ADcio-copan), [London Eye engineering facts](https://www.londoneye.com/about-us/history/), [Tower Bridge architecture/engineering](https://www.towerbridge.org.uk/explore-inside), [Riverside Museum](https://www.glasgowlife.org.uk/museums/venues/riverside-museum/about-riverside) and [roof cladding](https://www.bam.co.uk/case-studies/riverside-museum-glasgow), [Gilbert Scott Building](https://www.gla.ac.uk/explore/visit/campustours/prospectivestudents/studentsselfguided/gilbertscottbuilding/), [Wembley facts](https://www.wembleystadium.com/about/stadium-facts-and-features).
- Desktop baseline captures: `/tmp/landmark-baseline-2026-11-05` (stops 5, 9, 10, 11; day/night).
- Three Desktop route-profile runs, stops 5→11.25, default quality, same browser: median frame time 16.7 ms in all; p95 25.3/25.2/25.2 ms; median draws 1,443/1,438/1,443; median submitted triangles 9,978,872/9,978,440/9,978,557; heap peak 1,033/1,050/1,020 MB. FPS ≈59.9 at median frame time. Geometry/material/texture counts not exposed by this profiler.
- `tests/landmark-geometry.browser.py` baseline passed with the page loaded from `index.html`: Wembley 7,476 tris; procedural Tower Bridge 5,688; London Eye 3,872; Copan bounds x[-77.33,-36.67], y[0,38.4], z[-54.9,-35.1]. Protected models measured: Big Ben 2,488, MASP 552, Sé 4,720, Estaiada 1,596 tris.
- Harness note: direct test redirection starts on a blank tab and fails before assertions (`import('three')` lacks the page import map). `new_tab` + `activate_tab` + confirmed `page_info()` + executing test file passes. The harness `wait_for_load()` itself returned a stale-target error; no project code changed.

## Implementation

- Six asset fronts were completed in parallel using Luna with `max` reasoning. The requested `Extra High` label was not available in the agent configuration. Every Blender builder and per-asset README records its references; no external mesh or texture was included. Copan's official gallery returned HTTP 502 during the work, so the documented municipal restoration note and available exterior views informed its model.
- Original Blender-authored assets are in `tools/landmarks/{copan,london-eye,towerbridge,riverside,university,wembley}/`; exports are in `assets/processed/landmarks/` as paired LOD0/LOD1 GLBs.
- Runtime integration is in `js/world/authored-landmarks.js` and `js/world/scene.js`. It preserves existing transforms except the owner-requested Copan horizontal mirror around its lot centre, keeps procedural fallbacks, reuses cached GLB loads, selects LOD with hysteresis, applies existing day/night glow metadata, and preserves the London Eye's animated wheel. Query `?landmarks=procedural` restores the procedural targets for comparison. The Tower Bridge loader keeps its established night overlays and fallback.
- The only protected-landmark integration check was geometry counts/bounds in the scene; those matched baseline. No protected landmark source geometry, material, or per-landmark lighting was changed.

## Per-landmark results

| Landmark | LOD0 / LOD1 triangles | Draws | State |
| --- | ---: | ---: | --- |
| Copan | 7,900 / 2,956 | 3 | Complete; curved façade, subtle piers, mirrored left side wall |
| London Eye | 3,576 / 2,308 | 6 | Complete; 32 capsules, radial wheel, supports, frame and base |
| Tower Bridge | 7,964 / 2,178 | 1 | Complete; twin Gothic towers, deck, upper walkways and lift spans |
| Riverside Museum | 3,372 / 1,868 | 3 | Folded zinc roof, regular orthogonal mullion grid, separate steel V-bracing and transmissive glass |
| University of Glasgow | 7,899 / 3,019 | 3 | Gothic ranges, central tower, four clock faces, pinnacles and window rhythm |
| Wembley | 6,398 / 3,286 | 3 | Complete; oval bowl, roofline-anchored single arch lattice and ties |

Every LOD is within the documented 8k-triangle maximum; lower LODs stay within the 4.5k target. Per-asset READMEs document local dimensions, sources and export checks.

## Validation

- `rtk node --test tests/`: 163 passed, 0 failed (existing Node module-mode warnings only).
- Desktop browser contracts passed for landmark assets, Tower Bridge asset, landmark geometry, and landmark night glow. Checks cover LOD budgets and switching, preserved transforms, London Eye wheel rotation, fallback on blocked assets, overlay visibility, glow, and disposal.
- Protected geometry remained at baseline: Big Ben 2,488, MASP 552, Sé 4,720, Estaiada 1,596 triangles. Copan placement bounds and procedural Tower Bridge/Eye geometry remained unchanged under fallback.
- Desktop in-project captures were inspected at day and night in multiple views: `/tmp/landmark-qa-2026-11-05/grid-all-landmarks.png`; route captures are in `/tmp/landmark-after-2026-11-05` and close views in `/tmp/landmark-close-2026-11-05`. Wembley’s route camera crops the arch, but the custom in-scene view shows the complete arch. Captures include all six, two views each, day/night.
- Browser console probe on the integrated Desktop page: world ready, zero captured `console.error`, uncaught-error, or unhandled-rejection entries.
- `towerbridge.manifest.json` parses and both checked-in GLB SHA-256 values and byte counts match. `git diff --check` passed.

## Performance

All measurements used Desktop, the same default quality, `SEG=5:11.25`, the same browser, and three repeats per set. The initial pre-change baseline had p95 25.3/25.2/25.2 ms (median 25.2), median draws 1,443, and median submitted triangles about 9.979M. The three post-change runs had p95 27.6/27.0/26.6 ms (median 27.0), median draws 1,211, and median submitted triangles about 9.979M.

Because the post set initially exceeded the original p95 target by 1.8 ms, a contemporaneous comparison was made against an unmodified `HEAD` archive served separately, with the same route and browser: p95 30.5/31.1/27.4 ms (median 30.5), median draws 1,426, and median triangles about 9.983M. The current authored scene was 3.5 ms lower in p95 and 215 draws lower in median than this re-run; triangles were equivalent. Current procedural-only control runs were 27.0 and 26.6 ms p95, which also indicates no measurable p95 cost from the new authored assets. The large shift between the early and contemporaneous baseline shows substantial run-to-run/environment variation. Performance was measured, but the original +1 ms threshold cannot be established conclusively from these noisy windows; retain the paired result as the more informative check and remeasure on a quiet Desktop before a release decision if the threshold is strict.

## Final state

- Six landmarks are integrated and visually validated in the running Three.js scene; no mobile checks were run.
- No commit or push was made. Worktree contains only the intended landmark assets, builders, docs, integration and focused browser tests.
- Main residual risk: early p95 baseline differs from same-session reruns by more than the acceptance margin; attribution to authored landmark cost was not observed in the procedural control.

## Riverside visual revisit — 2026-11-05

- Followed the user's five day/night façade references and official Glasgow Life / BAM references; no third-party mesh, photo or texture was used.
- Rebuilt both Blender LODs with the same 32 × 15 × 16.3 m envelope and three material buckets. LOD0: 3,336 triangles / 182,860 bytes; LOD1: 1,688 triangles / 93,864 bytes. Both remain within existing budgets.
- Added the dark roof fascia, more zinc seams, the neutral reflective glazing, façade mullions, and visible steel V-bracing. The night wash is yellow-green and sits behind the structural grid. Versioned the authored loader cache; the fallback was also aligned.
- Desktop captures inspected: authored `/tmp/riverside-final-2026-11-05/{11-day,11-night}.png`; procedural fallback `/tmp/riverside-fallback-2026-11-05/{11-day,11-night}.png`.
- Extra Desktop opposite-side view: `/tmp/riverside-alt-angle-2026-11-05/11-backside-day.png`; the opposite façade and roof read cleanly, though a neighbouring building partly occludes one end.
- Revisit checks: Blender GLB integrity/bounds/triangle validation; asset, geometry, glow and Riverside silhouette tests. Final night-glow contract peak: 0.325 (within the tested 0.3–0.95 range). The protected landmark geometry counts remained at their established values.
- No fresh p95 A/B was run for this focused revisit; the additional asset geometry is 1,492 LOD0 triangles with no new draw bucket, and broad repeated profiling is deferred under the project validation policy.

## Riverside glazing and context revision — 2026-11-05

- Removed only `marked-infill-7` beside the museum and kept later lot IDs stable. The museum keeps its original center and uses a 36 × 18 m site envelope; its model is scaled 1.125× to 36 × 16.875 × 18.3375 m.
- Aligned side and end façade mullions to regular orthogonal panel grids. The V-braces remain separate steel members behind the glazing. The glass GLB now uses KHR transmission 0.8, IOR 1.52, roughness 0.08, a blue tint and runtime environment intensity 1.2.
- Rebuilt with Blender 5.2.3: LOD0 3,372 triangles / 184,988 bytes; LOD1 1,868 triangles / 103,768 bytes. Both retain three draw buckets and remain inside their existing budgets.
- Desktop day/night captures inspected at stop 11: `/tmp/riverside-grid-2026-11-05/11-day.png` and `11-night.png`.
- Checks passed: focused Glasgow Node tests, authored landmark browser contracts, landmark geometry and glow contracts, and the Blender GLB import/export bounds and triangle validation.
- No mobile checks or new p95 performance A/B were run for this scoped scene revision.

## Copan colour and night pass — 2026-11-05

- Applied the owner-supplied day/night photos: warm sandstone fins (`#c4b58f`), muted warm mass (`#b5ad9d`), blue-green glass (`#31515b`), and individually marked amber windows with a few warm-white/cool panes.
- Blender generates and packs one 384×192 emissive map into both GLBs. Glass UVs reuse the existing mesh; the asset stays at 7,812 / 3,044 triangles and three draw calls. No new lights or geometry. Runtime clears the imported emissive factor during day and applies the existing night glow only through the window map; cache version is now 2.
- Rebuilt with Blender 5.2.3; both LODs passed import/export round-trip checks for triangles, bounds, UVs and embedded emissive texture. Browser asset contract passed, including palette, map dimensions, day emissive zero, fallback and other landmark checks. The harness's default 5-second IPC wait timed out once on the full browser expression; the same suite passed with the project's extended WebGL timeout.
- Inspected Desktop route captures at stop 5, day/night, clear weather: `/tmp/copan-final-2026-11-05/grid.png`. No mobile capture or performance rerun was needed for this material-only adjustment.

## Copan façade correction — 2026-11-05

- Removed the tall façade mullion strips; matched glass/core curve subdivisions (LOD0 32, LOD1 16) to stop the inner wall crossing the glazing. Replaced one glazed end with a concrete side wall and small window slits, then mirrored the Copan group locally so the side wall sits left without changing its site position. Procedural fallback has the same orientation and side-wall profile.
- Blender round-trip: LOD0 7,580 tris / 424,912 bytes; LOD1 2,796 tris / 162,724 bytes; three draws each, bounds unchanged. `tests/landmark-assets.browser.py` passed for authored LODs, budgets, placement, fallback and night metadata. In-project Desktop captures were inspected at day and night: `/tmp/copan-segment-fix-2026-11-05/5-day.png` and `5-night.png`; the vertical artifacts are gone.
- Loader cache version is 3. Performance benchmark not repeated for this geometry-only correction; no shared rendering or protected-landmark code was altered.

## Copan column and material refinement — 2026-11-05

- Added fine shallow façade piers (20 at LOD0, 10 at LOD1 and in the procedural fallback). Changed glass to neutral warm gray (`#4b4945`) and warmed the sandstone mass/fins to `#c0af8d` / `#d1bd91`. Existing mapped warm/cool night windows remain unchanged.
- Blender 5.2.3 round-trip: LOD0 7,900 tris / 442,192 bytes; LOD1 2,956 tris / 171,368 bytes; three draws each and bounds unchanged. Desktop asset test passed for palette, glass roughness, day/night glow, LODs, placement and fallback. Authored and procedural day/night captures were inspected at `/tmp/copan-colour-columns-2026-11-05/` and `/tmp/copan-colour-columns-fallback-2026-11-05/`.
- Loader cache version is 4. No shared materials or protected landmarks changed. p95 was not remeasured; LOD0 remains within the 8k-triangle budget.

## Wembley arch correction — 2026-11-05

- Joined the visible arch springs to the roofline and reduced the arch to one integrated tubular lattice. The authored model no longer draws a second procedural glow arc; cyan night glow now comes from its trim material. The procedural fallback also uses one arch path.
- Blender 5.2.3 round-trip: LOD0 6,398 tris / 325,528 bytes; LOD1 3,286 tris / 174,368 bytes; three draws and unchanged footprint. Desktop front/oblique day/night captures: `/tmp/wembley-review-final-2026-11-05/`.
- Landmark geometry and authored-asset browser contracts passed; protected landmark triangle counts/bounds match prior values. Cache version is 6. No performance remeasurement for this geometry-only correction.

## Wembley ground-anchored single arch follow-up — 2026-11-05

- Responded to visual feedback by keeping one connected lattice arch, extending both ends to ground footings, and removing the parallel continuous chords that made it read as two arches. Height/span now follows the official 133 m / 315 m ratio; placement and footprint remain unchanged.
- Blender 5.2.3 round-trip: LOD0 7,744 tris / 392,048 bytes; LOD1 3,948 tris / 198,688 bytes; three draws each. Browser geometry and authored-asset checks passed. Authored/fallback front and oblique day/night captures: `/tmp/wembley-one-arch-correction-2026-11-05/`. Cache version is 8.
- Both arch endpoints are at y=0 in the model, but nearby city geometry partly hides the left footing in the front capture. Desktop p95 was not remeasured for this geometry-only update.

## University clock detail — 2026-11-05

- Added an outward-facing clock dial to each side of the central tower, in the clear stone band above the tall lancet window. LOD0 uses 12 hour marks per face and LOD1 uses four; the dials share the existing `Trim` bucket. The procedural fallback matches, while the model bounds and city placement stay unchanged.
- Blender 5.2.3 round-trip: LOD0 7,899 triangles / 766,032 bytes; LOD1 3,019 triangles / 289,704 bytes; three draws each. Both retain the existing local bounds and stay within the triangle budgets. Authored asset URL version is now 11.
- Desktop day/night captures inspected at stop 11: `/tmp/university-clock-2026-11-05/11-day.png` and `11-night.png`. Browser contracts verify all four outward-facing dials in the fallback and both authored LODs; focused Glasgow geometry tests passed.
- No mobile check, full Node regression or new p95 performance A/B was run for this small detail pass.

## University placement adjustment — 2026-11-05

- Moved the University centre 11 m east (`g - 48` to `g - 37`) through the shared Glasgow site data, so its 72 m footprint clears the Riverside envelope by 1 m while remaining west of the Glasgow stop. The authored building, fallback, plinth, flag and city clearance reservation all follow the shared position.
- Focused checks passed: `tests/logic.test.mjs` (27), `tests/glasgow-clearance.test.mjs` (10) and `tests/glasgow-landmarks.test.mjs` (2).
- Fixed the hero integration descriptor to match the generated Glasgow area lot (31.5 m); this was the exception that prevented the whole WebGL scene from starting. The Desktop night capture at `/tmp/university-right-2026-11-05/11-night.png` now renders Glasgow. `tests/shop-slice.browser.py` and `tests/logic.test.mjs` pass; `tests/hero-integration.browser.py` still stops on a missing legacy midrise hash fixture. No mobile or performance run was made.
