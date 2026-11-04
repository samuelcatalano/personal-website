# Three.js integration

This repository pins Three.js 0.169.0 via `index.html` importmap. Use its existing addon imports and no new dependency/build step. Keep URLs relative to the module/site base; the deployment is under `/personal-website/`. Test the same pinned loader, not an unrelated current Three.js release.

Export a separate self-contained GLB: glTF Y-up, metres, character forward +Z, feet at zero, deliberate material colour spaces, deform skeleton and named baked clips. Verify axis conversion exactly once by loading the result. Keep source `.blend`, provenance and original NPC pack intact. Blender export options change by release; use the installed exporter documentation rather than guessing operator keywords.

Runtime integration points: `js/world/scene.js:createWorld` creates `people` and awaits `createNpc3d`, then updates simulation before render units. `js/world/people.js:createPeople` owns navigation; `js/world/crowd.js:crowdPlan` owns deterministic identities/routes. Existing `npc3d.js` uses skeleton-safe cloning, per-person mixers, measured per-rig stride, pool assignment/frustum limits, distant animation throttling and fine-detail hiding. Preserve those pedestrians unchanged; a new character requires its own explicitly scoped installation point.

Use `SkeletonUtils.clone` for independent animated bones; ordinary Object3D cloning is insufficient for skinned instances. Share geometry/maps carefully, own mixer/action state per character, and cache a load promise only with explicit ownership/disposal. Do not dispose shared maps from one instance. Load failure/timeout must leave the page usable; late results must not install stale objects. Reduced motion must remain usable.

Run GLB validation, load with real GLTFLoader, inspect bounds/materials/skeleton/action names, play each requested clip and capture front/side/three-quarter views. Check console/network errors, close and scene-distance appearance, day/night and reduced motion. Reuse NPC loading/jump tests where relevant; they contain historical sprite expectations, so inspect applicability before treating them as current runtime truth. `tools/npc/bench.mjs` targets `npc-poc`, uses SwiftShader and is a relative asset experiment, not city/hardware certification.

Gate before scene rollout: independently viewable character, passed structural checks, approved likeness and contact review, then one isolated scene slice with measured resource/performance delta. Do not declare a citywide rollout from asset-only evidence.

Primary source: [Blender glTF exporter manual, 5.2](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html). The English endpoint was unavailable during the original source check; [the 5.2 Dutch page](https://docs.blender.org/manual/nl/5.2/addons/scene_gltf2.html) was accessible. Recheck the installed exporter when using this skill.
