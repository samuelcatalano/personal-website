# NPC front: handoff to Codex

Written 2026-10-31 (night) when the weekly usage cap was close. Owner language: pt-BR in chat, English in code/docs/commits.

## Goal (owner)
Walking-pedestrian quality "North Star" (reference: a Unity "Walking People" style crowd: men and women, varied bodies/heights/faces/skin/hair/clothes, natural walk, stylised not photoreal). Judge the result INSIDE the real city (`?npc3d=1`), not only in Blender or the test page. Do not declare success from numbers; look at screenshots and keep iterating.

## Guardrails
- Work only on this front. Do NOT touch city density, building catalog, houses, lots, landmarks, Copan, layout, or `?glb=raw` work. Only `js/world/npc3d.js` and the 2-line hook in `js/world/scene.js` live in the city code.
- Branch `npc/north-star-poc` in the worktree below. No push, no merge to `main`, commit only on this branch.
- Licences: MPFB base mesh CC0 1.0 (code is GPL, not distributed); Quaternius UAL1 animation CC0 1.0. Everything else is project code (procedural). Confirm licence from an official source before adding any third-party asset; ambiguous = do not use. Details in `ASSET_SOURCES.md` (section "NPC POC").
- The user blocked paid usage (extra usage). Check usage before launching agents; weekly cap rule is the owner's own (95%).

## Where things are
- Worktree: `/private/tmp/claude-503/-Users-samuel-catalano-Projects-samuelcatalano-personal-website/f2dc575a-ee3f-4b92-a1b8-bfaef629fe28/scratchpad/npc/north-star-poc` (branch `npc/north-star-poc`, last commit `1698e8f`, later work may be uncommitted: run `git status`). If /private/tmp was cleaned, the branch is still in the main repo's git.
- Pipeline: `tools/npc/` (`npc_walk_check.py` -> `npc_bodies.py` -> `npc_build.py`; `npc_retarget.py`, `cloth_styles.py`, `hair_styles.py`, `warp.py`). Blender 5.2 at `/opt/homebrew/bin/blender -b --factory-startup --python <script>`, env `NPC_OUT=<dir>` and for walk_check `NPC_UAL=<UAL1_Standard.glb>` (UAL pack at `scratchpad/quaternius/anim/unzipped/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb`). MPFB add-on must be installed in Blender.
- Output: `assets/npc/npc_pack.glb` (8 skinned meshes NPC_A..H, one 53-bone armature, clip `NPC_Walk`, one vertex-colour material, custom attribute `_part` for runtime tint). About 3.7 MiB.
- Runtime: `js/world/npc3d.js` (opt-in `?npc3d=1`, per-instance tint palettes, 12 walkers default), test page `npc-poc/index.html` (`?count=N&bench=1&frames=120&shadows=1&tint=0`).
- Full running log of decisions and numbers: `scratchpad/npc/HANDOFF.md` (outside the repo; copy it into the repo docs if useful).
- Scratch tools (not in repo) in `scratchpad/npc/poc/`: `render_views.py`, `alive/render_one.py`, `diag_bridge.py` etc. Per-task copies and patches in `scratchpad/npc/patches/*.patch` (hem, crotch, shoelen, face, fabric, loose): apply with `patch -p0` / review against `tools/npc/` and rebuild; some may be unmerged.

## Current state (honest)
Working: 8 models (5 men, 3 women) on the shared rig, upright walk with straight knees, feet locked to floor (<3 mm), arms swing naturally, faces with eyes/lids/brows, varied hair and beards, outfits (puffer, zip jacket, hoodie, print sweater, shirt), sneakers/boots, per-instance colour tint (dozens of looks). Benchmark (1024x768 DPR2, CPU ms only, GPU not measured, frame pinned by vsync 13.3 ms): 1 NPC 0.2 ms, 10 NPCs 0.5, 40 NPCs 1.4 (1.5 shadows), 80 NPCs 2.5 (3.9 shadows); draw calls 2/11/37/56; triangles 11k/120k/430k/649k; 53 bones each.

