# Swap plaza seating implementation plan

Execute inline, without delegation, following the owner-approved proposal in `../specs/2026-11-06-swap-plaza-seating-design.md`.

- [x] Test and add two batched benches, two low planters and a painted paving border in `js/world/swap-plaza.js`; retain disposal ownership.
- [x] Test and adjust the existing 12-person swap-plaza allocation in `js/world/crowd.js`: eight circulation walkers, two fixed pairs with opposing headings.
- [x] Add stationary placement support in `js/world/people.js`; stationary people retain position during crowd separation.
- [x] Add a focused neutral idle-pose helper and pool action switching in `js/world/npc3d.js`, preserving walking and reduced-motion behavior.
- [x] Run related Node/browser checks, simulate clearance, inspect desktop/mobile day/night captures and review the diff. No automatic commit or deployment.

## Verification

- 172 Node tests passed, zero failures; diff and syntax checks passed.
- Real adult and child rigs: neutral limb direction, sole contact within 1e-5 m, breathing, unchanged generator input pose, both stationary pairs visible, all four pooled bodies returning to walking after a camera jump. Normal and reduced-motion runs passed.
- Plaza geometry/browser contract passed: two benches, two low planters, shared batches and disposal ownership. All twelve NPCs simulated for 90 seconds in normal/reduced motion, clear of furniture and guardrails; four stationary positions stayed fixed.
- Desktop/mobile day/night captures inspected: `/tmp/plaza-seating-desktop/`, `/tmp/plaza-seating-mobile/`; close review: `/tmp/plaza-seating-close.png`.
- Four additional instanced furniture batches, three local materials, shared unit-box geometry and existing shrub geometry. Existing paving texture gains its border; no new texture, GLB download or dependency. The idle clip is created lazily once per reused pool body.
- No new performance benchmark, physical-phone test, commit or deployment.
