# Bridge masonry and night finish

Owner requested all six proposed visual refinements on both arch/river bridges, including review and improvement of the far-bank ramps. Continues the uncommitted bridge work; other pre-existing changes remain intact.

## Changes

- Walls: shallow pilasters on land approaches, stone coursing with anti-aliased joints and restrained per-block tint. Low dampness remains confined to the base.
- Materials: warm subdued masonry, lighter arch surrounds/coping, neutral paving and existing asphalt. Material resources remain shared between crossings.
- Arches: radial voussoir joints, a raised crown stone and small foot details. The opening and approximately 5.9 m bus-lane clearance are unchanged.
- Deck: continuous shallow cornice under the parapets. Existing cap planes at ±3.65 m and all prior alignment corrections remain intact.
- Margins: discreet base courses along land retaining walls. No piers or extra base geometry in the navigable channel.
- Night: reused `createLampPools` for elevated, restrained warm patches on the level road, with the same night factor as the existing lanterns. Explicit elevation and optional exclusion of registered city lamps preserve ordinary street callers. No new dynamic lights or render pass; one added instanced pool mesh for both bridges.
- Far-bank exit: 14 m becomes 28 m; the existing eased profile's peak grade falls from 0.714 to 0.357 m/m. The level 7.5 m span remains unchanged. Existing clearance filters and traffic consume the extended `RIVER_RUN` automatically; anchors and livery swaps remain unchanged.

Files: `js/world/underpass.js`, `js/world/underwater-profile.js`, `js/world/lamps.js`, `tests/underwater-profile.test.mjs`, `tests/river-bridge.browser.py`, and current architecture/art-direction notes.

## Verification

- New exit-grade regression failed before changing the 14 m exit; it passes with 28 m.
- Full `node --test tests/`: **232 passed**, zero failures. Existing Node module-type warning remains.
- Browser bridge regression: both bridges, 32 low lamps, zero dynamic lights. Checks actual deck/extended-exit meshes, both lateral walls, cap alignment across the joins, bus/boat clearance, lamp elevation and night emission, and elevated pool placement/day-night toggling.
- Desktop captures inspected: `10.54:day`, `10.54:night`, `11.48:day`, `11.48:night`, clear weather, 1728×907 CSS. Mobile emulation: `10.54:day` and `10.54:night`, 375×812, DPR 2. These are scene captures with the HTML interface hidden.
- QA plot survey: zero remaining architecture-lot footprint overlaps with either extended far-bank exit. This checks registered building plots, not a complete collision audit of all street furniture.
- Explicit shader compilation probe: zero failed programs; WebGL error code 0; no error-level Log or Runtime exception events returned during the probe.
- `git diff --check`: passed.

Visual evidence is retained locally under `/Users/samuel.catalano/.codex/visualizations/2026/11/11/01a1cbac-eeff-7523-9867-01876cdad409/bridge-finish/` (desktop/mobile captures, plus preceding day views for comparison).

## Limits

No paired GPU/frame-time benchmark, physical mobile test, full product matrix or fresh exhaustive livery-swap sweep. The aperture, swap triggers and hero route were not edited in this pass. The exit profile is an art-directed improvement, not a civil-engineering design. Emission/halos and additive road patches approximate lamp illumination; they do not cast dynamic light or new shadows. No external assets, dependencies, commit, push or deployment.
