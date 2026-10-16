# Minecraft-style world with modern shaders

**Status:** design approved in chat on 2026-10-16 (approach 3, full pipeline). This replaces `2026-10-16-real-3d-dioramas-design.md`. The panel, navigation, content and runtime contracts are unchanged.

## Goal

A voxel world in the style of Minecraft played with a shader pack: the "After" reference image the user sent. That means soft sunlight with shadows, ambient occlusion, bloom, sun rays, a sky with clouds, and reflective water. The world should not look heavily pixelated. The journey starts in São Paulo and moves to London in 2019.

## Out of scope

New sections, backend, audio, manual bus control, GLB models, downloads, image-to-3D, npm or a build step.

## Route

| Chapter | Stops | Scenery |
|---|---|---|
| São Paulo | `hero`, `puc` 2003, `arizona` 2011, `insane` 2012, `taqtile` 2014, `mira` 2017, `reclame` 2017 | Blocky towers along Paulista, MASP (red frame), the Sé, Estaiada, palm trees |
| Move | **new `move` 2019** | The plane flies over the water and lands in London |
| London | `millimetric` 2020, `xdesign` 2020 (Big Ben), `olm` 2021 (Eye), `tribal` 2024 (Tower Bridge), `stack`, `articles`, `repos`, `recs`, `contact` (Wembley, Memoji) | The existing voxel landmarks are reused |

`move` gets EN/PT copy in `js/content.js` ("Moved to London" / "Mudança para Londres") and has no company brand.

## Look

- **Blocks.** Procedural 16 px canvas textures per material: stone, brick, grass, concrete, glass, wood, leaves and water. They have subtle noise and are filtered with mipmaps (`LinearMipmapLinear`), so the result reads as blocks without heavy pixelation. Ambient occlusion is baked per vertex in the mesher.
- **Light.** Warm directional sun with soft shadows (`PCFSoftShadowMap`), a hemisphere fill, ACES Filmic tone mapping and sRGB output.
- **Sky.** three's `Sky` addon (atmospheric scattering) plus a layer of soft cloud planes. At night the sky darkens, and windows and lamps glow.
- **Post-processing**, through `EffectComposer` from `three/addons/`:
  1. `RenderPass`;
  2. `GTAOPass` (ambient occlusion);
  3. a god-rays pass based on `GodRaysShader`;
  4. `UnrealBloomPass`;
  5. `OutputPass`.

  SSR was dropped (`SSRPass` washed the whole frame white); water reflections come from the fresnel shader.
- **Water.** Rivers and sea use a water material with animated normals and and a fresnel effect that mirrors the sky. The Thames appears only at Westminster and Tower Bridge; Wembley has no river.

## Quality tiers

| Tier | When | Passes |
|---|---|---|
| high | desktop, average FPS ≥ 50 | all |
| medium | mobile, or high falls below 40 FPS for 2 s | shadows, bloom and fresnel water; no GTAO or god rays |
| none | `prefers-reduced-motion` | medium, with no idle animation |

Without WebGL, or if the CDN fails, the page uses the `no-webgl` fallback with the full panel, as it does today.

## Units

- `js/world/textures.js` (new): procedural block textures and materials.
- `js/world/voxel.js`: per-vertex AO and the material per block type.
- `js/world/post.js` (new): composer, passes and quality tier, exposing `createPost(renderer, scene, camera) → { render, setSize, setTier }`.
- `js/world/sky.js`: `Sky` addon, clouds and day/night.
- `js/world/water.js`: water material.
- `js/world/city.js` and `js/world/landmarks.js`: São Paulo scenery (MASP, Sé, Estaiada, Paulista) and the `move` stop.
- `js/content.js`: the `move` stop.
- `scene.js` keeps the `createWorld(canvas, stops, { reducedMotion, onProgress })` contract.

**Removed:** the dioramas work, which means `js/world/models.js`, the credits in Contact, `tests/models.test.mjs`, `tools/*.py`, and the straight route from Task 4. Reverting is cleaner than editing it out.

## Budgets

- Own JS, code only, excluding `content.js`: < 64,000 B (raised from 60,000 by the user on 2026-10-16 for more detailed cars). The addons from three do not count.
- Desktop high tier: ≥ 50 FPS at 1440p on a mid-range laptop. Mobile medium tier: ≥ 30 FPS.
- < 150 draw calls.

## Tests

- **Node:** stops in order with `move` between `reclame` and `millimetric`; EN/PT copy for `move`; the privacy and content checks keep passing.
- **Browser:** the composer renders without errors on each tier; the tier drops when FPS falls (simulated); the `no-webgl` and reduced-motion fallbacks still work.
- **Visual:** one user checkpoint per chapter (SP, move, London), desktop and 375 px, day and night.

## Risks

- **GPU cost** of GTAO and god rays. Mitigated by the quality tiers.
- **SSR dropped.** `SSRPass` washed the whole frame white (haze artefact); water reflections are the fresnel shader.
