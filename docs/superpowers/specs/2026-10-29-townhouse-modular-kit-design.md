# Townhouse Modular Kit — Design

**Status:** Draft for owner approval. The owner selected merging modules into the existing three buckets.

## Intent

Add authored depth and reusable facade details to the existing townhouse system as the first Blender modular-kit pilot, while preserving the approved city layout and visual language.

## Goals

- Build reusable Blender modules for townhouse windows, doors/storefronts, cornices/string courses, and roof details.
- Start with 6–8 window variants, 6 door/storefront variants, 5 cornice variants, and 5 roof variants; preserve visual quality even if that requires more triangles than current budgets suggest.
- Integrate the kit only into the existing nine-lot, two-chunk townhouse experiment. Keep the three-lot benchmark/control slice unchanged.
- Merge transformed module geometry into the existing `mass`, `trim`, and `glass` chunk buckets before rendering.
- Keep plot descriptors, footprints, heights, bay assignment, palettes, local deterministic variation, current LOD policy, and the existing 111/129 m hysteresis.
- Preserve the procedural townhouse path as the fallback if the authored kit cannot load.

## Non-goals and anti-goals

- No citywide townhouse rollout, new archetypes, map/route/lot changes, or changes to landmarks, roads, pedestrians, lighting, water, or public realm.
- No new render buckets, LOD level, LOD thresholds, external model, dependency, or shipped-site build step.
- Do not redesign the approved townhouse silhouette, facade rhythm, palette, or window/door placement.
- Do not move or delete raw GLBs or change the asset-source policy.

## Constraints

- Follow the validated three-bucket architecture and existing asset pipeline; Blender assets are development inputs, runtime assets remain relative-path GLBs.
- Keep current geometry and procedural recipes available for fallback and for the untouched control slice.
- The handoff says no tests or deployment unless asked. Scope/visual approval remains a separate gate from technical validation.

## Approaches

1. **Merge modules into `mass`/`trim`/`glass` — selected.** Reuse the current chunk path and keep renderable count bounded. GPU-side reuse is lower than instancing, but the authored kit still avoids duplicating modeling work and preserves the established batching model.
2. **Instance each module/material per chunk.** Reuses source geometry more directly, but can add draw calls and conflicts with the validated three-renderable chunk structure. Not selected.

## Proposed implementation

Use a single authored townhouse kit with named module variants and semantic roles. Place variants in the nine existing experiment lots using the current deterministic recipe/hash. Transform their meshes into each chunk's local coordinates, apply existing palette/emissive conventions, and merge into the three existing buckets. LOD0 receives the authored modules; LOD1 removes fine trim while preserving silhouette and facade rhythm; far appearance stays on the current procedural path. If loading or assembly fails, keep the procedural experiment visible.

Record a desktop before/after visual comparison and geometry/draw-call measurements for the selected merge path. GO requires facade depth to read at the default camera, draw calls no more than 10% above the control, and the approved layout, silhouette and facade rhythm to remain intact. There is no triangle-count gate: prioritize visible quality, then optimize geometry after the look is accepted without degrading it. Do not compare instancing in this phase because the owner chose merging. Do not run mobile checks.

## Remaining builder calls

- Exact Blender object naming and export layout for module variants.
- How the existing runtime can adopt the GLB without delaying `createCityBuildings`; choose the smallest compatible loading/fallback path.
- Which current two townhouse recipes cover the pilot and which module variants are required by their existing bays.
