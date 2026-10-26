# Wellington GLB Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the implementation and focused review. Steps use checkbox syntax for tracking.

**Goal:** Replace Wellington's primitive appearance with an original silhouette-focused GLB at the existing Glasgow camera.

**Architecture:** Author horse, rider, plinth and cone together in Blender; export a few merged semantic meshes. A cached GLTF load replaces only the existing statue visual, retaining its fallback, placement and disposal contract.

**Tech Stack:** Existing Blender Python, GLTFLoader, Three.js ES modules and browser-harness; no dependencies.

**Spec:** ../specs/2026-10-23-wellington-camera-normal-design.md (approved by user).

## Global Constraints

- Preserve existing world position, orientation, overall scale, pedestal footprint, paths and landmark sightlines.
- Change only Wellington and its asset integration; preserve all preexisting working-tree changes and other landmarks.
- Original geometry; supplied photos are visual references only.
- No new lights, costly render passes, dependencies, automatic commit or push.
- Normal Glasgow camera is the visual acceptance gate; close views only diagnose defects.

## Review Focus

- Both sides and rear must have complete anatomy and proper normals.
- Asset axes, ground origin and envelope must match the existing statue, not an eyeballed scene scale.
- Bronze must remain readable by day/night without emission or global lighting changes.
- A failed or late load must leave a working fallback and respect world disposal.
- Geometry/material ownership must avoid duplicate resources and unsafe shared disposal.

### Task 1: Author, integrate and verify the statue

**Files:** Create tools/landmarks/wellington/build_wellington.py, render_wellington.py, README.md and original POC GLB; assets/landmarks/wellington.glb; js/world/wellington-asset.js; tests/wellington.browser.py. Modify js/world/scene.js only at loading/disposal integration, and ASSET_SOURCES.md provenance. Keep createWellington() as fallback.

**Interfaces:** Consume createWellington(x,z)'s existing group and bounds. Produce a cached original GLB upgrade that preserves that group's transform and load-failure fallback; expose readiness/disposal only as needed by the existing scene lifecycle.

- [x] Inspect the supplied photos and current bounds; record axes, dimensions, target silhouette and resource ownership.
- [x] Add the focused asset/integration contract for orientation/bounds, shared loading, fallback and disposed-world late load; demonstrate failure before implementing the loader.
- [x] Build deterministic connected horse/rider anatomy, reins and cone with restrained bronze, stone and vertex-colored cone materials. Begin around 12k triangles; adjust only for visible silhouette gains.
- [x] Render front/side/rear/three-quarter standalone views, inspect and fix anatomy before production integration.
- [x] Export production GLB and implement the smallest cached loader/scene hook using existing Three.js APIs. Preserve all other landmark geometry.
- [x] Run the focused browser contract, syntax and git diff --check. Capture before/after normal Glasgow camera and a night smoke view; record triangles/renderables/materials and any real limitations.
- [x] Update provenance/asset README, provide a task-only diff and request independent focused review. No commit, full regression or broad benchmark.

## Completion

Implemented and focused-review GO, 2026-10-23. Evidence: `/private/tmp/wellington-pass/report.md`. Normal-camera day/night inspected; night bronze surface detail remains limited under the existing lighting. No broad regression, benchmark, commit or push.
