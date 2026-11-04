# Realistic reference NPC — execution plan

> **2026-11-04: implementation stopped at the owner's request for handoff. NO-GO visual: the neck graft remains defective and runtime/master/rig candidates are not synchronized. Current authoritative status and preserved artifacts: [handoff](../handoffs/2026-11-04-realistic-npc.md). Historical experiments below are not completion claims.**

**Request:** owner-supplied character specification and five reference images, 2026-11-04. This authorizes one new NPC, not crowd replacement. No external image uploads or new dependency installation.

## Token and context policy

Inspect only character loading, local reconstruction tools and relevant budgets. Reuse `tools/npc`, MPFB and `npc3d.js`; no scene-engine rewrite. Research only reconstruction viability, export and animation compatibility using official sources. Delegate independent environment/runtime discovery and reusable skill work with named files. Persist decisions, gate evidence and next steps here; after compaction resume from this file and inspect only changed artifacts. Keep complete process logs and private photos outside the published repository. No token savings are claimed without measurements.

## Design and gates

1. **A — reference/environment:** all five images are visual truth. Observe broad torso, projected abdomen, relatively short legs, shaggy dark hair, full short beard, black loose Beatles tee, black trousers and light-soled black sneakers. Absolute dimensions, concealed anatomy and profile geometry are inferred. Do not derive identity from a generic head.
2. **B — master/likeness:** experiment with installed local Pixal3D SV, from separated-arm A-pose. Compare front/back/three-quarter views; use front portrait detail for local head refinement if necessary. Multiview weights are missing; do not claim joint reconstruction from five views. MPFB is a topology/rig fallback, not identity reconstruction. Reject generic or malformed likeness before downstream production.
3. **C/D/E — topology/rig/animation:** only after B passes, use existing humanoid rig conventions and locomotion assets; validate deformation, clothing clearance, grounded feet and natural transitions. Preserve master separately from retopology. LOD targets: 20–35k / 8–14k / 1.5–4k triangles; these are targets pending benchmark.
4. **F — integration:** add a single archetype through the existing GLB/mixer/crowd interfaces; metres, Y-up, +Z-forward. Preserve crowd identities, routes and all unrelated assets. Do not integrate a failed master.
5. **G — validation:** multi-view Blender and Three.js captures, directly related tests, controlled 0/1/10/30-character benchmark where supported. rAF cadence is not GPU timing; report coverage and limitations exactly.

## Files and responsibilities

- `.agents/skills/blender-realistic-npc/`: progressive references and real validators; independent task.
- `tools/npc/realistic/`: reproducible character-specific production scripts, only as needed.
- Private work/output: `/private/tmp/realistic-npc-20261104/`; no public source-photo copies.
- Final approved `.blend`/GLB and `ASSET_SOURCES.md`: only when generated and visually accepted; no placeholders.
- Runtime `js/world/npc3d.js` and directly relevant tests: only after asset gate B.

## Verified environment and findings

- Clean initial working tree. Blender 5.2.3 LTS, bundled Python 3.13.13; external Python 3.15.2. `bpy`, MPFB 2.0.18, Rigify and glTF exporter available.
- Blender headless startup crashed in Metal device detection inside the sandbox; the identical inspection succeeded with escalated execution. Use a separate background process, not the user's scene.
- AssetFurnace 0.5.4 at loopback: Pixal3D C++/GGML and BiRefNet-lite ready. Multi-view, hero upscaler and automatic rig weights missing. Do not silently download them. Owner authorized anonymous usage counts only; image upload remains prohibited.
- Current NPC pack uses Three 0.169.0, skeleton-safe clones, shared resources, per-walker mixers, distance throttling and visibility caps. No existing geometric NPC LOD/cache abstraction to pretend to reuse.
- Prior TRELLIS memory path is absent; a different TRELLIS installation was discovered but readiness is unverified. Prefer the verified installed Pixal3D path.

## Sources consulted

