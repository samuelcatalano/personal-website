# Procedural urban road network

**Goal:** connect the existing four-region infill with legible streets, sidewalks and property access, retaining the city and transit routes.

**Authorization:** owner task supplied 2026-11-15 explicitly requests autonomous implementation, Luna executors, Desktop-only validation and no automatic commits. This supersedes approval pauses in generic workflow skills. No dependency, map rebuild, landmark movement or vehicle-route change.

## Audit and architectural decision

`city.js` emits the actual lot descriptors; `scene.js` collects architecture/building plots, trees, public-realm reservations and box geometry. Recent additions in `urban-infill.js` explain the isolated rows visible in the supplied aerial. Existing road/bridge geometry and route remain the backbone. Several inter-property gaps cannot fit a two-way street plus sidewalks.

Use a pure footprint-aware planner (`urban-roads.js`) after city and landmark generation, before street-prop placement. Generate shared neighborhood corridors from groups of lots, protect buildings/trees/public spaces/water/bridge approaches, resolve intersections as a union, and connect only reachable corridors to existing streets. Tight frontages use pedestrian access. Inputs remain the source of truth; no manual road per property. Existing `buildCity` descriptors and RNG sequence remain untouched.

Alternatives considered: rebuilding lots around a new road grid would disrupt the scene; painting all empty space would lose urban hierarchy. The selected adaptive corridor approach fits the existing map. Shared regional parameters retain coherent dimensions while allowing different block spacing.

Render flat surfaces in spatial chunks using existing asphalt/paving materials, no cast shadows, no frame-time reconstruction. A QA-only off switch supports paired comparison. Graph connectivity and coverage must be reported honestly; geometry alone is insufficient evidence of access.

## Ordered delivery

- [x] Audit source data, existing road/batching contracts and protected spaces (Luna audit; primary architectural decision).
- [x] Capture a fresh Desktop route baseline before implementation (1440×900, DPR1, high, clear, stops 0–17, 12s).
- [x] Save matched aerial baseline across four regions (`/tmp/urban-roads-before/`, 1600×1000/DPR1; 1,431 retained architecture lots, no JS/shader/GL errors).
- [x] Luna planner: deterministic network, collision checks, graph, union surfaces and focused Node tests, including moved lots.
- [x] Luna integration: existing-road anchors/protection, chunked rendering, prop integration, disposal and QA diagnostics. Files are disjoint from planner.
- [x] Primary review: pilot São Paulo topology/collisions/visuals before accepting expansion.
- [x] Primary final validation: four-region Desktop day/night evidence, full Node suite at milestone, targeted browser guards and matched before/after profile.
- [x] Record counts, timing, coverage, images and limitations in a short audit; update current architecture/budget references.

## Implementation ledger

- Luna `layout_audit` delivered the deterministic planner and gap/anchoring/coverage tests. Primary corrected physical anchor coverage, raster fragment removal and region-independent topology; bounded component A* replaces the rejected per-candidate search.
- Luna `road_integration` delivered chunked two-material surfaces, ownership/disposal, source integration and the renderer fixture. Primary checked actual bridge/underpass mouths, exact backdrop descriptors and raised-deck strips. Lamps, kiosks and stop furniture remain physical blockers.
- Luna `property_access` delivered frontage inference, deterministic shared paths, provenance, bounded pedestrian BFS and 15 focused tests. No blocker or path width is relaxed to claim access.
- Luna `spatial_mask` delivered the indexed static collision query and brute-force equivalence test, then searched the final obstructed legacy pockets. Owner explicitly authorized broader pocket reorganization to complete all seven accesses while preserving buildings, landmarks and routes.
- Four density/backdrop collisions have exact approved deterministic source corrections. Seven additional approved lot offsets now pass the complete refreshed scene planner: 1,434/1,434 served, zero unresolved/collision/overlap/coverage/provenance violations. Target-only proofs were rejected where they obstructed previously served neighbours.
- Primary owns browser exclusively. Renderer fixture, actual curved-route infill, bridge-exit checks, EN/PT-BR WebGL-off fallback and real-world reduced-motion smoke passed. Full Node regression passes 297/297 after final pocket offsets and the monotone-grid-chain regression.
- Actual source snapshots and independent invariant checks cover all surfaces, physical/protected/lot/trunk bounds, coplanar overlap, graph anchoring, asphalt continuity and access provenance. Final acceptance passed: zero unresolved entries and zero violations on refreshed source.
- Task-local capture/profile scripts use cache/service-worker bypass, fixed Desktop viewport/DPR/tier, and the existing harness. Final four-region Desktop day/night captures passed with zero JS/shader/GL errors and all 1,431 architecture lots retained. Matched ABBA network-off/on route measurements show no frame-time regression in the sampled runs; interim pilots are not final evidence.

## Acceptance and review focus

Four regions must show connected urban blocks and plausible access without road/sidewalk intersections with buildings. Existing bridges/routes/landmarks must remain intact. Test real intersections rather than adjacent disconnected segments; preserve path and vegetation clearances; reject unanchored vehicle fragments; handle narrow gaps as pedestrian connections; verify that merged surfaces never overlap coplanarly. Report unreachable frontages rather than silently accepting them. Compare calls, submitted triangles, median/p95 frame time, available memory/resource counts and procedural generation time. Physical VRAM is unavailable unless measured by the browser.

## Baseline

Raw local evidence: `/tmp/urban-roads-before-profile.json`. First route sample: median 33.4ms, p95 66.8ms, 902 median draw calls, 25,000,298 median submitted triangles (all passes), JS heap 1,147→1,484MiB, peak 1,911MiB. A single moving-route sample is scheduling-sensitive and cannot establish an attributable regression by itself.
