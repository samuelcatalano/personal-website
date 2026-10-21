# North Star full-scene upgrade — plan

Authorized by the user 2026-10-21 (reopens the visual freeze for this scope). Audit: [visual atlas](../audits/full-scene-visual-atlas.md). Budgets: [asset spec](../art/asset-quality-spec.md).

**Global constraints:** preserve map, routes, stops, landmark anchors/positions, lot footprints/heights, UI/content/accessibility, WebGL-off and reduced-motion behaviour. No engine change, no npm/build, no SSR/cubemaps/extra shadow lights. Approved building families (townhouse/shop/midrise/office/tower) keep their geometry. Shared materials; deterministic variation. Do not use Sketchfab; external assets only CC0/clearly permissive and logged in `ASSET_SOURCES.md`.

Ordered by visual impact / effort (evidence from the 35-capture audit):

| # | Milestone | Scope | Files | Status |
|---|---|---|---|---|
| 1 | **Lighting & atmosphere** | Golden-hour key/fill, saturated sky, warmer/farther haze, warmer water glint | `sky.js`, `mood.js`, `post.js` (grade pass), `water.js` | done 6e63848 |
| 2 | **Roads & vegetation** | Warmer asphalt, centre/edge lines, zebra crossings at stops; larger fuller trees + street-verge trees outside paths | `city.js` (road marks), `palette.js`, `trees.js`, `roadmarks.js` (new) | done 6e63848 |
| 3 | **Vehicles** | Smooth Mini, polished Routemaster, shared smooth car family (sedan/hatch/cab/van), airplane rebuild | `bus.js`, `ambient.js`, new `vehicles.js` | done 264ec8f |
| 4 | **Landmarks** | London Eye, Estaiada, Sé, Tower Bridge, Heathrow rebuild with `landmark-geometry.js` pattern | `landmark-geometry.js`, `landmarks.js`, `saopaulo.js` (+ plane) | done 352990e |
| 5 | Secondary | Copan brise-soleil, Glasgow Riverside/University polish, boats | `saopaulo.js`, `riverside.js`, `university.js`, `ambient.js`, `glasgow.js` | done 0e30066, 1f712b2 |
| 5b | Technical gate | Coplanar-face (z-fight) source fixes so the strict guard passes | parks/city/country/glasgow/houses builders | done 60d7670 |
| 6 | Final traversal | Same 35 positions; desktop high + mobile medium; regression | — | done — 101/101 Node, 32/32 browser suites |

Each milestone: related tests + screenshot + console; commit per milestone (`art: …`). Milestone 6 runs full Node + relevant browser suites.

## Rulings

- Ruling: implementers do not commit; the primary agent reviews and commits per milestone — avoids index collisions when independent files are worked in parallel — cost if wrong: slightly larger commits.
- Ruling: London Eye is rebuilt despite the earlier "accepted segmented" note — the user's North Star brief explicitly calls for it — cost if wrong: revert one function.
- Ruling: no external 3D assets; all upgrades procedural — every needed shape is achievable with lathe/extrude/tube primitives and avoids licence risk — cost if wrong: some assets less detailed than a curated CC0 model.
- Ruling: tree visible-height cap raised 4.4 → 6.6 m (tests/trees.browser.py updated); crown width still ≤ path-safe `crown` — North Star needs full canopies, landmarks are 14–40 m tall so sightlines hold — cost if wrong: one constant.
- Ruling: tests/real-city.browser.py lane-mark check now counts roadmarks.js ribbon quads in the pilot span (voxel dashes removed) and expects the 3.34 m sidewalk pad — same invariant, new source — cost if wrong: one test edit.
- Ruling: a static Eye A-frame lives in `details`; only the wheel spins — matches the real structure — cost if wrong: none visible.
