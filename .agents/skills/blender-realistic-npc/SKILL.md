---
name: blender-realistic-npc
description: Use when creating or refining a realistic human NPC from reference images in Blender, including likeness, anatomy, clothing, rigging, locomotion and a Three.js-ready GLB.
---

# Realistic NPC in Blender

Produce one reviewable character before multiplying variants. Preserve source images, editable `.blend`, rig and material sources, provenance and a separate runtime export. Never overwrite existing NPCs or change navigation to accommodate a new model.

## Choose the next gate

Read only the reference for the current gate:

1. [Reconstruction](references/reconstruction.md): choose a local reconstruction or editable-human starting point; audit available models first.
2. [Facial likeness](references/facial-likeness.md): establish identity against matched reference views before rigging.
3. [Human anatomy](references/human-anatomy.md): correct proportions, topology and scale.
4. [Clothing and hair](references/clothing-and-hair.md): separate garments, believable thickness and economical hair.
5. [Character rigging](references/character-rigging.md): bind weights and inspect difficult joint poses.
6. [Locomotion](references/locomotion.md): measure stride, contact, speed and transitions.
7. [Game optimization](references/game-optimization.md): derive budgets and LODs without losing the approved face/silhouette.
8. [Three.js integration](references/threejs-integration.md): export, validate and test a separate runtime slice.

A failed gate blocks dependent work. Keep useful earlier work, state the failed evidence and fix that gate. Structural checks cannot approve identity, believable motion, visual quality or game performance. Do not invent numerical likeness scores or call a still image an animation test.

## Local and licensing boundaries

Use existing local tools and licensed assets; inspect availability instead of assuming installation means model weights are ready. Never upload references, download models, install dependencies or consume a paid service without authorization covering that action. Record the source and licence of every external mesh, texture and motion; unclear provenance blocks reuse. Do not infer a hidden back view or clothing detail as fact.

Observed workstation baseline (2026-11-04, recheck before use): Blender 5.2.3 / Python 3.13.13, MPFB 2.0.18 and Rigify available; external Python 3.15.2; local AssetFurnace Pixal3D single-view + BiRefNet ready. Real-ESRGAN x4plus was subsequently installed with explicit owner authorization for local head reconstruction. Multiview and autorig weights remain missing: do not silently substitute them or initiate downloads.

## Deterministic checks

From this skill folder (substitute an installed Blender executable):

```sh
blender --background --python-exit-code 1 --python scripts/validate_character.py -- character.blend
blender --background --python-exit-code 1 --python scripts/validate_rig.py -- character.blend
python3 scripts/validate_gltf.py character.glb --max-triangles 20000 --max-materials 6 --max-textures 8
python3 scripts/validate_gltf.py --self-test
```

Budgets above are invocation examples, not a project approval. Check the repository's current limits. Validators do not edit assets. Character/rig errors and GLB errors exit nonzero; successful JSON output states only measured structure. Preserve before/after captures and counts with the final artifact; report exactly which visual, Blender, browser and performance checks ran.
