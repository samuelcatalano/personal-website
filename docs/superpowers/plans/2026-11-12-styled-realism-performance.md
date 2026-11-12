# Styled realism and bounded city delivery

Owner request: improve the existing ordinary buildings, then make loading substantially faster. Owner chose **stylized realism with livelier colours**. Existing map, lots, roof forms, routes, landmarks, weather and accessible content remain intact. Preserve all previous working-tree work. No dependencies, framework, build step or deployment.

## Design and implementation contract

1. Use the existing regional facade palette; give painted walls clearer chroma, clean mineral trim and charcoal/bronze commercial metal. Improve pane response and material roughness without another render pass or per-building material. Validate real-family close-ups and live route day/night/rain, retaining landmark material isolation.
2. Measure cold startup and first rendered frame, long tasks and unique architecture buffers. Fix the existing profiler's premature frame-zero assertion before comparing identical runs.
3. Keep all distant buildings visible from the first frame, but construct their light representation without near construction profiles. Generate full near cells on demand, nearest first, at most one cell per update, retaining current hysteresis and bounded eviction. Register authored-kit factories instead of eagerly rebuilding the whole city. Preserve geometry, rooms and quality near the camera, including mixed cells and failed-kit fallback.
4. Run independent startup imports/downloads concurrently with complete error/disposal handling. Use the pinned Meshopt decoder's native worker support with bounded concurrency and synchronous fallback; KTX2 already owns its worker pool. Move procedural atlas preparation to a small module worker only if its measured cost warrants that extra boundary.
5. Integrate, review diffs and run focused geometry/kit/resource/loading regressions, full Node regression at the milestone, route captures, desktop/375px, EN/PT fallback/reduced motion and repeated cold-start comparisons. Record measurements and limits in the audit; do not represent local results as physical-device or production guarantees.

## Ownership

- Primary: visual decisions, materials/palette, optional atlas preparation, measurement, integration and final verification.
- `loading_audit`: loader workers and independent tree/props startup, focused loading regression.
- `architecture_delivery`: city-rollout/facade-kit delivery and focused allocation/LOD/disposal regression.

Independent work uses disjoint files. Primary reviews every diff. Tests precede nontrivial behavior changes; do not lower existing memory or correctness guards.

## Review focus

Near/far roof/opening alignment; shared material identity and atlas isolation; late/failed kit loads; disposal while loads are pending; partial worker initialization; active geometry eviction; frame-budget spikes during travel; relative paths under GitHub Pages; no-WebGL content availability.

## Measurement ledger

Initial instrumented observation: `world-ready` 9420.5 ms; one long task 5005 ms. CPU profile points to construction profiles, repeated geometry transforms/merges and atlas generation. That first run sampled zero frames immediately after readiness; it is diagnostic evidence, not the final timing baseline. Three corrected baseline runs and matched after runs are required for the delivery comparison.

## Completed ledger

- Regional palette and shared coated-metal/glazing finish implemented; five-family shaders and landmark isolation passed.
- Atlas generation moved to a temporary transferable-buffer worker; all six ordinary/legacy map hashes match exactly with worker and fallback. Meshopt uses one shared native worker; tree/props startup overlaps with failure cleanup.
- Initial far buffers and bounded nearest-cell detail delivery implemented; async kits, mixed townhouses, hysteresis, eviction/reentry and idempotent disposal passed.
- Independent review identified reduced-motion starvation; observed RED, fixed return/wake propagation, and full 375px idle/jump regression passed with 16 near cells complete and GL 0. Reviewer approved the correction.
- Three matched cold-start runs and three fixed-high route runs per version completed. Full Node regression: 240 passed. Loading and memory improve strongly; steady FPS remains variable and is not claimed solved.
- Legacy citywide envelope guard still fails at the identical cell/vertex on baseline and after. Its thresholds remain unchanged; no global production-ready claim.

See the [delivery audit](../../audits/2026-11-12-styled-realism-performance.md) for exact measurements, source manifest and validation limits.
