# Swap plaza guardrails implementation plan

> Execute inline using superpowers:executing-plans; no delegation is needed for this small change.

**Goal:** Protect the two plaza portal edges with the approved graphite railings.
**Architecture:** Add one shared-material instanced box batch to `buildSwapPlaza({ half, kerb, y })`. Keep the existing disposal ownership and tunnel transform.
**Tech stack:** Existing Three.js ES modules; browser-harness; Node tests. No dependencies.
**Spec:** `docs/superpowers/specs/2026-11-06-swap-plaza-guardrails-design.md`, approved by the owner in chat.

## Constraints and review focus

Height 1.10 m; vertical bars approximately 0.035 m thick; gaps at most 0.10 m. Keep both runs on the coping strips, sidewalk approaches open, existing material unchanged, NPCs clear, and dispose owned geometry exactly once.

## Task: railings and focused validation

- [x] Add `tests/swap-plaza.browser.py`: build the real plaza, inspect instance bounds, spacing, shared material, disposal events, and simulated plaza-walker clearance.
- [x] Run it before implementation; expect missing railings to fail.
- [x] Modify `js/world/swap-plaza.js`: one instanced unit-box geometry for rails, support posts and bars on both edges; register geometry in the existing disposal list.
- [x] Run the browser test and related crowd/spatial Node tests; expect all checks to pass.
- [x] Inspect day/night desktop and 375 px mobile captures at stop 6.35; check the tunnel, bus and sidewalk entrances.
- [x] Review the scoped diff and run `git diff --check`; record actual evidence in this plan.

Keep existing uncommitted NPC changes intact. No commit or deployment is part of this request.

## Verification evidence

- Browser contract passed with real Three.js: two edge runs, 1.10 m height, at most 0.10 m infill gaps, shared material and geometry/instance-buffer/material disposal. The test was observed failing before each implementation change.
- All 12 plaza walkers were simulated for 90 seconds in normal and reduced-motion modes; minimum body-to-rail clearance: 1.017 m.
- Related Node tests: 20 passed, zero failures.
- Desktop and 375 px mobile day/night captures inspected at stop 6.35. Local captures: `/tmp/swap-rails-desktop/` and `/tmp/swap-rails-mobile/`. Nighttime graphite is intentionally subdued.
- Diff reviewed; `git diff --check` passed. No new material, texture, light or dependency; one instanced batch with 218 box members.
- One browser test attempt timed out while loading the full scene; the subsequent isolated rerun passed. No full regression, Lighthouse, physical-phone test or performance benchmark.
