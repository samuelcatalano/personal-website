# TRD — London Bus Portfolio

## Historical reference analysis (REA, 2026-10-15)

The recorded REA of bridglabs.com described a Vite + React 19 shell, a lazy Three.js world bundle, procedural voxel scenery, an InstancedMesh-based renderer, scroll-driven travel, an HTML content panel, year signs and a day/night theme. The archived note cites evidence ID `ev_d6b53060938d1609e04d1323e36b0121cd24fab8cb54fab3edf6a245fc19cf40` (static bundle and runtime screenshots). That evidence artifact is not in this repository, so these are retained as historical notes rather than independently re-verified claims. This project's implementation below is separate and does not reuse the reference code or assets.

## Stack and runtime

- Static HTML, CSS and native ES modules; no build step or npm.
- Three.js `0.169.0` is pinned in the import map in `index.html`, loaded from jsDelivr only when WebGL is available.
- Inter is loaded from Google Fonts. Voxel year signs and the Big Ben clock faces are drawn to canvas textures.
- GitHub Pages serves the repository root. Site links and assets use relative paths.
- User-facing copy and journey stop data live in `js/content.js` in English and Portuguese.

## File layout

```text
index.html                 document shell, import map, accessible panel/nav skeleton, canvas and scroll track
css/style.css              layout, day/night tokens, responsive panel and WebGL fallback background
js/content.js              sections, stops, localized copy, articles, repos, stack and external links
js/main.js                 panel boot, stop-sized scroll track, WebGL detection, lazy world import and wiring
js/ui.js                   HTML panel rendering, section navigation, language/theme preferences and announcements
js/scroll.js               scroll progress, nearest stop, stop navigation positions and passive scroll listener
js/world/scene.js          renderer, route, scene assembly, camera framing, animation, resize and lifecycle
js/world/layout.js         route point spacing, landmark anchors, camera lifts, furniture anchors and seeded RNG
js/world/camera.js         shot definitions, eased shot blending, spring, approach and quality-tier selection
js/world/voxel.js          group box data into InstancedMesh batches by material/color
js/world/city.js           road, paving, Thames banks, street furniture, houses/trees and generation orchestration
js/world/blocks.js         procedural city blocks, skyline and protected building regions
js/world/backdrop.js       deterministic distant neighborhoods, hills and extended ground behind all landmarks
js/world/parks.js          park and plaza geometry, landscaping and sign-clearance rules
js/world/landmarks.js      London landmarks, Heathrow plane, Glasgow and São Paulo builder orchestration
js/world/glasgow.js        George Square, City Chambers and Duke of Wellington statue with traffic cone
js/world/saopaulo.js       São Paulo landmarks and Brazil-era skyline
js/world/{bus,figure}.js   vehicles and closing figure
js/world/{people,crowd,sprites}.js deterministic pedestrian plan, movement and atlas sprites
js/world/{signs,phone,houses}.js signs, phone boxes and house geometry helpers
js/world/{sky,water,ambient,beams,textures,palette,post}.js environment, lighting effects, materials and postprocessing
tests/*.test.mjs           node:test checks for content, route/camera logic and procedural geometry
tests/*.browser.py         browser checks for scene, landmarks, vehicles, people, fallback and visual regressions
```

## Data and interfaces

- `stops` is the ordered route and panel index. Each item has `id`, `section`, `year`, and `country`; journey stops also have a `brand` monogram/color. Stops do not carry a `t`: route progress is derived from array position. Localized panel copy is in `i18n[lang].sections` and `i18n[lang].stops`.
- `sectionStart(section)` returns the first stop index for a section. `SECTIONS` defines the section order used by navigation and content tests.
- `scroll.js` exports `progressFromScroll(scrollY, scrollHeight, viewport)`, `nearestStop(progress, count)`, `routeT(progress, count)`, `scrollYForStop(index, count, scrollHeight, viewport)` and `watchScroll(callback)`. The callback receives progress only.
- `initUI({ onGoto, onTheme })` renders the current panel and returns `{ theme, setActive(index) }`. Language and theme preferences use guarded `localStorage` access. Keyboard `j`/`k`, buttons and section links navigate by stop index.
- `createWorld(canvas, stops, { reducedMotion, onProgress })` asynchronously returns `{ setProgress(p), jump(p), setTheme(name), dispose() }`. `onProgress` receives current animated progress. `dispose()` cancels the frame, removes resize/visibility listeners, disconnects the resize observer and disposes the renderer.

## Scene and rendering

`main.js` sets the scroll track to `stops.length * 100vh`, paints the panel immediately, probes `webgl2`, then dynamically imports `world/scene.js`. A failed probe or world import adds `no-webgl`; the canvas is hidden and the CSS gradient remains behind the usable HTML panel. The fallback does not draw a static skyline.

`scene.js` builds a Catmull–Rom route from one world point per stop, then assembles city, landmarks, vehicles, people, water, signs, sky and a closing figure. `voxel.js` groups generated box records by color/material into instanced meshes; landmarks may also add purpose-built meshes and sprites. There is no declared draw-call or instance-count target in the implementation.

