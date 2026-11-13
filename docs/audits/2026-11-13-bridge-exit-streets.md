# Bridge exits: streets behind the blocks

The owner selected curved streets after reviewing the masonry-portal preview, then requested the same treatment at Ponte Estaiada. The trial portals and their repository artifacts were removed. Desktop only; mobile explicitly excluded. After review, the owner requested committing all pending site refinements; no push requested.

## Delivered behavior

London and Glasgow far-bank roads now continue through the rear blocks, turn behind them and extend beyond the traffic recycling point. Their geometry, lane offsets, steering and night headlight projection share a centerline. Cars reset while hidden at the far end; the original camera-side endpoint remains off the normal route view. Reduced-motion traffic stays still.

Estaiada uses the same street builder, a São Paulo yellow centre line and shared road/paint materials. Its original 65 deck stations are byte-for-byte identical to HEAD; pylon, stays, slab profile and avenue junction are unchanged. `trafficStations` prepends 64 street samples to the existing 65 bridge stations. Ambient entry/exit paths use these samples while retaining original yielding, avenue merging and distant respawn logic. Street geometry is generated once by the deck assembly; the ambient route creates curves/stations only.

Surveyed source-data adjustments preserve IDs, dimensions, heights, building counts and RNG order:

| Lot | Change in world x |
| --- | ---: |
| `country-infill-0-0`, `country-infill-0-1` | 291.8672 → 264.8 |
| `block--43--93` | −1.9 m |
| `block--24--93` | −5.8 m |
| `rear--20` | −1.6 m |
| `rear--5` | +1.9 m |

These are implementation choices to open the requested street corridors. Glasgow needs no lot move. All other lot/prop/tree selection remains at its baseline. The linear Node fixture has different front-row IDs: it normalizes the four approved IDs present there and retains the original hashes. The real-curve browser test separately checks all four Estaiada moves and their neighbours.

Main implementation: `bridge-exits.js` owns surveyed control points/lot shifts and loop distances; `bridge-street.js` builds curves and merged road/kerb/pavement strips; `underpass.js`, `underpass-traffic.js`, `landmark-geometry.js` and `ambient.js` assemble/use them. `blocks.js` and `country.js` apply the explicit source-centre shifts. Both new modules are in the modulepreload closure.

## Cost and invariants

- UK bridge geometry: 7,540 triangles each → 8,988 London / 9,052 Glasgow (+2,960 combined).
- Estaiada asphalt/paint geometry: 640 → 2,360 triangles (+1,720).
- Total added geometry: 4,680 triangles across the three street continuations.
- UK bridge buckets remain seven per crossing; Estaiada asphalt/paint remain two meshes/materials. Original landmark geometry buckets and bridge light instances remain unchanged.
- No new dependency, texture asset, dynamic light or rendering pass. No worker, global renderer or framework change.

These are geometry/resource counts, not measured frame-time/loading results.

## Validation and limits

- Full Node regression: **244 passed**, no failures/skips. Syntax and diff-whitespace checks passed.
- UK street browser test: both joins/tangents, rear-lot paving clearance with 0.2 m allowance, both directions, **18 invisible wrap events**, turning/contact checks, hidden headlights and reduced-motion positions. Loaded car maximum half-length: 2.465 m.
- Estaiada browser test: original 65 stations, 129 traffic stations, two deck meshes, four exact lot adjustments, **753 paving clearance samples**, conservative full-body corner sweeps in both lanes and real GL render. Its four fleet models fit the tested 2.6 m half-length / 1.15 m half-width / 2.8 m height envelope; longest catalog model: 4.93 m.
- Actual scene at 1440×900: all three road corridors sampled against actual lot descriptors, with 0.2 m allowance: **zero overlap samples**. Day/night inspection captures cover London, Glasgow and Estaiada. No observed console errors; WebGL `getError() = 0`.
- Normal route-camera checks at three progress positions per bridge cast **288 conservative vehicle-envelope corner rays** against actual architecture geometry; zero misses at the last visible/endpoint samples. Some samples are already outside the viewport. This does not establish hiding for arbitrary low/free-camera views.
- Existing river-bridge, bridge-finish and underpass browser suites passed: bus/boat clearance, original road/deck profile, 32 heritage lamps, zero dynamic lights, shared shaders/materials, pedestrian directions and idempotent resource disposal retained.
- The broad legacy landmark-geometry suite fails on Wembley: expected height ≤21.05 m, actual 28.5601 m. A direct HEAD/current comparison gives identical bounds and reproduces the inherited mismatch. No threshold was weakened; Wembley was not changed.
- Independent scoped source reviews approved both the UK streets and Estaiada extension, with no actionable findings. Reviewer ran 34 focused Node tests and whitespace checks, without browser interaction.

Evidence: [Estaiada day](../evidence/bridge-exit-streets/estaiada-day.jpg), [night](../evidence/bridge-exit-streets/estaiada-night.jpg), [UK comparison](../evidence/bridge-exit-streets/uk-streets-day.jpg), [street traffic](../evidence/bridge-exit-streets/street-traffic.log), [Estaiada geometry](../evidence/bridge-exit-streets/estaiada-geometry.log), [scene/occlusion](../evidence/bridge-exit-streets/live-scene.log), [existing suites](../evidence/bridge-exit-streets/existing-suites.log), [HEAD comparison](../evidence/bridge-exit-streets/head-comparison.log), [Node summary](../evidence/bridge-exit-streets/node-summary.log). Inspection images render the actual scene directly from fixed cameras and bypass postprocessing.

Desktop visual GO for review; no global production-readiness declaration. Mobile, Lighthouse and performance benchmarks were not run. Existing loading-ticket and default-theme work was preserved and is included in the owner-requested commit.
