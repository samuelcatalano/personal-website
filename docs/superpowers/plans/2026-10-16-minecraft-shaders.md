# Minecraft Shaders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.
> To save tokens (the user's explicit priority), the steps give interfaces, key snippets and acceptance checks rather than complete code. Implementers read the files they touch.

**Goal:** turn the voxel world into a Minecraft-with-shaders look, with São Paulo until 2017, a move in 2019, and London through to today.
**Architecture:** the existing instanced-box voxel world stays. Blocks get one shared triplanar noise texture tinted by the block colour. A new `post.js` owns an `EffectComposer` with quality tiers. `sky.js` and `water.js` are upgraded.
**Tech:** three@0.169.0 + `three/addons/` via the importmap. No build, no npm.
**Spec:** `docs/superpowers/specs/2026-10-16-minecraft-shaders-design.md`

## Global constraints

- Read `CLAUDE.md`. All copy goes in `js/content.js` (EN + PT). Relative URLs only. No home address or phone.
- Own JS code, excluding `content.js`, stays < 60,000 B. Measure with `cat js/*.js js/world/*.js | wc -c` minus `content.js`.
- Implementers never start servers, never touch port 8000 and never run browser-harness. The controller runs browser checks.
- Never touch `docs/codex/2026-10-16-claude-handoff.md`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.
- `node --test tests/` passes after every task.

## Spec amendment

The spec's per-vertex AO is dropped. Boxes are scaled instanced cubes, so they have no per-block vertices to bake into. `GTAOPass` provides AO on the high tier.

## Review focus

1. No WebGL or CDN failure → the `no-webgl` panel still works (`main.js` catches the import failure).
2. Mobile (375 px) → medium tier, with no GTAO, SSR or god rays, and a usable FPS.
3. `prefers-reduced-motion` → no idle animation, and the world still renders.
4. Resize and orientation change → the composer and every pass resize, with no stretched buffers.
5. Night theme → bloom shows lit windows without blowing the sky out to white.

---

### Task 0: Revert dioramas work (Haiku)

- [ ] `git revert --no-edit 601bd4d 22016d7 c30946e 46f1b87` (newest first). Resolve conflicts, if any, in favour of the pre-dioramas state.
- [ ] `node --test tests/` passes. Confirm that `js/world/models.js` and `tools/*.py` are gone and `layout.js` is back to the curved route.

### Task 1: `move` stop 2019 (Haiku)

**Files:** `js/content.js`, `js/world/layout.js`, `tests/content.test.mjs` or `tests/logic.test.mjs`
- [ ] Test: the stop ids include `move` directly after `reclame` and before `millimetric`, with `year: '2019'` and `country: 'UK'`; EN and PT journey copy exist for `move`.
- [ ] Add `{ id: 'move', section: 'journey', year: '2019', country: 'UK' }` (no `brand`). Add the journey copy following the existing entries' shape. EN title "Moved to London" with one line about relocating to London; PT "Mudança para Londres". Do not invent employers or dates.
- [ ] `layout.js`: `LANDMARKS.heathrow = 'move'`, because the landing is the move. Check that `signs.js` and `ui.js` handle a stop with no `brand` (hero/stack already have none).
- [ ] Tests pass; commit `feat: 2019 move-to-London stop`.

### Task 2: Block textures (Sonnet)

**Files:** create `js/world/textures.js`; modify `js/world/voxel.js`, `js/world/palette.js`, `tests/palette.test.mjs`
**Produces:** `blockMaterial(color, { glow }) → THREE.MeshStandardMaterial`, used by `buildMeshes`.
- [ ] `textures.js`: one 16×16 canvas noise texture (greys around 0.85 to 1.0, plus a 1 px darker border per tile so blocks read as blocks). Use `RepeatWrapping`, `LinearMipmapLinearFilter`, `anisotropy = 4` and `colorSpace = SRGB`. Generate it once and cache it.
- [ ] `blockMaterial`: a `MeshStandardMaterial({ color, map: noise, roughness: 0.9, metalness: 0 })` with `onBeforeCompile` replacing the map UV with **world-space triplanar UV**: pick the axis by the dominant world normal, so 1 tile = 1 world unit whatever the instance scale. The instance matrix must be applied (use `instanceMatrix` in the vertex shader; pass `vWorldPos` and `vWorldNormal`). Keep `userData.glow` and an `emissive` for glow materials, which `sky.js` drives.
- [ ] `voxel.js`: swap `MeshLambertMaterial` for `blockMaterial`. Cache materials by colour.
- [ ] `palette.js`: Minecraft-like tones (grass `#5d8c3a`, dirt `#86603e`, stone `#8f8f8f`, oak `#a27b4c`, brick `#9a4b3a`, sandstone `#d9c995`, concrete `#bdbdbd`, glass `#a8c8d8`, leaves `#4f7a2e`, water handled separately). Update `palette.test.mjs` (lowercase hex).
- [ ] Commit `feat: triplanar block textures`.

### Task 3: Post-processing with quality tiers (Sonnet)

**Files:** create `js/world/post.js`; modify `index.html` (importmap), `js/world/scene.js`; test `tests/logic.test.mjs` (pure tier logic)
**Produces:** `createPost(renderer, scene, camera, { tier }) → { render(dt), setSize(w, h), setTier(t), tier }` and pure `nextTier(tier, fpsSamples) → tier` (export it for the test).
- [ ] Importmap: add `"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"`.
- [ ] Passes in order: `RenderPass` → `GTAOPass` (high) → `SSRPass` with `selects: [waterMesh]` (high; `post.addSSR(mesh)` is called by the scene) → sun-rays `ShaderPass` (high; a 40-sample radial blur from the sun's screen position over bright pixels, with uniforms `uSun` and `uStrength`, written inline in `post.js`) → `UnrealBloomPass(strength 0.35, radius 0.6, threshold 0.85)` → `OutputPass`.
- [ ] Tiers: `high` (all passes), `medium` (bloom + output only). The start tier is `medium` on `(max-width: 767px)` or reduced motion, `high` otherwise. `nextTier` drops high → medium when the average FPS is below 40 over 2 s, and never goes back up within a session.
- [ ] `scene.js`: replace `renderer.render` with `post.render`, call `post.setSize` in the resize handler, update `uSun` each frame from the sun's direction, and sample FPS into `nextTier`.
- [ ] Node test for `nextTier`. Commit `feat: shader post-processing with quality tiers`.

### Task 4: Sky, clouds and water (Sonnet)

**Files:** `js/world/sky.js`, `js/world/water.js`, `js/world/scene.js`
- [ ] Sky: `Sky` from `three/addons/objects/Sky.js` (turbidity 4, rayleigh 1.5, mie 0.005), with the sun elevation driven by `update(night)` (day around 35°, night below the horizon). Clouds: 6 to 10 large soft planes (canvas radial-gradient texture, `transparent`, `depthWrite: false`, `fog: false`) at y ≈ 120, drifting slowly (static when reduced motion is on). Keep the existing stars, glow and fog lerp.
- [ ] Water: keep the current shader and add animated normals (two scrolling sine/noise layers) plus a fresnel mix toward the sky colour. Expose the mesh so the scene calls `post.addSSR(water.mesh)`.
- [ ] Commit `feat: atmospheric sky, clouds and fresnel water`.

### Task 5: São Paulo scenery (Sonnet)

**Files:** `js/world/landmarks.js` (or a new `js/world/saopaulo.js` if `landmarks.js` would pass about 10 KB), `js/world/layout.js`
- [ ] Voxel builders anchored to stops, in the same style as the existing landmarks:
  - **MASP** at `taqtile`: a glass/concrete box raised on two red frames (`#c8102e`), with an open span beneath.
  - **Catedral da Sé** at `puc`: a grey stone nave, two spired towers and a green dome.
  - **Ponte Estaiada** at `reclame`: an X-shaped mast about 1.5× Big Ben's height with fan cables (thin boxes) over the river.
  - **Paulista towers**: tall glass/concrete blocks along the BR stops.
- [ ] `LANDMARKS` gains `masp: 'taqtile'`, `se: 'puc'`, `estaiada: 'reclame'`. Add a test that every `LANDMARKS` value is a stop id (the existing test covers it).
- [ ] Commit `feat: São Paulo landmarks`.

### Task 6: Visual checkpoint (controller)

- [ ] browser-harness with the cache disabled. Capture SP (hero, taqtile, reclame), move, and London (xdesign, olm, tribal, contact) at desktop and 375 px, day and night. Send them to the user and **stop for approval**.

### Task 7: Final verification (controller)

- [ ] `node --test tests/` and the browser suites (`interface`, `world`, `figure`, `city`, `landmarks`, `vehicles`). Test no-webgl via a blocked CDN, reduced motion, EN/PT, and the JS budget. Sample draw calls (< 150) and FPS per tier.
- [ ] Write the report to `docs/codex/2026-10-16-minecraft-shaders-validation.md`. Then an Opus whole-branch review.