## Known problems, ranked
1. NOT yet validated in the real city at city scale (NPCs are dots at the default camera). A Haiku agent was asked to validate with a debug param (`npcnear=1`) and tune `npc3d.js`; check its result in git/diff.
2. GPU cost and mobile not measured. The 3D walkers are now the only pedestrians (pool 90 desktop / 36 mobile); decide LOD for a larger far crowd.
3. Clothes are flat vertex colours (fake fabric patch pending), faces expressionless, tight women's tops (patch `loose`), small hem notches (patch `hem`), narrow bridge faces at the crotch (patch `crotch`), shoe length vs foot (patch `shoelen`).
4. B and G puffers around 14k tris; no LODs yet; GLB uncompressed (meshopt/KTX2 would be a new dependency: ask).
5. No `prefers-reduced-motion`/WebGL-off/night-theme verification for the 3D walkers; Lighthouse not run.
6. Blender-only caveat: the stock `render_views.py` "full" view with 5 NPCs shows false shards (objects moved apart from a shared rig); use single-NPC renders.

## Hard-won facts
- Face plates on B-E came from missing Mask on vertex group `body` (eye/teeth/tongue helpers) in json bodies. Jacket holes came from Shrinkwrap `wrap_mode` default; use `OUTSIDE_SURFACE`.
- Blender Decimate collapse with vertex group: weight 1 collapses first, weight 0 is kept; ratio counts protected faces.
- Browser pane: rAF pauses when hidden; serve the worktree with a temporary `.claude/launch.json` entry (`python3 -m http.server 8791 --directory <worktree>`) and restore the file afterwards. Pane may start narrow: `resize_window` 1280x800.
- Tests: `node --test tests/` (120 pass at last full run; re-run after changes).

## Next steps (suggested order)
1. Review/merge the six patches one by one; rebuild into a fresh `NPC_OUT`, view renders, copy GLB to `assets/npc/`.
2. City validation and tuning (`npc3d.js`): scale, lighting under the city sun, night theme, ground height, stride/speed sync, density near the camera.
3. Fabric texture feel (vertex colour or small shared texture atlas), face/hair polish at 2-4 m, more variants (10-16) if budget allows.
4. Re-run benchmark (1/5/10/20/40/80, median/p95, draw calls, tris, bones, textures, memory, shadows, payload) and add a GPU measurement; mobile check.
5. Update `ASSET_SOURCES.md` numbers, HANDOFF, commit on the branch (no push).

## Update (end of session, weekly cap reached)

### New owner requirement (top priority)
The owner wants the human body CORRECT: arms, legs, knees, elbows, neck, head, face and hair must look anatomically right and move naturally. Owner's note that human skeletons have 270-300 bones is wrong for adults (adult = 206; ~270 is a newborn, source: pt.wikipedia "Lista de ossos do esqueleto humano"), and game rigs use 50-100 bones; our rig has 53 (MPFB `game_engine`, UE-style). Bone count is not the cause of the stiff look. Real causes and plan:
1. One walk clip for everybody (`Walk_Loop` UAL1), only speed/phase varies: add several clips (UAL has more locomotion/idle variants), draw one per NPC, blend start phase.
2. No twist bones in forearm/thigh and none for shoulder/hip: add twist bones to the rig (or use MPFB `default` rig / Rigify metarig, which have more bones incl. face/fingers) and repaint weights; garments follow the 3 nearest bone segments (`seg_weights`), improve elbow/knee/shoulder deformation (bend limits, no candy-wrapper twist).
3. The retarget (`tools/npc/npc_retarget.py`) has many corrections on top (arm aim, SPLAY removal at the legs, 2-bone IK for planted feet, torso/head tilt): measure elbow/knee flexion ranges per frame against natural gait values (knee 0-65 deg, elbow 10-30 deg, no hyperextension, hinge axes within 5 deg of the pelvis lateral axis) and verify in front/profile/3-quarter renders.
4. Face: eyes (being placed in the real sockets; patch `eyes.patch` may still be missing), lids, brows, mouth; consider a jaw bone and blink (MPFB `default` rig has face bones; shape keys are possible).
5. Hair: several styles exist but still read as plates/wigs from some angles; improve volume, hairline and silhouette; check back and sides.
6. Women: bodies are the male-rig-warped MPFB female meshes (feet 27 cm, too big); fix proportions (foot length and hand size by body scale) before more shoe work.

