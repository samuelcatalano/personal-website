# Bridge finish and landmark portals

Owner explicitly reopened graphical/visual work on the two London/Glasgow river bridges and the solid black entrances on Tower Bridge and Catedral da Sé. Retain approved city composition and source quality; no dependencies, new lights or render passes.

## Design contract

- Refine existing bridge stone construction: deeper segmented voussoirs, stepped/rebated moulding, tapered keystone, discreet quoins/pier relief and better coping/material hierarchy. London uses cooler mineral stone, Glasgow warmer sandstone. Materials remain shared; details merge into existing buckets.
- Fix merged-masonry material assumptions: bridge vertices use metric coordinates, so the inherited unit-box edge effect is inappropriate. Use bounded, derivative-filtered stone joints and relief rather than noise or dark outlines.
- Preserve both 7.5 m decks, arch aperture, widths, parapet alignment, bank profiles/28 m exits, routes, livery swaps, traffic, pedestrian/boat clearances and existing lamps/pools. No new river piers.
- Tower Bridge: replace blind dark carriageway panels with open, continuous stone barrel-vault passages through both main towers and shore towers. Preserve silhouettes, anchors, four existing shared material primitives and both existing LODs. Update authoring source and regenerate its direct GLBs; no runtime illusion or billboard.
- Sé: a recessed two-leaf oak door with raised panels, meeting stiles, bronze pulls/kick plates and a restrained upper fan pattern. Keep existing Gothic reveal, steps and opening. Bake finish into the existing single atlas; keep runtime on existing LOD0, KTX2/Meshopt, same three maps and one material. No added light.

## Implementation and verification

1. Capture current bridges and portal close-ups, preserve source/asset snapshots and add failing regressions.
2. Bridge slice in underpass.js with a focused geometry/shader/disposal regression; keep existing river-bridge/underpass tests unchanged.
3. Update both landmark authoring sources and regenerate existing assets with installed Blender/toolchain. Bump cache versions. Raycasts must pass through Tower Bridge portals at both LODs; Sé must contain real door relief and preserve atlas/material/envelope contracts.
4. Inspect matched before/after close-ups and live day/night/rain views; check375px/reduced motion where relevant, no console/shader/WebGL errors. Measure added geometry/material/asset cost; avoid repeating the unrelated full performance study.
5. Run focused browser suites, full Node regression at the milestone, independent review, update current docs/audit. No push/deployment.

Primary owns design, landmark authoring, asset generation, integration and final verification. Independent bridge implementation owns only underpass.js and bridge-finish.browser.py; shared browser remains with primary.

## Completion ledger

All five steps completed. Red/green browser regressions, unchanged bridge guards, regenerated asset/fallback contracts, day/night close-ups, 375px rain/reduced-motion capture, 240 Node tests and independent integration review are recorded in the [delivery audit](../../audits/2026-11-12-bridges-landmark-portals.md). Initial arch segmentation exceeded the existing 3k underpass guard; reduced to 16 segments without changing that guard. Night inspection prompted a second, brighter oak atlas bake. Scoped visual/functional GO; no new FPS claim, physical-device validation or deployment.
