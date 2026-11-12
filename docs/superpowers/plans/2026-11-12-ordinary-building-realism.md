# Ordinary Building Realism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** improve ordinary architectural construction and finish to authored-model quality through procedural detail within the existing hybrid generator.
**Architecture:** isolate ordinary maps from landmark maps; retain shared material buckets and actual openings. Add reusable procedural near-detail profiles at the ordinary assembly boundary, compatible with procedural and loaded-kit geometry; refine rooms and metric materials in existing shaders.
**Tech Stack:** plain ES modules, pinned Three.js, existing browser-harness/Node tests, no build/dependency.
**Spec:** `docs/superpowers/specs/2026-11-12-ordinary-building-realism-design.md`

## Global Constraints

- Owner approved A and direct native implementation without further confirmation.
- Quality/design first: geometry/texture/timing costs are recorded, not quality gates. Do not disable tests or conceal regressions.
- Ordinary buildings only. Preserve map, plot envelopes, routes, paths, landmarks, content and global lighting; preserve unrelated weather work.
- Reuse mass/trim/glass assembly and existing LOD; no new engine, external asset or dependency.

## Review Focus

- Landmark clones share atlas maps: preserve old pixels and shader path, not just material identity.
- Kits replace LOD0 asynchronously: near detail must survive rebuilding, with valid room/flutter attributes and no duplicate application.
- Exposed pane orientation can face any azimuth; frame profiles must fit lot bounds and retain visible glazing.
- Fine relief must filter at distance, and near/far openings and roof silhouettes must match.
- Night/rain/fallback/reduced-motion retain existing controls and resource ownership.

## Task 1 — Ordinary finish and landmark isolation

Files: `js/world/building-slice-materials.js`, new `tests/ordinary-finish.browser.py`.
- [x] Write/run failing browser assertions for distinct ordinary/landmark maps, higher ordinary resolution and unchanged legacy atlas pixels.
- [x] Add ordinary 1024px metric maps and multi-scale physically scaled material variation, preserve landmark 512px maps and shader contract.
- [x] Refine opaque room parallax with bounded furniture/wall/floor layers, pane variation and derivative-filtered detail; retain existing uniform/packing interfaces.
- [x] Run new fixture and existing facade/interior/shader checks; inspect matched five-family renders.

## Task 2 — Construction profiles and roof finish

Files: new `js/world/building-finish.js`; `js/world/city-rollout.js`, `js/world/facade-kit.js`; same browser test.
Interface: `finishArchitecture(geometries, plot, kind, recipe, level=0) -> geometries`; mutates only owned trim geometry, retains attribute layout, plot coordinates and pane geometry. Idempotent per owned trim; level1 remains economical.
- [x] Assert actual beveled normals, bounded added geometry, same pane geometry, party walls untouched, no new meshes/materials and repeated application unchanged; watch fail.
- [x] Add procedural framed glazing seals/beads, commercial mullion sections, sill/lintel construction and pitched roof courses/caps. Fit added detail to descriptor bounds. Existing facade recipe chooses residential/commercial and regional finish.
- [x] Integrate at both ordinary procedural assembly and loaded-townhouse/facade-kit rebuild boundaries before tint/chunk merging.
- [x] Render all five families, exposed backs/corners, procedural and loaded kits. Calibrate construction scale and simplify visual clutter where needed.

## Task 3 — Integration and product verification

Files: `index.html` preload graph; affected ordinary fallback/hero paths only when inspection finds a visible mismatch; browser assertions.
- [x] Regenerate preloads with `node tools/preload-list.mjs`.
- [x] Run related facade/kit/room/adjacency tests and full Node regression. Investigate new failures; leave inherited gates intact and report them separately.
- [x] Capture route-scale day/night/rain at three cities, 375px and reduced motion; retain EN/PT and WebGL fallback smoke.
- [x] Record geometry/maps/draw counts and actual limits; performance does not block visual delivery under the owner's latest instruction.

## Task 4 — Review and evidence

Files: architecture/art/budget references and dated audit/evidence.
- [x] Preserve matched before/after five-family close-ups and live-route captures.
- [x] Fresh independent whole-change review required by executing-plans, restricted to this task's changes; primary fixes and verifies important issues.
- [x] Update authoritative references and audit, check diff/links; report exactly what passed, costs and remaining limitations. No push/deploy.

## Execution ledger

Baseline: four facade/kit/office/interior browser suites passed; current-source five-family closeups in `docs/evidence/procedural-building-review/`. Weather changes pre-exist and stay untouched except shared scene visuals under validation.
Ruling: keep the compatible batching architecture because it serves the design, but do not use its historic geometry/memory limits to cap the new finish. Owner quality-first instruction supersedes performance gates.

## Outcome

Completed all tasks. Independent review findings fixed with regressions (roof support, benchmark per-instance role, owned teardown, async control-kit attributes). Final rainy integrated render exposed framebuffer feedback in the existing wet-reflection path; sampler lifecycle corrected and repeated-perspective regression plus full scene getError0 verified. Node240 and browser/fallback checks passed. Owner-selected visual quality retained; geometry/memory costs recorded for later performance work. No push/deploy; current branch/worktree retained. [Audit](../../audits/2026-11-12-ordinary-building-realism.md).
