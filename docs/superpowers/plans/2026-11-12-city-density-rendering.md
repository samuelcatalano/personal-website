# City density and rendering refinement implementation plan

> **For agentic workers:** Use executing-plans for primary implementation; independent envelope investigation is isolated to explicitly claimed files.

**Goal:** Improve the approved vivid stylized realism, add houses/buildings to verified vacant city pockets, and fix reproducible rendering defects.

**Architecture:** Retain the current plain ES-module/Three.js renderer, data-driven lots, shared mass/trim/glass batches and bounded near-cell construction. Append deterministic infill to existing layout rejection masks; preserve all previous lot descriptors, routes, parks, walking areas, water, landmark sightlines and reserved content anchors. User explicitly authorizes density expansion in this request.

**Tech stack:** Existing pinned Three.js r169, Node assertions, browser-harness; no npm/build/dependency additions.

## Design contract

The portfolio remains a colourful miniature city with credible construction/material depth. Preserve regional identity, the red bus as focus, and readable landmarks. Fill genuine gaps with low foreground houses and taller rear buildings; avoid a continuous wall of towers. Prioritize defects in lot envelopes, visibility, surface stability and lighting over additional microgeometry. Primary owns design/scope/integration and the shared browser.

## Work

- [x] Capture current route and inspect before changing visuals. Collect baseline lot/prop/tree data and survey free space against actual exclusions.
- [x] Reproduce and fix the known lot-envelope failure without weakening its guard. Add targeted regression.
- [x] Append selected infill using existing families and independent randomness. Check exact prior descriptors, park/path/tree/landmark clearance and both render modes. 27 lots selected; three adjusted to retain the river buffer after a failing guard.
- [x] Correct camera-dependent grain and Tower Bridge face-orientation hints, regenerate both bridge assets, inspect matched scenes/day/night/rain. No new lights/passes.
- [x] Focused browser suites, 242 Node tests and affected desktop/375px/reduced-motion/EN+PT WebGL-off checks. Measured geometry/payload costs and one diagnostic A/B recorded.
- [x] Independent reviews and audit/current reference updates. [Delivery and remaining limits](../../audits/2026-11-12-city-density-rendering.md). No commit/push/deployment.
- [ ] System Design DOCX: structural clone prepared in /tmp, but the bundled renderer is missing; no unrendered document delivered. Application changes are not blocked.
