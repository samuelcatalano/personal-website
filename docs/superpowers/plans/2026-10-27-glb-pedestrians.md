# GLB Pedestrians Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic sprite people with varied, walking 3D people derived from the user's four GLBs, preserving the existing crowd.

**Architecture:** Prepare normalized, optimized source-derived assets with semantic tint regions, two hairstyles and a usable walk cycle. Render those assets with shared, instanced geometry and GPU animation, using the current crowd plan and unchanged motion equations; keep the current sprite system as a failure fallback. Validate an eight-person sample before enabling the full crowd.

**Tech Stack:** Existing pinned Three.js ES modules, GLTFLoader, local Blender/Python, browser-harness, Node test runner. No npm, runtime build or new dependency.

**Spec:** `docs/superpowers/specs/2026-10-27-glb-pedestrians-design.md` (approved 2026-10-27).

## Global Constraints

- Preservar os 1.000 registros do plano atual, posições, alturas de piso, rotas, direções e velocidades.
- Preservar mapa, ônibus, veículos, arquitetura, iluminação, personagens especiais e conteúdo.
- População e diversidade continuam determinísticas; não consumir o RNG global da cidade.
- `prefers-reduced-motion` mantém todas as pessoas paradas. O HTML continua utilizável sem WebGL.
- Nunca sobrescrever os quatro originais. Derivados e preparação reproduzível ficam em `assets/people/` e `tools/people/`; os originais não são carregados pelo site.
- Meta inicial proposta pelo coordenador: até 8 mil triângulos no nível próximo por pessoa e até 1 mil no nível distante; até 12 MiB de download total dos quatro derivados, contando texturas.
- Oferecer pelo menos três combinações de cores por base e dois penteados geometricamente distintos por base. Penteado deve mudar silhueta, não somente cor.
- Compartilhar geometrias/texturas e materiais por combinação finita; evitar material/texture clone por pessoa.
- Não aceitar personagens rígidos deslizando, membros atravessando corpo ou corpo balançando inteiro como substituto de caminhada.
- Não adicionar engine, gerenciador de pacotes ou build do site. URLs relativas, Three.js existente, cópia visível em `js/content.js`, EN/PT.
- Nenhum trabalho anterior guardado no stash/branch de segurança será reaplicado automaticamente.
- User explicitly chose current branch; do not create a worktree, publish, push, merge or add originals to commits. Sol orchestrates; use Luna for mechanical tasks and Terra for engineering/review.

## Review Focus

- Missing/corrupt/partially loaded GLBs: no unhandled rejection, no double crowd, functional fallback; test Task 2.
- Disposal during asynchronous loading: no scene resurrection or leaked owned resources; test Task 2.
- Hair/garment tint boundaries: face, hands, eyes and shoes retain intended source appearance; contact sheets and mask checks Task 1.
- Walk/LOD boundaries and reduced motion: grounded feet, stable scale/orientation and frozen animation; tests/captures Task 2.
- Population/performance camouflage: unchanged seeded positions/count and fixed tier comparisons, including initialization; validation Task 3.

## File Structure

- `tools/people/prepare_people.py`: reproducible offline preparation from the four originals; local Blender, no new package.
- `assets/people/{casual-stride,cozy-sherpa,midnight-casual,navy-jacket}.glb` and `assets/people/models.json`: four prepared assets and machine-readable contract/evidence. No runtime reference to source GLBs.
- `js/world/people-assets.js`: cached asset loading and shared animation preparation.
- `js/world/people-models.js`: instanced mesh/material animation, semantic tint and LOD rendering.
- `js/world/people-motion.js`: existing motion equations extracted without changing behavior.
- `js/world/people-sprites.js`: existing sprite implementation retained as fallback using shared motion.
- `js/world/people.js`: facade selecting ready 3D renderer/fallback and updating existing population.
- `js/world/scene.js`: minimal teardown integration.
- Focused asset/data/renderer tests and `tests/people.browser.py`; one sample inspection HTML under `tools/people/` if needed for reproducible visual QA, no product UI.
- `ASSET_SOURCES.md`, affected TRD lines and a short measured validation record.

