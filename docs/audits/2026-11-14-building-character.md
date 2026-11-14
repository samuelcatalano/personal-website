# Property character and inhabited architecture — 2026-11-14

## Authorized boundary

Owner approved all seven proposed improvements: per-property identity, materials, grouped night occupancy, selective residential finish, shop identity, roof details and exposed blank-wall repairs. Applies through existing ordinary-building assembly, including procedural and authored-kit paths. Map, descriptors, footprints/heights, principal roof forms, approved townhouse language, routes, paths, landmarks, lighting rig and external assets remain unchanged. No dependency, new render pass, light or per-property material.

## Implementation

- `building-character.js` owns the existing FNV lot hash (re-exported by `lot-tint.js`), stable maintenance/door/frame/roof/display choices and occupancy groups. Position/chunk/kit changes do not reseed a property.
- `finishArchitecture` stamps normalized `Uint16` property metadata into each existing bucket, including LOD1. Four channels carry lot seed, wear, pane occupancy and usage. Ordinary wall weathering and glass roughness consume this identity; preserved landmark/public-realm shaders retain their original path. Regional frame/door tones and restrained value variation are baked once into vertex colours.
- Window occupancy is constant over each six-vertex pane. Homes and apartments group adjacent panes along their facade; offices share a floor state. Homes use warmer light and offices a more neutral tone. Existing room/parallax layers and night transition remain; no live random/time-driven changes or room lights.
- At most two front residential windows receive curtains/blinds. Existing door geometry gains stable painted finishes. Shops select books, folded goods or plants within their existing reveal and retain their existing entry/toldos structure.
- Existing flat roof support receives up to two low service finishes when clearance and envelope checks allow. Pitched roofs retain their main shape with varied course spacing and an optional cap on an existing chimney. No forced detail where support is unsuitable.
- Up to two repair patches are added only on substantial blank, exposed wall panels. Exposure uses original neighbour descriptors before spatial batching; shared walls are suppressed. No new openings and no patches across glazing.
- Kit glass belonging to canopies, railings, roof/crown elements and luminous signs retains its original emission role. CPU-only vertex ranges survive the lot merge and disable room-occupancy overrides on these surfaces; no extra GPU attribute is needed for this exclusion.

## Measured fixture comparison

Five matched house/shop/midrise/office/tower fixtures rendered before/after from the same recipe and camera. Baseline finish/material/shop/room modules came from `HEAD` (`b1c3874`); each version used its own cached materials. Current regional tint logic and unchanged source family generators were shared.

| Metric | Before | After |
|---|---:|---:|
| Total fixture triangles | 63,202 | 63,554 (+352 / 0.56%) |
| Draw calls per fixture | 3 | 3 |
| Geometry attribute buffers | 9,200,088 B | 10,777,608 B (+17.15%) |

The four-channel identity costs **8 bytes per vertex**. These are geometry/typed-buffer measurements, not physical VRAM or full-scene resident memory. Very short isolated render samples were near timer resolution and do not establish an FPS/performance win or regression. No texture resolution or material/pass count was raised.

[Day comparison](../evidence/building-character/day-comparison.jpg), [night comparison](../evidence/building-character/night-comparison.jpg), [three-city day/night views](../evidence/building-character/cities-day-night.jpg), [raw fixture metrics](../evidence/building-character/metrics.json). Construction timings include initial atlas preparation/cache warm-up and are not a matched steady-state CPU benchmark.

## Validation and review

- Full Node regression: **264 passed**, zero failures/skips, including preload integrity and five new deterministic identity/group/exposure tests.
- `building-character.browser.py`: near/far identity, packed attributes, constant pane occupancy, idempotence, detail bounds/budgets, shared-wall exclusion and real GLB canopy/railing/lightbox roles.
- `ordinary-finish.browser.py`: unchanged preserved atlas hashes, 1024px ordinary / 512px preserved atlases, geometry/rooms, asynchronous townhouse replacement, disposal and WebGL compilation passed.
- `architecture-archetypes.browser.py`: all 24 existing profiles and four regions passed. `styled-facades.browser.py` passed actual material rendering.
- Independent final source review found one issue: external kit glass could inherit room emission. Actual canopy/railing/lightbox regression failed before the exclusion and passed afterwards. Primary additionally corrected facade-tangent room grouping with a failing-then-passing pure regression.
- Final-source six-view city matrix (São Paulo/London/Glasgow, day/night, clear weather): zero captured errors, failed programs or WebGL errors; 739 unchanged lot descriptors. [Raw capture probes](../evidence/building-character/city-final.log).
- Final browser gate passed character/real-kit exclusions, original construction finish, styled material rendering and all 24 profiles. EN/PT WebGL-disabled startup and PT WebGL/reduced-motion startup passed with populated content and empty error arrays. [Browser output](../evidence/building-character/browser-final.log), [Node output](../evidence/building-character/node-final.log). `git diff --check` passed.

**Scoped visual/functional GO; no performance or global production-readiness GO.** No mobile or Lighthouse validation, rain matrix, new citywide frame-time benchmark, commit, push or deployment. Coherent far identity remains, while small near-only detail follows existing LOD policy. Captures/metrics are local evidence, not photographic-equivalence claims.
