# North Star full-scene upgrade — plan

Authorized by the user 2026-10-21 (reopens the visual freeze for this scope). Audit: [visual atlas](../audits/full-scene-visual-atlas.md). Budgets: [asset spec](../art/asset-quality-spec.md).

**Global constraints:** preserve map, routes, stops, landmark anchors/positions, lot footprints/heights, UI/content/accessibility, WebGL-off and reduced-motion behaviour. No engine change, no npm/build, no SSR/cubemaps/extra shadow lights. Approved building families (townhouse/shop/midrise/office/tower) keep their geometry. Shared materials; deterministic variation. Do not use Sketchfab; external assets only CC0/clearly permissive and logged in `ASSET_SOURCES.md`.

Ordered by visual impact / effort (evidence from the 35-capture audit):

| # | Milestone | Scope | Files | Status |
|---|---|---|---|---|
| 1 | **Lighting & atmosphere** | Golden-hour key/fill, saturated sky, warmer/farther haze, warmer water glint | `sky.js`, `mood.js`, `scene.js` (fog/hemi only), `water.js` | pending |
| 2 | **Roads & vegetation** | Warmer asphalt, centre/edge lines, zebra crossings at stops; larger fuller trees + street-verge trees outside paths | `city.js` (road marks), `palette.js`, `trees.js`, tree placement callers | pending |
| 3 | **Vehicles** | Smooth Mini, polished Routemaster, shared smooth car family (sedan/hatch/cab/van), airplane rebuild | `bus.js`, `ambient.js`, new `vehicles.js`, `landmarks.js` (plane) | pending |
| 4 | **Landmarks** | London Eye, Estaiada, Sé, Tower Bridge, Heathrow rebuild with `landmark-geometry.js` pattern | `landmark-geometry.js`, `landmarks.js`, `saopaulo.js` | pending |
| 5 | Secondary | Copan brise-soleil, Glasgow Riverside/University polish, boats | as needed | deferred unless time |
| 6 | Final traversal | Same 35 positions; desktop high + mobile medium; regression | — | pending |

Each milestone: related tests + screenshot + console; commit per milestone (`art: …`). Milestone 6 runs full Node + relevant browser suites.

## Rulings

- Ruling: implementers do not commit; the primary agent reviews and commits per milestone — avoids index collisions when independent files are worked in parallel — cost if wrong: slightly larger commits.
- Ruling: London Eye is rebuilt despite the earlier "accepted segmented" note — the user's North Star brief explicitly calls for it — cost if wrong: revert one function.
- Ruling: no external 3D assets; all upgrades procedural — every needed shape is achievable with lathe/extrude/tube primitives and avoids licence risk — cost if wrong: some assets less detailed than a curated CC0 model.