### Task 1: Prepare and verify the four source-derived models

**Files:** Create `tools/people/prepare_people.py`, `assets/people/*.glb`, `assets/people/models.json`, `tests/people-assets.test.mjs`; update only pedestrian attribution in `ASSET_SOURCES.md`. Optional sample-only viewer `tools/people/preview.html`.

**Interfaces:**
- Consumes exact originals `assets/glb/{casual_stride,cozy_cream_sherpa_jacket_look,midnight_casual,navy_jacket_portrait}.glb`.
- Produces manifest entries with `id`, `path` (relative to repo root), `source`, `author`, `license`, `sex`, `height`, `stride` (metres per walk cycle), `clip` and `nodes` mapping `near`/`far` to two hairstyle mesh names each. Four IDs in filename order above; determine sex from visual inspection, not filename guesses.
- Prepared GLBs use metres, feet at Y=0, front +Z, the same base height across that base's LOD/hairstyles. Include matching skeleton/skin data and loopable `Walk` clip (or report a proposed equivalent GPU-deformation representation before departing from this interface). A semantic per-vertex `_TINT` vec3 carries top/bottom/hair mask weights, nonnegative sum <=1; unmasked face/hands/shoes use zero. GLTFLoader exposes it as `_tint`. Normals and UVs retained. Hairstyles alter silhouette while retaining the supplied character.
- Runtime will share frame-sampled bone transforms for each base and animate instances by independent accumulated travel phase. Do not write runtime modules in this task.

- [ ] **Step 1:** Add failing asset contract tests, run `node --test tests/people-assets.test.mjs`, record RED. Assert four files/manifest, <=12*1024*1024 total runtime bytes, per-node near <=8000/far <=1000 triangles, finite normalized bounds/feet, semantic masks and walk skin/clip, matching skeleton and textures across variants, distinct hairstyle geometry. Validate source SHA256 before/after preparation.
- [ ] **Step 2:** Diagnose Blender batch crash using systematic-debugging; `/opt/homebrew/bin/blender` 5.2.3 LTS exists. Use factory startup/temp config/thread control or justified sandbox escalation before proposing any install. Inspect source appearance from multiple angles first.
- [ ] **Step 3:** Implement reproducible normalization, simplification, tint segmentation, hairstyle edits, and walk preparation. UV/texture-aware decimation must preserve recognizable source detail. Mesh/texture preparation cannot be passed on metadata-only assertions; inspect actual renders. Never overwrite or silently replace originals with procedural bodies.
- [ ] **Step 4:** Run focused asset tests and render eight sample figures (four bases x two hairstyles), with at least three garment/hair palettes per base in a contact sheet. Check faces/hands/shoes and front/back/side views. Capture at realistic site scale and a walk contact strip. Record shortcomings honestly; unresolved visible defects return DONE_WITH_CONCERNS.
- [ ] **Step 5:** Record source URLs, CC-BY-4.0 credit, modifications and limited user-approved exception to Sketchfab policy in asset documentation. Use embedded source evidence; do not browse/download more Sketchfab models. Commit only this task's prepared assets/scripts/tests/docs, not originals. Full report includes asset contract, measurements, exact commands and artifact paths.

### Task 2: Integrate efficient 3D people with existing crowd behavior

**Files:** Create `js/world/people-assets.js`, `people-models.js`, `people-motion.js`, `people-sprites.js`; modify `people.js`, teardown in `scene.js`, `tests/people.browser.py`; add `tests/people-motion.test.mjs` and narrowly focused pure variant/LOD tests as needed. Optional sample viewer improvements under `tools/people/`.

