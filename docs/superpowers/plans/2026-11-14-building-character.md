# Building character implementation plan

> Execute inline with `executing-plans`; use one independent final review. No parallel implementers on the shared geometry/material path.

**Goal:** Deliver all seven owner-selected improvements: per-property identity, material calibration, grouped night occupancy, residential details, shop identity, roof details and exposed party-wall finish.

**Architecture:** Extend the existing pre-merge construction finish and shared atlas shaders. Stable lot-ID metadata survives procedural/GLB replacement, near/far generation and spatial batching. Reuse mass/trim/glass, existing room shading, materials and assets.

**Spec:** The seven-item proposal approved by the owner in this chat. Full implementation is authorized; first verify a representative slice, then validate integration.

**Constraints:** Preserve descriptors, positions, footprints/heights, principal roofs, approved townhouse language, routes, paths, landmarks and global lighting. No dependency, download, per-building material, dynamic light or extra render pass. Desktop validation only; no mobile work. Preserve all existing changes. No automatic commit/push/deployment.

**Review focus:** Identity survives chunk/kit changes; occupancy remains constant across a pane; details never cover glazing or enter shared walls; added geometry respects the original envelope; new attributes remain compatible with every merge and preserved materials.

## 1. Identity and materials

- [x] RED: deterministic identity/exposure/occupancy tests and browser attribute/merge checks.
- [x] Add `js/world/building-character.js`: reuse the existing lot hash; stable maintenance, door/roof/display palettes and grouped occupancy.
- [x] Integrate in `building-finish.js`, `building-slice-materials.js`, `lot-tint.js` and relevant assembly/kit paths. Keep preserved landmark/public-realm materials unchanged.
- [x] GREEN: pure tests, actual material compilation, idempotence and near/far/kit metadata checks.

## 2. Details and occupancy

- [x] Add bounded residential curtain/entry finish, differentiated shop displays, roof-service finish and patches only on verified exposed blank walls. Reuse existing buckets; preserve openings and main roof forms.
- [x] Drive night emission from coherent property/floor/room groups and usage, with warm homes and more neutral offices. No live time/randomness.
- [x] Verify representative house/shop/residential/office/tower geometry, envelopes, party walls, textures and night pixels.

## 3. Integration and review

- [x] Update modulepreloads with the repository tool and run full Node regression at rollout milestone.
- [x] Capture three cities day/night and representative five-family before/after views; inspect desktop EN/PT/fallback/reduced-motion behavior as affected.
- [x] Run scoped geometry/memory/rendering A/B; report costs without lowering quality or making universal FPS claims.
- [x] Independent final diff review; fix material findings, update architecture/art/budget references and record checks/limits in an audit.

## Ledger

- Start: clean tree at `b1c3874`. No extra assets or dependencies; one implementer, one final reviewer.

- Task 1/2: deterministic tests RED→GREEN; actual five-family near/far/bounds/identity checks and original finish suite passed. Full Node gate: 264/264.
- Final review: independent reviewer found occupied-room emission on exterior kit glass. Fixed using CPU-only exclusion ranges; real canopy/railing/lightbox regression RED→GREEN. No other actionable findings.
- Primary fix: use facade-tangent coordinates for residential room groups; added pure regression RED→GREEN.

- Task 3: final source six city views (three cities × day/night) reported 739 plots, zero JS errors/failed shader programs/WebGL errors. Final browser gate passed actual kit exclusions, ordinary/styled finish, 24 profiles and EN/PT fallback + PT reduced-motion startup.
- Evidence: `docs/audits/2026-11-14-building-character.md` and `docs/evidence/building-character/`. Fixture buffers +17.15%, triangles +0.56%, unchanged 3 calls per family. GPU/CPU timing samples do not support a global performance verdict. No deliberate feature deferrals, commits or deployment.
