# Stylized 3D City System — Design (2026-10-19)

## Goal

Replace the voxel appearance across the portfolio city with a coherent, polished low/mid-poly architectural visualization in the existing real-time Three.js scene. Preserve the scroll-driven bus journey, recognizable map, landmarks, foreground avenue, river, public spaces, and pedestrian paths. Keep the bus and people stylized and make vehicles low-poly; never add buildings or trees in front of landmarks.

The supplied city image is a quality and art-direction reference, not a scene to copy or a request for a static background. The implementation remains actual geometry, lighting, and materials in the running app.

## Existing system and reuse

`scene.js` owns the Three.js scene, camera, shadows, route animation, and async world assembly. `city.js`, `blocks.js`, `parks.js`, and the landmark modules generate the established map through the existing box callback and seeded layout. `layout.js` owns route and protected areas. Reuse these coordinates, callbacks, Three.js version, palette, seeded placement, pedestrian animation, and quality tiers. Keep the HTML panel usable without WebGL and with reduced motion.

Generic buildings currently become repeated `BoxGeometry` instances in `voxel.js`; a prior three-model CC0 pilot is too small and visually weak to serve as the target. Replace that pilot with a procedural architectural renderer, then roll the same system across generic lots after the benchmark is verified. Keep landmarks independently recognizable and protected.

## Design

Use data-driven lot descriptors (`kind`, position, footprint, height, deterministic style) and a small procedural building renderer. The renderer supports five archetypes: terrace, shop, residential mid-rise, glass office, and stepped tower. The current protected benchmark has three safe distinct source lots, so its first pass uses three types rather than adding buildings into the river or landmark sightlines. Reuse unit geometries and shared materials; instance facade panes, frames, and repeated details. Distinguish silhouettes with roof profiles, setbacks, cornices, balconies, storefronts, mullions, and restrained rooftop equipment. Geometry must stay inside the source lot bounds.

The first benchmark is one existing generic London block/plaza selected from generated footprints. Keep its road, curbs, continuous sidewalks, paths, and street furniture. Preserve all landmarks and camera sightlines. Remove the pilot GLB loading and fallback path so the rendered result tests the procedural system itself. Keep bus and pedestrians as-is; a later phase can modernize cars.

No new rendering framework, package, external runtime asset, or copyrighted game asset. If external assets are later useful, verify license and record provenance; prefer CC0. Keep URLs relative.

## Rollout

1. Replace the weak three-model pilot with five procedural building archetypes and verify lot bounds and landmark/path clearance.
2. Inspect the benchmark in the running browser at desktop/mobile and day/night; tune only the shared geometry/material system.
3. Migrate generic city buildings to the same renderer, then improve roads, plaza surfaces, vegetation, bridge/river, vehicles, and distant skyline in measured phases.
4. Keep each phase within real-time budgets and retain WebGL-off, reduced-motion, responsive, EN/PT, and day/night behavior.

## Acceptance for the first benchmark

- Three distinct procedural archetypes replace the selected source buildings; the shared renderer supports all five required archetypes.
- Shared geometry/materials keep repeated facade details instanced; there are no per-window draw calls.
- Each building stays within its assigned footprint and height, with ground at y=0.
- Existing road and pedestrian corridors remain continuous; no benchmark building enters a protected landmark or route view.
- The browser scene visibly uses detailed architectural geometry rather than the old voxel box style; no external image is used as a substitute.
- `node --test tests/`, browser tests, and the AGENTS.md desktop/mobile, day/night, EN/PT, WebGL-off, reduced-motion, console, and Lighthouse accessibility checks are run and reported.

## Known trade-offs

The first phase is stylized architectural 3D, not photorealism. Detailed geometry is confined to the benchmark until its visual quality and frame cost are checked; citywide conversion and broader road/vehicle polish remain later phases.
