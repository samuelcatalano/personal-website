# Handoff: remove the 2D sprite pedestrians, 3D NPCs only

Written 2026-11-04 when the weekly usage cap (25%) was reached. Owner language: pt-BR in chat; code, docs and commits in English.

## Owner decision (explicit)
"You are mixing 2D and 3D NPCs. Erase any trace of 2D NPCs. Delete them from the project. I do not want to see them anymore." The owner also wants busy plazas (many people) and no pop-in (pedestrians never appear or vanish because of distance or leaving and returning to a stop). The two goals conflict unless the 3D crowd is made cheap enough: see "Cost".

## Current state (HEAD after 145e6b6 and later commits; run `git log --oneline -15` and `git status --short` first)
- `js/world/people.js`: sprite crowd (instanced sprite meshes, atlas, shadow meshes) AND the simulation that moves 1000 people along routes (`crowdPlan`, lane/loop/wander paths, kiosk avoidance, separation, frustum visibility, arch hiding). `createPeople(scene, { curve, pts, stops, obstacles, reducedMotion, hd })` exposes `crowd.userData.route = { x, z, fx, fz }` and `walkPace` typed arrays indexed by plan ID.
- `js/world/npc3d.js`: skinned 3D walkers (`assets/npc/npc_pack.glb`, 8 models, per-instance tints), a pool of about 56 walkers within 160 m of the camera (`POOL_MAX_DISTANCE`), nearest first; each 3D walker hides its own sprite only (commit 512e831). Default on desktop; `?npc3d` hook in `scene.js`.
- `js/world/crowd.js`: `walkPaths`, `crowdPlan` (N = 1000, 12 extra plaza cells from ad8eecf), looks (`makeLook`, SKIN, hair shapes for sprites).
- So today up to about 900 people are still SPRITES; only the nearest 56 are 3D. That is the mixture the owner sees.

## Task
1. Remove all sprite rendering: instanced sprite meshes, the sprite atlas/generation, sprite shadows, `sprites.js` (if it exists), sprite look code (`makeLook`, SKIN, `hairShape`) that only serves sprites, related tests and docs. Keep the SIMULATION (paths, plan, avoidance, route/walkPace contract) because `npc3d.js` consumes it. Grep consumers before deleting (`rg -n "sprites|makeLook|hairShape|atlas" js tests tools docs`).
2. Make 3D NPCs the only pedestrians and keep the scene busy. Do not pop in/out: no distance cut-off while in view. Options to measure (do not guess; measure per option, desktop 1440x900 DPR1.5 and emulated mobile 375x812):
   - a larger pool (150-300) with LOD: full skinned mesh near (about 12 k tris), a lower-poly skinned LOD (2-4 k tris) in the mid range, animation LOD (update mixers every 2-4 frames when far, share a clock phase), and a very cheap static-pose instanced silhouette (a 3D mesh, not a sprite) at long range;
   - GPU-baked vertex animation only if the CPU/bone cost proves to be the bottleneck (the original brief said not to do this prematurely);
   - frustum culling and shadow culling for the far LOD; contact shadow only near.
   Previous benchmark (CPU ms only, GPU not measured): 10 NPCs 0.5 ms, 40 NPCs 1.4 ms, 80 NPCs 2.5 ms (3.9 ms with shadows); 11k triangles per NPC at LOD0; 650 k triangles for 80 NPCs.
3. Preserve: reduced-motion (frozen but visible), WebGL-off (the HTML panel stays usable, no people needed), mobile fallback (fewer, cheaper), kiosk/obstacle clearance, arch hiding, plaza cells, deterministic seed, `crowd.userData.route/walkPace`, no pop-in at stop changes (the vanish bug fixed in 512e831).
4. Erase evidence of 2D pedestrians from the repo: docs and evidence images that show sprite crowds (`docs/evidence/**`, `docs/audits/*`, art docs) must be recaptured after the change or removed; remove sprite-specific text from docs (`docs/architecture/3d-city.md`, `docs/architecture/rendering-budget.md`, `docs/art-direction.md`, `docs/TRD.md`) and add the 3D crowd description instead. Do not rewrite git history; deleting files in a new commit is enough unless the owner asks otherwise.
5. Tests: update `tests/people-spatial.test.mjs`, `tests/people-arrival.browser.py`, `tests/npc-loading.test.mjs`, final-art and any test asserting sprite counts; add checks that only 3D walkers exist and that the visible count at arrival is within 10% of the steady count. Run `node --test tests/` and the people/crowd/final-art browser suites with browser-harness (never close tabs you did not open).

## Cost and risk (honest)
- Removing sprites removes about 900 cheap pedestrians; replacing them one-for-one with full 3D skinned meshes is not feasible. The owner must accept a smaller or lower-detail far crowd, or the LOD plan above must hit the budget. Report measured median/p95, draw calls, triangles, skinned meshes, bones, GPU time (not measured so far) and mobile results before declaring success.
- Known open issues in the NPC pack: faces and hands are low quality, clothes have no textures, only 8 models (tints give variety), women are the male rig with a warp (feet too long). See `docs/plans/npc-handoff-codex.md`.

## Constraints
No npm or build step; relative URLs; local commits only, no push to `main`; commit with explicit paths (`git add <paths> && git commit -m ... -- <paths>`); no destructive git reset/clean; do not use extra usage; check `get_usage` before launching agents.