### Patches status (all in `docs/plans/npc-patches/`, made against repo HEAD at the time; verify before applying)
- `crotch.patch`: removes leg-gap faces (0 bridges); agent warned its baseline (`out_v9`) did not reproduce from HEAD.
- `shoelen.patch`: shoe length = each foot's own heel-to-toe, about -5 mm; low value.
- `face.patch`: subtle expression via vertex colours; marginal. Faces still read sad (brows slope down), eyes sit ABOVE the real sockets in the committed GLB (visible black slit under the eyeball). The `eyes.patch` agent was still running when this was written.
- `fabric.patch`: +-1% grain, folds, shoulder fade, 3-vertex ribs; subtle.
- `loose.patch`: looser women's tops, modest effect.
- `hem_rejected_nosnap.patch`: DO NOT APPLY (opens holes). Hem notches come from `cut_z`'s 2 mm snap shading; alternative: push the hem inwards or add a thin dark band.
- City tuning of `js/world/npc3d.js` (real scale, cadence matched to stride, contact shadow, 40 walkers, `?npcnear=1&npcshot=k` debug) is in the working tree, uncommitted until you commit it.

### State of the repo
Last commit `1698e8f`. Uncommitted: `js/world/npc3d.js` city tuning and this doc. Run `git status` first.

## Update 2026-11-01 (textured pack)

### Pipeline
- Blender side runs on the pip `bpy` 5.2.3 module: `tools/npc/bl_run.py`.
- One-command rebuild: `tools/npc/rebuild.sh` (env: `NPC_OUT`, `NPC_UAL`, optional `MH_ASSETS`).
- UAL1 input comes from the Rigify-named glTF mirror; `tools/npc/ual_names.py` maps the clip and bone names.
- Textured shipping pack: `tools/npc/npc_mh_build.py`. The procedural pack (`npc_build.py`) still builds, and the runtime supports both.

### Review and bench tools
- `tools/npc/review.mjs` + `tools/npc/review.html`: modes `sheet`, `crowd`, `joints`; query params `?clip=` and `?tint=0`.
- `tools/npc/bench.mjs`: SwiftShader run. Relative numbers only, not comparable to a real GPU.

### Gait
- Retarget sets the swing foot against the shin (soft plantarflexion limit).
- Toes keep floor contact at push-off.
- 4 deg hip adduction: ankles 24 -> 12 cm apart, no knock-knees.
- Ranges: knee 2-62 deg, hip -10/+39 deg, elbow 18-28 deg.
- Three clips `NPC_Walk`, `NPC_Walk2`, `NPC_Walk3`; stance speeds 0.62 / 0.65 / 0.75 m/s at timeScale 1.

### Shipping pack
- Textured MakeHuman CC0 pack: 12 people (`NPC_A`..`NPC_L`).
- MPFB-fitted low-poly body proxy, suit, shoes, hair, brows, eyes. One joined mesh and one skeleton per person.
- About 6-11k triangles and about 7 draw calls per walker. Textures ship as WebP, pack about 6.3 MB.
- Logos are removed at build time from plain tees. At runtime, plain tees take a 16-colour palette; other tops get a muted hue shift; hair is recoloured.

### Runtime
- `js/world/npc3d.js` is opt-in via `?npc3d=1`.
- 32 walkers (16 below 700 px viewport width).
- `?npcnear=1` gives a pavement-level camera for close inspection.

### Licences
- MakeHuman system assets are CC0 (official pack page and file headers). Recorded in `ASSET_SOURCES.md`.

### Open items
- LOD for far walkers (there are no sprites any more).
- Measurement on a real GPU and on a real phone (current numbers are SwiftShader only).
- Lighthouse not run.
