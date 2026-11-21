# Samuel collar and sleeve fit

## Result and scope

Reduced the collar's serrated motion and the pointed hanging sleeve during the wave while retaining the preceding shirt-material correction. The same owner-reference character and 7.5-second Wave clip remain active. This is a bounded repair of the existing scan, not a claim of flawless garment topology from every angle.

## Diagnosis and repair

- Several Body collar points followed the head almost exclusively while adjacent points followed the torso/clavicles. Gave the collar a continuous torso/neck/clavicle weight field and blended the lower neck toward that same field. Facial vertices at or above 1.56 m, eyes and the lower body below 1.03 m remain byte-identical in positions, normals and skinning.
- Sleeve/armpit cloth had abrupt torso-versus-upper-arm binding. Smoothed that transition and feathered weights across the cuffs, keeping no more than four normalized influences.
- Bounded cuff smoothing moves 522 Body vertices by at most 6.443 mm. A radial neck tuck moves 1,239 Head vertices by at most 4.001 mm, disappearing above the collar. All UV seam copies share edits; affected normals are normalized.
- Original textures and animation buffer views are byte-identical. File size remains 4,787,900 bytes; mesh remains 28,149 triangles, 53 joints, three materials, three clips. No new runtime modifier, geometry pass, texture or draw call. Existing shader/material improvement, audio cue logic and owner-approved voice gain retained.
- Loader asset version `shirt-fit-07cc2b5a` prevents stale cached character data. New SHA-256: `07cc2b5a7cc25a1eea6842c3ca310736123c28834f3067defab7cea7491abbe4`.

## Local editable source

`assets/models/source/realistic-npc-20261104/shirt-fit-20261121/` contains the preserved original GLB, edited `npc_shirt_fit.blend`, atlas classification samples and the standard-Python repair scripts. Two independent rebuilds produced the exact same runtime hash. This directory is excluded by the existing gitignore policy; the runtime GLB and tests are tracked. The broader original `npc_game_ready.blend` was not overwritten. The derivative opens in POSE with Wave active; hand positions at frames 0/40/90 were checked to avoid a static export/REST-pose mistake.

## Verification

- `tests/reference-shirt-fit.test.mjs`: the collar-anchor regression fails on the original asset and passes on the repaired asset. All weights are finite, nonnegative, normalized and reference valid joints; original texture and animation payload hash protected.
- `node --test tests/`: 321 passed, zero failures.
- `validate_gltf.py`: passed structural references/counts with the existing 28,149-triangle asset. `validate_rig.py` on the editable derivative: 53 deform bones, three skinned meshes; no unweighted, negative/nonfinite, unnormalized or excess-influence vertices.
- Binary integrity check: changes confined to Body/Head position, normal and skinning buffers. Protected face/eyes/lower-body data unchanged; normals unit length.
- `tests/reference-shirt-fit.browser.py`: real pinned GLTFLoader and full Wave, Idle and Walk sampling; finite bounded garment deformation and the limits below passed.
- `tests/npc-shirt.browser.py` and `tests/samuel-wave.browser.py`: material/print/skin protection and actual animation greeting lifecycle/reduced motion passed.
- Full desktop site: verified the final versioned GLB loaded, inspected day/night captures and observed the greeting sequence advance from 1 to 2. Both themes reported zero failed shader programs. Evidence is retained in the local Codex visualization workspace under `npc-shirt-fit/`.
- Matched desktop front/profile/back captures at Wave times 0, 1.3, 3.7 and 6.5 seconds; raised-hand pose verified, not just still-frame export. Isolated scene remains 5 calls / 28,151 triangles including the ground.

Measured edge-length ratios relative to each asset's rest mesh over 76 Wave samples (selected collar/sleeve edges 3–70 mm long):

| Region | Measure | Original | Repaired |
| --- | --- | ---: | ---: |
| Collar | Maximum | 3.355 | 1.690 |
| Collar | 99th percentile | 2.750 | 1.513 |
| Sleeve | Maximum | 30.361 | 9.114 |
| Sleeve | 99th percentile | 3.757 | 1.967 |

These quantify reduced skinning stretch on selected edges; they are not a perceptual quality score. Some short-edge stretching and scan imperfections remain.

The owner approved the texture, collar and sleeve corrections and authorized a local commit on 2026-11-21. Full Node regression rerun before committing: 321 passed, zero failures. No mobile checks, new FPS benchmark, push or deployment.
