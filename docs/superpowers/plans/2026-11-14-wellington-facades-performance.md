# Wellington, facade refinement and lossless performance

**Owner order:** P1 Wellington from internet image references; P2 further facade design; P0 performance only after both visual upgrades. No loss of quality or realism during P0.

**Boundary:** Preserve map, plot dimensions/heights, paths, routes, landmark placement, current building language and content/UI. No dependency, borrowed geometry/texture or mobile work. Quality settings, source geometry detail, populations, texture resolution, shadows, MSAA and render distances cannot be reduced for performance.

**Execution:** Primary owns scope, facade integration and performance. One independent Wellington author owns only its Blender script/GLBs/README; read-only performance reconnaissance has no write/browser access. No automatic commits/push.

- [x] P1: inspect real profile/front/three-quarter references; rebuild original three-material Wellington; compare five views and verify footprint/placement/loader lifecycle. Record sources and geometric cost.
- [x] P2: refine front-door panels/hardware/thresholds and glass-frame contact, within existing openings, buckets, regional palettes and envelopes. Add regression before production code; compare day/night views and actual runtime shaders.
- [x] Freeze the completed visual state as the P0 baseline. Capture matched fixed-quality runtime data.
- [x] P0: remove redundant static world-matrix work and apply verified lossless Meshopt delivery. Surface packing and recipe caches deferred: sufficient zero-detail-loss gains with a smaller runtime diff. No optimization stands without exact-data/visual equivalence and attributable measurements.
- [x] Run scoped browser gates, desktop EN/PT/fallback/reduced motion, full Node regression, final independent review and update current art/architecture/budget references with costs/limits.

## Ledger

- Start clean at `ef3f975`. Internet references: Art UK Wellington monument 254058; Exeter Cast in Stone item 3769; Discover Glasgow landmark page. Photographs are modeling references only.

- P1/P2 visual gate: Wellington three-renderable/lifecycle contract, physical entry/envelope/glazing regression, property-character kits and original construction finish passed. Statue quality budget explicitly revised from 18k to 100k for the authorized 90,838-triangle sculpt; no runtime quality reduction.
- Frozen visual baseline: `/tmp/wellington-facade-performance/visual-baseline/`. Offline lossless Meshopt candidate verified all decoded accessors/material/scene metadata: 2,780,048 → 1,636,452 bytes, no simplification/quantization/retexture. Existing tools/pipeline dependencies are installed; no npm/dependency installation.

- Matrix regression failed on the baseline, then passed with exact world-matrix equality, including a moving rig/bone and newly attached child. One ready-world sample: 16,527 nodes, 16,526 → 3,593 matrix multiplications (12,933 avoided, 78.3%). No renderer quality setting changed.

- Final validation: 264/264 Node; Wellington/entry/character/atlas fixtures; EN/PT fallback and PT reduced motion; six desktop city day/night views without JS/shader/GL errors; independent connected-code/decoded-asset review GO. One fixed-high route pair: median 17.5 → 18.6 ms, p95 33.3 → 33.4 ms; no general FPS gain claimed. See `docs/audits/2026-11-14-wellington-facades-performance.md`. No commit/push.