**Interfaces:**
- Consumes Task 1 manifest/GLB contract. `people-assets.js` exports `loadPeopleAssets()` resolving shared prepared sources, null on asset failure (no unhandled rejection).
- `people-motion.js` exports `createPeopleMotion({curve,pts,stops,plan})` with `state` records and `update(dt)` plus access to current position/facing/phase. Reuse current route arc-length, lane/ramp-mouth and rectangle equations verbatim; no path redesign.
- `people-models.js` exports `createPeopleModels(scene, sources, plan, motion, {reducedMotion=false})` -> `{ meshes, update(dt,camPos), dispose() }`.
- `people.js` preserves `createPeople(scene,{curve,pts,stops,reducedMotion=false,...})` -> `{count, meshes, ready, update(dt,camPos), dispose()}`. `meshes` must reflect the active representation; `ready` resolves a measurable status and never rejects on asset failure. Preserve `hd` compatibility for sprite fallback. A test-only existing-pattern option may explicitly select baseline sprites for A/B; no product-facing toggle.
- Motion integration occurs once per update; fallback adoption neither resets progress nor creates two populations. Existing caller in scene remains synchronous, with async `ready` internal. Reduced motion culls by camera while freezing positions and poses.

- [ ] **Step 1:** Add tests proving motion equivalence at fixed seeded initial state and several dt values, including ramp turnaround, both rectangle directions, y=.02/.08/.21 and reduced motion. Browser tests cover 1000 logical people, all four bases, two hairstyles/base, >=3 color combinations/base, visible real 3D geometry and readiness.
- [ ] **Step 2:** Extract motion and fallback without behavior changes, then implement cached loading with owned-resource cleanup on failed/late loads. Add deterministic variant assignment from existing look/index without changing crowd RNG. Preserve genders/proportions; children keep existing height rather than becoming full-size adults.
- [ ] **Step 3:** Implement instanced, shared GPU walk animation per base, per-instance top/bottom/hair tint masks, normalized scaling/facing, existing soft shadows, standard bounded frustum culling and near/far LOD hysteresis. Initial distances: near enter <30m, leave >40m; max visibility 140m as current renderer. Ensure shader deformation/normals are correct in color and any participating auxiliary pass. No per-person material/geometry clones or AnimationMixer updates on 1000 actors per frame.
- [ ] **Step 4:** Demonstrate eight-person sample before full population. Inspect walk at consecutive frames and all sides; verify planted-foot travel, no limb tearing/occlusion artifacts and hairstyle/tint independence. Then enable the existing full plan only if sample passes.
- [ ] **Step 5:** Run focused Node/browser tests including failed load, corrupt/partial load, disposal-before-ready, reinitialization, LOD boundary movement, camera movement under reduced motion, and no double-visible fallback. Add `people.dispose()` to scene teardown. Run full Node suite once before commit. Commit only runtime/tests needed for this task and report all checks/captures/limitations.

### Task 3: Validate the expanded crowd and update technical evidence

**Files:** Update affected pedestrian lines in `docs/TRD.md`, create `docs/audits/2026-10-27-glb-pedestrians.md`; only fix already touched implementation/test files if validation exposes concrete defects, reporting every such change.

**Interfaces:** Consumes active `createPeople` runtime, test-only sprite baseline selection and prepared sample viewer; produces measured release evidence. No new renderer behavior, UI or dependencies in this task.

- [ ] **Step 1:** Use browser-harness only for browser control; read its supplied skill. Keep local preview on localhost. Run full Node regression and relevant actual WebGL pedestrian tests. Check no new console errors.
- [ ] **Step 2:** Capture desktop and 375px mobile, day/night, EN/PT, WebGL disabled, reduced motion; verify content usability and pedestrian visual behavior. Include close eight-person sample and São Paulo/London/Wembley in actual scene. No physical-mobile or accessibility score claim without measurement.
- [ ] **Step 3:** Compare unchanged baseline vs 3D with same seeded scene, camera, tier, DPR and viewport. Desktop 1440x900 DPR1.5 high; emulated mobile 375x812 DPR1 medium. Warm 2s, sample 10s, three runs per affected day/night scenario. Record median/p95/run variation, init/asset load time, visible people, draw calls, triangles, texture payload. Limits: paired p95 <=baseline+1ms desktop, +2ms mobile. Preserve unfavorable/outlier results; no adaptive downgrade gain.
- [ ] **Step 4:** Fix concrete defects and rerun only affected checks; don't claim GO for performance failures or missing checks. Update TRD and compact audit with commands/evidence/captures, source asset attribution, known limits, GO/NO-GO. Verify documentary links and `git diff --check`. Commit scoped validation/docs. No push or merge.
