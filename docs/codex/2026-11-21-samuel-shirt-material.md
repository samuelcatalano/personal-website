# Samuel T-shirt material repair

## Diagnosis and change

The owner reported visible shirt texture defects in a desktop scene capture. Compared the active model with and without its normal map, and with Body/Head rendered separately. The rectangular chest/shoulder patches remain with the normal map disabled and are on the Body surface, rather than the replacement Head. Its atlas combines cloth islands with incompatible baked exposure/shadowing, amplified by the existing dark-colour lift.

`js/world/reference-npc.js:tuneMaterial` now evens dark shirt albedo toward one charcoal tone, retaining bounded luminance variation. The rest-pose mask follows the shirt from the hem through the collar (0.82–1.53 m); the existing dark-texel mask protects light print and skin. Normal-map folds, texture resolution, geometry, rig, animation and greeting audio remain intact. The treatment follows the surface during the wave because its mask uses rest coordinates.

No asset re-export or source overwrite was needed. At completion of this material-only step, the active GLB SHA-256 remained `bcd279bec82a781710d6baf64656c253a9e110902441f73710820a6929427e4a`. The failed, previously discarded shirt candidates were not reused.

## Verification

- `tests/npc-shirt.browser.py` first failed on excessive contrast between dark atlas colours (linear-red gap 0.04711); after correction it passed with gap 0.00351. A second regression caught the uncorrected collar band and passed after extending the mask through the actual collar. White print and skin samples match untreated values within 0.001; lower-body contrast remains unflattened. These are controlled shader probes, not a perceptual quality score.
- `tests/samuel-wave.browser.py`: passed real-model entry/repeat/re-entry, offscreen suppression, paused updates and reduced motion.
- `node --test tests/`: **318 passed, zero failures**, after the final shader change.
- Matched desktop front/side/back captures at Wave times 0, 1.3, 3.7 and 6.5 seconds. Confirmed raised-hand motion (hand world height changes from 0.868 m to 1.654 m). Isolated review scene remains 5 calls / 28,151 triangles, including ground and the existing sole split.
- Full desktop site: reached closing/Wembley after the intro; inspected day/night captures and live wave phase/sequence progression. Both themes reported zero failed shader programs. Final captures saved in the local Codex visualization workspace (`npc-shirt/site-day.png` and `npc-shirt/site-night.png`).
- `git diff --check`: passed.

## Limits

This repairs the patchwork cloth colour. Existing angular collar and sleeve/underarm silhouette/deformation are geometric defects and are still visible in close inspection; no claim that the character is flawless from every angle. No mobile checks, new FPS benchmark, commit, push or deployment.

## Subsequent shape repair

The owner then authorized collar/sleeve geometry and skinning corrections. Those changes are recorded separately in `docs/codex/2026-11-21-samuel-shirt-fit.md`; the original GLB hash above records the material-only baseline, not the later runtime asset.
