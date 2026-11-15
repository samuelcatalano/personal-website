# Urban road network — 2026-11-15

## Scope and implementation

Owner requested a procedural network across São Paulo, London/transition, Glasgow and the return region, with autonomous phased execution, Luna implementers, Desktop-only checks and no automatic commits. Existing transit routes, landmark locations, building identities/dimensions/heights and planting centres remain authoritative.

`urban-roads.js` plans from actual lot footprints before rendering. Local row/column gaps and neighbourhood perimeters supply shared corridors; deterministic selection, short connectors and bounded A* join them to existing asphalt. Existing bridge curves and low approach mouths supply additional anchors. Region labels do not form artificial topology barriers. The rendered network excludes unanchored fragments after raster clipping; rejected candidates are not rendered disconnected streets.

The existing 13.1m avenue and 4.6m western streets retain their geometry. New local carriageways use the existing bridge's 3m lane scale within a nominal 4.5m paved envelope. Tight mews retain a one-sided walking strip. The metre-grid union gives intersections one surface, followed by rectangle packing; it is an intentional city-view simplification, not street-level kerb modelling.

`building-access.js` connects inferred frontages to streets and already street-rooted paths, with deterministic side-frontage alternatives, explicit-frontage preservation and `viaLotId` provenance. Short branches use direct rectilinear routes; bounded pedestrian grid routing handles obstructed courtyards. Both shared-path and grid stages grow in stable monotone passes, so a newly street-rooted grid branch can serve a neighbour in the next pass without circular provenance. Physical buildings, plants, furniture, tree roots and water remain blockers. Road reservations for parks/landmark setbacks stay separate from pedestrian physical-clearance masks. Tree centres remain fixed; ground paths may pass under elevated crowns while clearing a 0.6m trunk/root radius.

Scene input includes ordinary/legacy lots, exact landmark-background plot descriptors, backdrop boxes, planted props, lamps, kiosks and stop furniture. Batched building bounds and the swept Estaiada road's aggregate bounding box are not treated as solid landmarks: individual footprints and raised-deck strips protect their actual occupied space.

`spatial-mask.js` indexes static collision rectangles. `urban-road-mesh.js` merges flat surfaces by material and 160m chunk, with explicit bounds, two materials using the existing procedural texture/shader pipeline, receive-only shadows and idempotent ownership/disposal. Planning and geometry creation run once; no new per-frame network work, vehicle route or traffic simulation is introduced. Synthetic coverage prevents grass and later street props from occupying the new paving.

QA-only controls: `?qa=1&urbanroads=off` is the comparison control; `urbanroads=pilot` selects São Paulo road planning. `__qaUrbanRoadInputs` and `__qaUrbanRoads` expose source masks, graph, coverage and generation timings without adding product controls or copy.

## Four necessary position corrections

These legacy density volumes intersected the pre-existing backdrop. The owner explicitly allowed small deterministic adjustments needed for access/collision. The selected positions retain IDs, sizes, heights, families and RNG draws; each has a collision-free 0.3m footprint margin and a 0.9×1.2m frontage apron. Coordinates are world metres; London/Glasgow source records retain their existing legacy-to-world transform.

| Plot | Previous (x, z) | Current (x, z) | Movement |
|---|---|---|---:|
| `paulista-density-midrise` | −289, −127 | −287, −133.5 | 6.801m |
| `paulista-density-terrace-1-0` | −85, −127 | −84.5, −134.5 | 7.517m |
| `london-density-house-0` | 79, −127 | 77, −134 | 7.280m |
| `glasgow-density-tenement` | 514, −127 | 513, −134.5 | 7.566m |

The existing preservation test normalizes only these four positions and the six previously approved bridge moves back to its original baseline. Original lot/tree/prop hashes remain asserted; the new positions and backdrop clearance have their own assertions.

## Files

- Planning/collision/access: `js/world/urban-roads.js`, `js/world/spatial-mask.js`, `js/world/building-access.js`.
- Integration/rendering: `js/world/scene.js`, `js/world/urban-road-mesh.js`, additive `backgroundPlots` return in `js/world/landmarks.js`, four records in `js/world/blocks.js`, descriptor offsets in `js/world/layout-data.js` applied at the `buildCity` callback boundary, and `index.html` preload tags.
- Regression contracts: `tests/urban-roads.test.mjs`, `tests/building-access.test.mjs`, `tests/spatial-mask.test.mjs`, `tests/urban-roads.browser.py`, and the preserved baseline assertions in `tests/urban-infill.test.mjs`.
- [Implementation plan and ledger](../superpowers/plans/2026-11-15-urban-road-network.md).

