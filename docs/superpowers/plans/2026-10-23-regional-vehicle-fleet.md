# Regional Vehicle Fleet Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Work sequentially on implementation tasks; baseline measurement may run independently. No automatic commit or push.

**Goal:** Ten recognizable regional traffic GLBs, an improved player Mini, and exclusive player white/cream Mini paint.

**Architecture:** Reuse the current procedural fallbacks, cached GLTF loading, semantic finishes and merged ambient wheels. Regional model choice changes only visual representation and measured vehicle dimensions/light anchors; existing traffic rules remain.

**Tech Stack:** Blender Python, Three.js ES modules, existing browser-harness; no new dependencies.

**Spec:** ../specs/2026-10-23-regional-vehicle-fleet-design.md (approved).

## Global Constraints

- Original Blender geometry; supplied/manufacturer images are visual references only.
- Preserve routes, speeds, lanes, traffic population, following/crossing behavior, city, landmarks and all preexisting working-tree changes.
- Player Mini is the only white/cream-bodied Mini, including load-failure and pending-load states. Other vehicle models may be white.
- Do not modify approved cab, London bus, Glasgow bus or A330 GLBs/materials.
- No arbitrary triangle ceiling, new dependency, renderer redesign, global lighting change or new light system.
- All ten models must be testable; deterministic regional pools need not display all models at once.
- Normal-camera identity/day-night readability matters more than invisible detail.

## Review Focus

- Actual generation silhouettes/front/rear differ; avoid one stretched generic shell under ten names.
- Glass openings must expose a coherent cabin, not overlapping opaque shell faces or doubled panes.
- Asset authored dimensions/axes/wheels/light anchors agree with runtime metadata; no surprise scale corrections.
- Loading/fallback/disposal preserve behavior and safe shared-resource ownership.
- Exclusive Mini paint applies before, after and without a successful asset load.

### Task 1: Author the ten regional traffic assets

**Files:** tools/vehicles/regional-fleet/{build_fleet.py,render_fleet.py,README.md,models.json}; original POC GLBs in tools/vehicles/regional-fleet/poc/; assets/vehicles/{chevrolet-onix,hyundai-hb20,toyota-corolla,vw-t-cross,fiat-fiorino,ford-fiesta,vw-golf,vauxhall-corsa,nissan-qashqai,ford-transit-custom}.glb.

**Interface:** Each GLB has +X forward, +Y up, centered ground origin; measured metre dimensions and axle/beam coordinates in models.json. Semantic FleetBody/FleetGlass/FleetTrim/FleetRubber/FleetLights/FleetInterior materials, using vertex colors to distinguish light colors and trim where useful. Ambient wheels static/merged; no independent per-window objects.

- [x] Research manufacturer dimensions and multi-angle appearance for the exact generations in the spec; record primary URLs and distinguish stock evidence from sales rankings.
- [x] Build deterministic shared authoring primitives plus model-specific contours, greenhouse, front/rear lamps/grilles, wheelbase/arches, doors and minimal cabin. No photographic textures or external geometry.
- [x] Export and self-check finite geometry/normals, scale, ground, material/mesh counts and complete 360-degree coverage; preserve POC/production byte equality.
- [x] Render a compact fleet sheet plus front/side/rear diagnostics per model. Fix visible identity errors before runtime integration. Record measured metrics and task-only report/diff.

### Task 2: Improve Mini and integrate the regional fleet

**Files:** tools/vehicles/mini-cooper/build_mini.py and existing Mini production/POC GLBs; tools/vehicles/mini-cooper/README.md; js/world/vehicle-assets.js; js/world/ambient.js; tests/vehicles.browser.py and a focused tests/regional-fleet.browser.py; ASSET_SOURCES.md. Scene hook only if concretely necessary.

**Interface:** Consume Task 1 models.json and semantic GLBs. Extend the current cached asset loader; use existing traffic group/state objects, physical finishes, night convention and addBeams contract. Keep protected GLBs byte-identical.

- [x] Write and run focused failing contracts for all ten assets, dimensions/axes, shared loading/materials, regional selection and no ambient white/cream Mini in fallback or loaded states.
- [x] Inspect actual Mini GLB/generator; fix demonstrable pane/cabin/normal/fit/border defects and improve glazing/finish without changing the player's identity. Render day/night diagnostics.
- [x] Add cached fleet loading and shared semantic finish mapping. Preserve source resources across clones, keep procedural fallback on failure, and guard late loads after ambient/world disposal.
- [x] Assign regional models deterministically within the existing traffic population. Make every catalog model exercisable through focused tests, without new UI or modifying traffic rules. Measure actual length/beam anchors and preserve safety spacing.
- [x] Update palette assignments before fallback construction so player-only body paint never flashes on an ambient Mini. Keep protected vehicle material behavior unchanged.
- [x] Run focused asset/traffic contracts and syntax/diff checks; document provenance and final per-model metrics. Provide a task-only review package.

### Task 3: Verify normal scenes and measured cost

**Files:** docs/evidence/regional-vehicle-fleet/ for concise evidence; update relevant asset READMEs only, no redundant architecture documents.

- [x] Compare baseline/current normal hero, São Paulo, London and Glasgow; inspect traffic and Mini day/night with correct final assets loaded.
- [x] Run one paired representative desktop-high 1440×900 DPR1.5 and mobile-medium 375×812 DPR1 sample, warmup2s/sample10s, fixed tier. Report median/p95, calls, triangles and resource counts; do not infer improvement from scheduling noise.
- [x] Check realistic multi-instance traffic, zero console errors, protected hashes, related contracts and git diff --check. Investigate material regression; do not add LOD infrastructure preemptively.
- [x] Independent scoped review and root visual verdict. Preserve all unrelated pending changes; report limitations. No commit/push.
