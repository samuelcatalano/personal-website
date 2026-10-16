# Minecraft shaders validation

Date: 2026-10-16
Plan: `docs/superpowers/plans/2026-10-16-minecraft-shaders.md`
Branch: `feat/london-bus`. Local commits only; no push or deploy.
Preview: `http://localhost:8000/`, Chrome via browser-harness with the cache disabled.

## Result

All tasks are implemented. The user approved the visual checkpoint after an art pass.

| Task | Commits |
|---|---|
| Revert dioramas | `108dc6c` and the three reverts before it |
| 2019 move stop | `71edda5`, plus the brand-less fix in `d05b42b` |
| Block textures | `25931a6` |
| Post-processing and tiers | `5c2683c` |
| Sky, clouds and water | `8b76ad7` |
| São Paulo landmarks | `f9fb684` |
| Art pass | `15d9ef1` |
| Haze, black signs, grid, JS trim | `34c25b8`, `a3a9fc5` |
| Browser tests updated | `8aa5c55` and the commit that followed it |

## Checks

- `node --test tests/`: 33 passed, 0 failed.
- Browser suites:
  - `interface`, `city`, `landmarks`, `figure` and `vehicles` pass.
  - `vehicles`: the bus is 11.05 × 4.6.
  - `figure`: the Memoji is 2.2 m.
- **`world` fails: "First frame must use the actual stop".** It fails the same way at `108dc6c`, which is before this work, and also with the tab in front. So it is pre-existing or environmental, not a regression, but it is unresolved.
- With the CDN blocked, the page falls back to `no-webgl`: 8 links and the email link are present.
- With `prefers-reduced-motion`, the world loads (`world-ready`) on the medium tier.
- PT: `lang=pt-BR`, and "Mudança para Londres" is in the copy.
- JS budget: own code excluding `content.js` is **59,923 B** (< 60,000).
- Desktop sampler at 1440×900, DPR 1, over a full scroll (1,389 frames):
  - draw calls min 145, median 173, max 268;
  - median FPS 120;
  - 0 errors.

## Deviations from the spec

- **SSR removed.** Its beauty render washed the whole frame white (the haze over London). Water reflections come from the fresnel shader. The spec is amended.
- **GTAO hid the signs.** It turned the sprites and the Memoji black. They are now hidden only during GTAO's internal renders.
- **Per-vertex AO dropped.** The boxes are scaled instances, so there are no vertices to bake into. GTAO covers AO on the high tier.
- **Draw calls are above the target of < 150 (median 173).** The post passes and the GTAO re-render add full-screen and per-mesh draws. FPS stays high on desktop. Options to reduce: merge the instanced meshes by material, or lower the bloom mip count.

## Open items

- Reclame Aqui runs Dec 2017 – Apr 2020 in the CV, which overlaps the 2019 move. Awaiting a decision from the user.
- Final review (Opus): nothing Critical. Fixed the Estaiada deck crossing the road, sun rays at night and transparent meshes in GTAO. Deferred minors: sprites tone-mapped by OutputPass, composer not disposed (dispose has no caller).
- No Lighthouse run and no tests on physical devices.
- The `world` test failure described above.