## Final pocket reorganization

The owner explicitly authorized reorganization beyond one lot, including movable furniture if necessary, to finish seven pre-existing blocked accesses while preserving all buildings, landmarks and routes. The implementation retains all furniture positions and moves only the seven named lot descriptors. The attached terrace pair remains rigid, retaining its shared wall.

Candidate placement preserves plot family/region, building dimensions/heights, a 0.3m outer margin (except the intentional internal shared wall), tree-crown clearance, actual props/backdrop, public reservations, existing and generated paving, pedestrian path rectangles and main-avenue pavements. Existing infill retains its 1.5m margin. Wembley sightline and closing-region guards remain protected. Exact poses are checked on the actual curved route; the older straight-curve Node fixture uses its original route-dependent occupancy for its preservation hash/overlap checks.

The primary rejected target-only access proofs when a proposed move blocked a previously served neighbour. Acceptance uses the full refreshed scene and full planner, including physical asphalt connectivity and access provenance.

| Plot | Previous (x, z) | Current (x, z) | Movement |
|---|---|---|---:|
| `block-713--43-3` | 773.627, -43.091 | 775.627, -50.091 | 7.280m |
| `block-713--43-4` | 779.627, -43.091 | 781.627, -50.091 | 7.280m |
| `block-746--47` | 794.168, -46.824 | 809.168, 8.176 | 57.009m |
| `frontage-gap-glasgow-585--1-0` | 625.000, -4.620 | 615.500, -13.120 | 12.748m |
| `gap-47--98-0` | 84.000, -97.528 | 96.500, -97.528 | 12.500m |
| `wembley-side--34--64` | 801.000, -64.000 | 794.500, -54.500 | 11.511m |
| `wembley-side--48--68` | 787.000, -68.000 | 755.500, -91.500 | 39.300m |

## Final source invariants

The refreshed actual scene contains 1,431 rendered architecture descriptors and 1,434 unique planner footprint records (the latter includes three legacy compatibility markers). All 1,434 access records are served; none remain unresolved. No building was removed, resized or retyped.

| Independent check | Result |
|---|---:|
| Surface collisions against lots, physical objects, tree roots and applicable reservations | 0 |
| Coplanar surface overlaps | 0 |
| Graph edges without continuous new/existing asphalt coverage | 0 |
| Unanchored graph components | 0 |
| Unanchored physical asphalt components | 0 |
| Access paths with broken/cyclic street-root provenance | 0 |
| Merged coverage rectangles | 3,250 |
| Graph nodes / edges | 421 / 456 |
| Rendered road meshes / materials | 22 / 2 |
| New local source segments / connectors | 115 / 71 |

The graph has 13 components and the raster 8 physical asphalt components; all meet the pre-existing backbone. These are not independent isolated streets. Road rectangle counts by region are São Paulo 115, London 67, Glasgow 89 and return 95; they are packed surface pieces, not a count of named streets.

A clean live source refresh measured 1,597.3ms planner time plus 7.9ms mesh creation; the independent Node run measured 1,488.4ms for the same final inputs. Generation is once per world creation and is separate from route frame timing.

## Repeated Desktop comparison

Final source, clear/day, 1440×900, DPR1, high tier, route stops 0–17 over 12 seconds/300 scroll positions. Each fresh page bypasses HTTP cache/service workers and waits for world/intro readiness before the same scripted route. Order is OFF → ON → ON → OFF; no concurrent agent searches or CPU benchmarks ran during these samples.