The rear infill street stays behind z=-100 and clears the university, museum backdrop and countryside hills. `backdrop.js` adds six denser staggered neighborhood rows behind z=-110, with simpler muted blocks farther away, green transitions around the countryside, and ground extending beyond the fog horizon. Its separate instanced group casts no shadows; tests cap it below 2,500 boxes. Fog fades from 240 to 900 m by day and 180 to 680 m by night, scaled by the regional mood. New raised scenery stays behind the backmost landmark footprint or entirely west of all route cameras and landmark footprints. The latter fills the starting-side neighborhood and a small corner shop without intersecting any landmark sightline. Urban paving fills the distant blocks while countryside bands remain green; paving tiles meet without coplanar overlap.

The scroll target is smoothed with a spring and the bus follows the resulting route parameter. Camera shots vary by content section; `blendShots` eases framing between adjacent stops, while `FRAME_LIFT` gives selected journey stops extra headroom. Desktop and mobile use different framing to account for the panel. Resize handling updates DPR (capped at 1.5 desktop and 1 mobile), viewport, shadow-map enablement and camera view offset. The renderer uses a 1024² directional shadow map on desktop and disables shadows on mobile.

Postprocessing uses a render pass, bloom and output pass. Desktop starts at the high tier with GTAO and sun rays; mobile and reduced-motion start at medium, without those heavier passes. On desktop, an average below 40 FPS over a two-second sampling window lowers high to medium; the tier does not rise again. This is a quality fallback, not a guaranteed FPS target.

## Extending the route: Glasgow example

Add a stop to `content.js` in chronological order, with matching English and Portuguese panel copy, and add its stop-specific geometry through a landmark builder. Route points, scroll mapping, panel indices and camera interpolation derive from `stops.length`, so the extra stop extends the route and page track without per-stop `t` values. Stop landmarks are anchored by ID through `LANDMARKS` and `stopIndex`, rather than hard-coded route coordinates.

Glasgow follows the London OLM stop and precedes Tribal. `LANDMARKS.glasgow` anchors George Square at that route point; its builder receives the point and places the square/civic frontage on the far side of the road. `city.js` suppresses far-side houses whose footprints intersect the square's x/z bounds, while `blocks.js` includes its clearance rectangle among protected regions. Existing stop furniture is derived from the curve, and parks/plazas are checked against pedestrian loops and their clearances. This keeps the new landmark footprint free as the route is regenerated.

The camera continues to use the same section shots and smooth blend at the new stop. Glasgow has no special `FRAME_LIFT`, so it uses the normal follow framing. Geometry joins the existing color batches where possible; adding a stop does not add a new render pass. Keep the landmark modest and preserve instancing/clearance checks so route growth does not needlessly increase draw calls or crowd the camera. The current FPS tier mechanism can drop desktop postprocessing quality if measured performance falls below its threshold.

## Motion and accessibility behavior

- With `prefers-reduced-motion`, route progress snaps to the nearest stop, ambient time and pedestrian movement are paused, and the world starts on the medium postprocessing tier. The HTML panel and its navigation remain available.
- Without WebGL, or if dynamic world loading fails, the panel remains usable over a CSS gradient background.
- The canvas is `aria-hidden`; content, links, controls and announcements are HTML. The panel is the source of truth; the 3D world is decorative.
- Mobile CSS turns the panel into a bottom sheet; the scene reframes its camera around the visible viewport region.

## Testing

- `node --test tests/` checks localized content integrity, route and camera math, palette, landmark geometry, pedestrian plans, park clearance and Glasgow footprint clearance.
- `tests/*.browser.py` exercise real WebGL rendering and browser behavior, including fallback, world assembly, camera, vehicles, people and visual regressions.
- The manual verification matrix is in `CLAUDE.md`: desktop and 375px mobile, day/night, EN/PT, WebGL disabled, reduced motion, no console errors and Lighthouse accessibility at least 95.

## Privacy

The contact UI exposes email, LinkedIn and GitHub only. Do not publish a home address or phone number. The current repository policy in `CLAUDE.md` says any shipped CV must be redacted or omitted.

Public-space pedestrians reuse the existing sprite atlas and bidirectional rectangular walks: 600 original pedestrians plus 400 spread over 17 additional corridors at Sé, MASP, the Thames, George Square and Wembley. Per-person insets, starting positions and speeds vary; raised paving sets the foot height. Population stays the same day and night; reduced motion pauses walking.

All 160 city, park, countryside and George Square trees use only the two rounded variants in `assets/trees/park-atlas.png`; the pine variants are unused. `trees.js` renders one instanced batch with a lit alpha-tested material and matching shadow material. An optional tree callback lets city and landmark builders preserve positions and RNG streams while collecting tree placements. Deterministic height variation stays below the old heights (also capped at 4.4 m including padding); crown width never exceeds the original footprint. If the image cannot load, scene assembly restores voxel trees.
