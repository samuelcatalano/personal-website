# Weather art-direction implementation

**Authorization:** implement all seven recommendations from the current chat. No map, architecture, route, UI-layout, dependency or deployment changes.

**Direction:** restrained cinematic miniature city. One coherent regional atmosphere; readable hero vehicle; smaller framed astros; directional, layered clouds; differentiated rain and wet materials.

## Tasks

- [x] Weather states: preserve regional rain probability and clear/rain overrides; add cloudy/drizzle overrides and varied regional showers. Smooth climate, palette and wind transitions at different rates; reduced motion snaps to a static state. Node tests first.
- [x] Sky: continuous horizon gradient and diffuse overcast opening; resize/reframe sun and moon against header bounds; procedural fixed gibbous phase. Draw astros/stars behind alpha clouds for local occlusion. Directional cloud shading and less uniform silhouettes, retaining existing batches. Pure-math and browser checks.
- [x] Coherence: derive a shared bounded positive-elevation key/reflection direction from the visible astro azimuth. Recompute the existing shadow texel basis, preserving its snapping. Camera-composed astros are artistic, not astronomical simulation.
- [x] Rain: shorter, thinner depth-dependent drops, intensity-dependent density, bounded gusts, local lamp/headlight visibility. Reuse the existing single batch and tier limits.
- [x] Wet city: vary wetness/roughness by surface and local basins; break reflections with impact normals, use light streaks and gradual drying. Share a small generated roof/deck shelter field to suppress drops/ground impacts beneath cover; no collision engine or extra render pass. Approximate roof envelopes require visual checks.
- [x] Verify: related Node tests then full regression; sky/rain/wet/resource browser tests; three cities day/night, clear/drizzle/rain and 375px/reduced-motion checks. Compare local baseline/after resource and frame samples with pinned tier. Preserve evidence and report measurement limits.

## Interfaces and files

- `weather.js`: immutable regional profiles and existing wetness/lightning contracts.
- `mood.js`: reused output and optional runtime delta for gradual transitions; default delta keeps deterministic inspection/tests.
- `weather-math.js`: pure moon shading, celestial visibility/framing and shelter raster math, tested without WebGL.
- `weather-cover.js`: one shared data texture and uniforms for exposed precipitation/surfaces.
- `sky.js`, `rain.js`, `wet-surfaces.js`, `water.js`: existing shaders/resources; preserve teardown and reduced motion.
- `scene.js`: viewport, shared cover ownership, temporal mood and key-light basis integration.
- `index.html`: regenerate preload list only if the import graph changes.

**Review focus:** astros clear header; dark side of moon stays dim; heavy overcast hides astros; partial clouds actually occlude them; shadows never light from below; wet maps do not leak across scenes; rain/cover sampling is bounded; fast navigation and quality changes do not reset drops or leak resources.

## Outcome

Implemented all seven recommendations. Local functional/visual checks passed; performance remains unapproved because the comparison was disturbed and indicates a possible slowdown. See [audit](../../audits/2026-11-12-weather-art-direction.md). No deployment performed.