| Metric | OFF 1 | ON 1 | ON 2 | OFF 2 |
|---|---:|---:|---:|---:|
| Median frame time | 26.8ms | 25.3ms | 26.1ms | 26.6ms |
| p95 frame time | 67.5ms | 66.0ms | 66.6ms | 66.6ms |
| Median submitted draw calls | 882 | 891 | 891 | 870 |
| Median submitted triangles, all passes | 24,368,494 | 24,262,186 | 24,068,007 | 24,479,696 |
| Geometries at route end | 1,149 | 1,173 | 1,179 | 1,148 |
| Textures at route end | 321 | 324 | 324 | 322 |
| Scene materials at route end | 979 | 981 | 981 | 979 |
| Peak JS heap | 2,031MiB | 1,978MiB | 1,978MiB | 1,979MiB |

No frame-time regression is visible in these samples. This does not establish a speedup: frame scheduling, grass/prop suppression, lazy cell residency and garbage collection vary. Draw calls increase modestly; the two materials are the fixed addition, while end-of-route geometry/texture counts are resource snapshots. Submitted triangles include shadow/post passes and are not unique scene triangles. JS heap is not physical VRAM, which was not measured.

Planner timings in the ON profiles were 1,188.5ms and 1,225.4ms; mesh creation was 5.4ms and 5.5ms. The earlier clean source-refresh timing remains useful as a colder sample rather than an interchangeable route metric.

## Validation and evidence

- Full Node milestone regression: **297/297 passed**, including preload closure, original lot/tree/prop hashes, all seven immutable offsets and the regression that fails with the old one-pass pedestrian grid target index.
- Fresh real-browser fixtures passed: merged surfaces/bounds/resource disposal; actual curved-route lot poses and preserved dimensions; all 719 surveyed infill envelopes/material/chunk contracts; both bridge exit/traffic guards.
- Four-region Desktop day and night: all 1,431 architecture lots retained, 22 road meshes, zero captured JS/rejection errors, zero failed shader programs and WebGL error 0. The aerial camera/fog override exists only in the capture tab; production camera/fog are unchanged.
- WebGL-disabled content smoke passed in EN and PT-BR, with content and 12 links available. Final-source reduced-motion world smoke passed after profiling: world ready, 1,434 accesses, zero unresolved, 12 links and no JS/WebGL error.

Durable evidence is stored at `/Users/samuel.catalano/.codex/visualizations/2026/11/15/01a1e064-4daf-7542-9795-7c363d5eba65/urban-roads/`: matched before/day/night images, contact sheets, raw profile samples, source inputs, independent invariant results and exact approved moves. The image order is São Paulo, London, Glasgow, final region; comparison sheets show before on the left and after on the right.

Desktop functional/visual verdict: **GO**. No automatic commit or push. Mobile/emulation, Lighthouse and a new weather matrix were not run for this Desktop-only geometry change. The metre-grid paving/one-sided tight mews remain an explicit city-camera limit; no new vehicle routes or physical VRAM claim is included.

The new surfaces contain 6,972 unique triangles and 488,040 bytes (0.465MiB) of geometry attributes/index buffers; this CPU buffer footprint is not a physical VRAM measurement. A separate indexed-versus-brute collision diagnostic produced byte-for-byte identical planner output (3,250 rectangles): indexed 1,475.8/1,447.3ms, brute 8,319.6ms. This isolates static mask lookup cost and does not imply an FPS gain.

## Follow-up — existing avenue paving overlap

Owner close-up screenshots exposed raised pavement strips crossing the existing central avenue. The earlier collision checks protected buildings/props/public reservations but did not treat existing asphalt as an exclusion for new sidewalk/access surfaces. The planner now indexes the existing road-anchor footprints and rejects any non-asphalt raster cell intersecting them, while retaining asphalt junction links and the original street-rooted access graph.

A focused regression fails before the fix and passes after it. On the actual scene snapshot, non-asphalt packed rectangles overlapping existing anchor asphalt fall from 195 to zero. All 1,434 accesses remain served, with zero unresolved/collision/overlap/broken edge/unanchored component/provenance violations. Coverage is now 77,175 cells / 3,208 rectangles; the graph remains 421 nodes / 456 edges. The earlier profile tables describe the pre-follow-up surface count; no route benchmark was repeated for this small removal-only correction.

Follow-up validation: 24/24 directly related planner/access tests pass. Desktop London/Glasgow avenue close-ups show uninterrupted asphalt; both captures report zero JS errors, failed shaders and GL errors. Evidence: the durable `urban-roads/asphalt-fix/` directory. `git diff --check` passes.