- [Pixal3D official implementation and MIT licence](https://github.com/TencentARC/Pixal3D): single/multiview reconstruction; generation is not likeness acceptance.
- [MPFB modelling and asset refitting](https://static.makehumancommunity.org/mpfb/docs/characters/modeling.html): target-based body/face changes; refit clothes after changing shape.
- [Blender 5.2 glTF export](https://docs.blender.org/manual/nl/5.2/addons/scene_gltf2.html): skinning/keyframe export, material compatibility and UV-related vertex splitting. English endpoint fetch failed.

## Execution state

- [x] Inspect references/specification, current rules, local tools and runtime.
- [ ] Generate a local candidate and inspect multi-view likeness (gate B).
- [ ] Complete reusable skill and run validator checks.
- [ ] Pass topology, rig and animation gates.
- [ ] Produce LODs and single-NPC integration.
- [ ] Run visual/runtime/performance checks and publish exact results here.

**Current status:** interrupted for Claude handoff. Owner accepted the third head's base likeness; the copied-eye trial has no final owner approval. LODs, rig and opt-in runtime pilot exist, but the neck join fails visual review. Different revisions are mixed across deliverables. No performance or production approval. See the handoff above before using any candidate.

**Latest owner correction:** abdomen projection was overstated. Reduce only the local forward shaping from 6.5 cm to 2 cm (4.5 cm less at the strongest point), preserving frontal width and the approved head/eyes. Apply the same correction to all LODs; compare matching side/three-quarter captures. Do not interpret the original body-type preservation requirement as permission to exaggerate the abdomen.

### Experiment ledger

- Pixal3D SV body, source A-pose, run `efae72778be242aabaebc731d1766e57`, seed 214401, res 1024, 8 steps: 951,298 triangles, one mesh, one material. Completed in 207.4 s (studio elapsed; model manifest 173.3 s). Initial crop run cancelled after detecting part of the neighbouring T-pose hand; corrected input used for the real experiment.
- Original-photo projection restored the front Beatles logo; adding a separately aligned back photograph removed the invented rear white glyph. This is texture projection onto single-view geometry, **not multiview reconstruction**. Back alignment has only two matched features and differing arm poses; it needs visual review. Final body candidate: 46,591,228 bytes, two texture images, no skin/animation.
- Body geometry/scale validator passed at staged/inferred 1.78 m: bounds 1.1423 × 0.4194 × 1.7800 m. This does not approve anatomy.
- Independent actual-image QA rejected the first master: narrowed nose, undefined eyelids, rigid beard edge, helmet-like hair, understated abdomen and invented back glyph. No topology/rig/integration work follows a failed likeness gate.
- Separate head from the higher-detail frontal crop, run `afe04eb3498841a889b7a5fedea314ba`: 999,686 triangles, 35,427,524 bytes, 489.9 s studio elapsed. Photo projection improved front identity but eyes remain soft, hair clumped and unseen posterior surfaces defective. Still unapproved.
- Owner explicitly authorized **Real-ESRGAN x4plus only**, 63.9 MB, BSD-3-Clause, via chat on 2026-11-04. Download initiated through AssetFurnace. Multiview and automatic rig weights remain unapproved/missing. Next experiment: square-pad the head crop without aspect distortion, upscale locally, rebuild the head, then compare to originals (upscaler detail is inferred).
- Reusable skill delivered with eight focused references and three validators. Skill frontmatter, script syntax and GLB self-tests passed (1 valid, 11 malformed rejected); valid/invalid Blender fixtures exercised. Scripts are structural checks, not visual or Khronos conformance certification.
- Cache-writing failure in local background-removal import resolved by placing Numba cache under the private work directory. No installed package was edited.
- Third head: locally upscaled source, run `80e6fda9327d4e888c5d86b8591a86e9`, 951,750 triangles, 527.7 s studio elapsed. Original (not upscaled) front pixels registered to the generator crop; posterior photograph projected with inferred camera. Owner accepted the resulting front render, except for dark/recessed eyes. This supersedes the primary agent's earlier aesthetic rejection of this version; do not regenerate the accepted likeness.
- Automatic first graft left an unacceptable collar plane. A surface-wrap/UV-transfer experiment produced facial artifacts and was rejected. A higher neck cut on the existing graft helper is being reviewed; only eye/neck integration fixes are in scope now.
- Eye review: owner rejected unequal iris size/convergent gaze in the first correction. Equal 8px iris guides and centered gaze were rendered. On the annotated 2026-11-04 14:06 screenshot, **screen-left (green) is explicitly approved**; preserve its conformal surface, colour, guide `(306,304)` and polygon. Only **screen-right (red)** may be refined, to remove fragmented scanned surface. `tools/npc/fix_reference_eyes.py` preserves all 661,642 head vertices; latest trial bridges only screen-right with a smooth shallow corneal patch. Do not regenerate face/hair/beard or reopen approved screen-left.
