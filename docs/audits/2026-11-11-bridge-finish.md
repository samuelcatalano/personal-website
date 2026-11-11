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

## Owner follow-up on proportions and integration

The owner authorised all six subsequent proposals. Parapet nominal height is now 0.86 m (previously 1 m), wall thickness 0.24 m (0.30 m), and cap thickness/overhang 0.06/0.025 m (0.08/0.05 m). Arch and river segments use these same measures, including lamp bases. At the ground-level exit, the last four metres ease the wall down to 0.20 m and close the end face; protection remains full-height over the elevated span.

The river slab is 0.65 m thick instead of 0.40 m, giving its edge a more convincing structural depth. With asphalt at 7.62 m, its underside is 6.97 m; the existing 2.78 m boat-top envelope leaves **4.19 m** calculated clearance. This supersedes the earlier 4.44 m measurement. The arch aperture and livery-swap anchors are unchanged.

Four-metre masonry shoulders connect the wide arch body to the narrower retaining walls, outside the lower road/pedestrian aperture. Material noise contrast is reduced and its frequency lowered; block joints remain legible. Shared masonry materials use per-vertex tints: London slightly cooler/neutral, Glasgow subtly warmer, without cloned regional materials.

Validation: **233 Node tests passed**; new terminal-height test reproduced the missing behaviour before implementation. Browser regression passed for both bridges, checking updated cap alignment, shoulders, road/exit geometry, clearances, shared materials/regional tints, lamps and spill. Desktop day/night captures at both bridge stops were inspected; an additional close-up checked the shoulder and parapet. Shader probe: zero failed programs, WebGL error 0, no error-level events returned. Mobile 375 px scene capture checked at stop 10.54 in daylight. No new dynamic lights, render passes, dependencies or external assets. No new performance benchmark, physical-device check or exhaustive swap sweep.

Current evidence: `/Users/samuel.catalano/.codex/visualizations/2026/11/11/01a1cbac-eeff-7523-9867-01876cdad409/bridge-proportions/`.
