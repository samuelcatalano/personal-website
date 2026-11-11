# Streetscape refinement — 2026-11-10

Scope: owner requested all seven suggestions in [the plan](../plans/2026-11-10-streetscape-polish.md). No commit or push. Previous NPC work remains in the working tree.

## Delivered

- Existing paving (`textures.js`): metric anti-aliased joints, restrained per-slab variation, 16–22 cm perimeter bands and soft dirt at slab edges. Detail fades at 65–145 m. No overlay geometry or paving-layout change.
- Regional identity: SP concrete tones and restrained checker accents on perimeter bands; staggered London slabs; cooler/wider Scottish stone. Boundaries derive from current route data, blending across 36–40 m. Large ground skirts receive no artificial perimeter bands.
- Existing commercial family (`shop-slice.js`): selected recessed storefronts gain two shelves and small display pieces; recessed entry thresholds. Selected existing shop panes use the current lit-glass surface. Same mass/trim/glass buckets and original lot footprints.
- Existing cafes (`street-props-mesh.js`): two small cups and a low planted pot, inside the existing 1.7 × 1 m placement footprint. Chair centres/backrests moved inward by 1 cm to respect that original envelope. No new props are placed in pedestrian paths.
- Night hierarchy: 10 stable selected shop fronts get soft warm light spill; nearby existing lamp pools retain their strength, other pools use 78% strength. Existing shelter advertisements become softer warm white, while amber crossing beacons are unchanged. Spill adjusts opacity on wet ground, is hidden by day and adds one instanced draw at night, without dynamic lights or new passes.
- Authored foliage and awnings share the scene clock/gust envelope. Foliage displacement is below 5 cm; awning displacement is about 1 cm. Procedural and authored-kit facade merges retain movement weights, including lazy townhouse-kit rebuilds. Reduced motion freezes the clock. Existing tree LOD/culling thresholds remain; bounds get 6 cm of conservative padding. Foliage shadows retain static depth geometry at this displacement scale.

Core files: `streetscape-state.js`, `shop-spill.js`, `textures.js`, `shop-slice.js`, `building-slice-materials.js`, `city-rollout.js`, `facade-kit.js`, `kit-place.js`, `authored-trees.js`, `street-props-mesh.js`, `lamps.js`, and scene integration/preloads. No dependency, external asset, UI string or route/lot/camera data added.

## Verification

- `node --test tests/`: **224 passed, 0 failed**.
- `tests/streetscape.browser.py`: passed in real Chrome. Mixed commercial/residential chunk merges retain awning weights (36 moving / 11,748 static vertices in the fixture); new cafe detail stays within its footprint; real authored trees share the clock; all fixture shaders compile/render without console/WebGL errors; day/night/wet spill and disposal checked. The same fixture also upgrades its shop and midrise from the existing authored GLB kits, retains matching movement attributes and renders in 10 draw calls / 12,420 submitted triangles.
- `tests/authored-trees.browser.py`: passed, 200 trees / 10 chunks, original placement/footprint/LOD/impostor checks.
- Desktop normal-camera captures: opening/day, SP/day, London/night, Glasgow/day; no recorded JS errors, unhandled rejections or console errors. [SP](../evidence/streetscape/5-day.jpg), [London](../evidence/streetscape/9.5-night.jpg), [Glasgow](../evidence/streetscape/11-day.jpg), [opening](../evidence/streetscape/0-day.jpg). Compared against the initial state; comparison sheets show **before on the left, after on the right**.

- Mobile 375 × 812: SP/day and London/night visually inspected, no recorded console/JS errors. [SP mobile](../evidence/streetscape/5-day-m.jpg), [London mobile](../evidence/streetscape/9.5-night-m.jpg).
- WebGL-disabled EN/PT content smoke: passed; English and Portuguese render in the HTML panel. The full interface scroll-preservation suite still fails as described below.
- Reduced-motion browser smoke: ready scene and shared wind clock stays at 0 over a 500 ms observation.

## Existing failing browser checks — confirmed against baseline

These four checks also fail with the saved pre-change modules served from a separate local origin. They were not weakened or bypassed in the repository:

- `tests/shop-slice.browser.py`: `source footprint/height`. Existing rooftop pieces on retained hero shops reach 10.20/10.55 m against the declared 9.7 m lot height. This pass does not add or change rooftop pieces.
- `tests/citywide.browser.py`: the same source-envelope assertion fails in the baseline as well.
- `tests/interface.browser.py`: `Language rendering changed page scroll`, with WebGL disabled; reproduced in the baseline. No interface/content module is changed here. The full interface suite is therefore not reported as passing.
- `tests/street-props.browser.py`: existing shelter placements fail the lane/road clearance assertion, including the same locations near x=-234.15, -202.8 and -171.23. Placement data/algorithm are unchanged by this pass.

## Performance evidence and limits

[Raw four-run A/B](../evidence/streetscape/perf.json), order baseline/after/after/baseline; 120 RAF intervals each, London/night, clear weather, high tier pinned, 1728 × 963. Baseline overrides are identified by [hashes](../evidence/streetscape/baseline-sha256.json); they preserve the previous uncommitted NPC work. The comparison measures the whole live scene, including existing asynchronous kits and moving actors.

| Run | Median ms | p95 ms | Median draw calls | Submitted triangles |
|---|---:|---:|---:|---:|
| Baseline 1 | 33.3 | 35.6 | 1,832 | 10,620,509 |
| After 1 | 33.3 | 37.6 | 1,833 | 10,712,865 |
| After 2 | 24.5 | 33.3 | 953 | 6,911,580 |
| Baseline 2 | 33.3 | 34.3 | 1,832 | 10,575,452 |

**Frame-time A/B is inconclusive:** the second after-run rendered a materially different workload. Do not interpret its faster median as an optimisation. The first pair differs by one median draw, but is insufficient for a universal FPS conclusion. New awning-weight buffers occupy approximately 10.1–10.7 MiB across resident geometry/LODs in these samples. No extra texture downloads, dynamic lights or shadow-map passes are introduced.

No physical-phone or Lighthouse measurement. No release-wide GO: the four confirmed pre-existing browser failures remain open. Scoped visual acceptance still belongs to the owner.
