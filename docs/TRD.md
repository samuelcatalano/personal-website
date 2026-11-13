# TRD — London Bus Portfolio

## Historical reference analysis (REA, 2026-10-15)

The recorded REA of bridglabs.com described a Vite + React 19 shell, a lazy Three.js world bundle, procedural voxel scenery, an InstancedMesh-based renderer, scroll-driven travel, an HTML content panel, year signs and a day/night theme. The archived note cites evidence ID `ev_d6b53060938d1609e04d1323e36b0121cd24fab8cb54fab3edf6a245fc19cf40` (static bundle and runtime screenshots). That evidence artifact is not in this repository, so these are retained as historical notes rather than independently re-verified claims. This project's implementation below is separate and does not reuse the reference code or assets.

## Stack and runtime

- Static HTML, CSS and native ES modules; no build step or npm.
- Three.js `0.169.0` is pinned in the import map in `index.html`, loaded from jsDelivr only when WebGL is available.
- Inter is loaded from Google Fonts. Big Ben clock faces use canvas textures; branded career plaques were removed by owner request on 2026-11-03. Existing transit and route signage remains unchanged; roadside year/section signs were already removed. Current visual state and final technical gate: [3D city architecture](architecture/3d-city.md).
- GitHub Pages serves the repository root. Site links and assets use relative paths.
- User-facing copy and journey stop data live in `js/content.js` in English and Portuguese.

## File layout

```text
index.html                 document shell, import map, accessible panel/nav skeleton, canvas and scroll track
css/style.css              layout, day/night tokens, responsive panel and WebGL fallback background
js/content.js              sections, stops, localized copy, articles, repos, stack and external links
js/main.js                 panel boot, stop-sized scroll track, WebGL detection, lazy world import and wiring
js/ui.js                   HTML panel rendering, section navigation, language/theme preferences and announcements
js/sound.js                intro bell and door hiss: a facade over the audio engine's direct output
js/audio/engine.js         one AudioContext: buses -> outside low-pass -> mix (Sound toggle) -> compressor -> master
js/audio/state.js          pure mix: scene facts in, voice gains / cutoffs / event rates out (node-tested)
js/audio/index.js          sound driver, lazy-loaded on first use: a 10 Hz tick that moves the voices to the state
js/audio/voices/{beds,shots}.js continuous voices (rain, wind, city beds, engine, plane, crowd) and one-shots (thunder, cars, bells, UI)
js/scroll.js               scroll progress, nearest stop, stop navigation positions and passive scroll listener
js/world/scene.js          renderer, route, scene assembly, camera framing, animation, resize and lifecycle
js/world/layout.js         route point spacing, landmark anchors, camera lifts, furniture anchors and seeded RNG
js/world/camera.js         shot definitions, eased shot blending, spring, approach and quality-tier selection
js/world/voxel.js          group box data into InstancedMesh batches by material/color
js/world/city.js           road, paving, Thames banks, street furniture, houses/trees and generation orchestration
js/world/blocks.js         procedural city blocks, skyline and protected building regions
js/world/real-city.js      data-driven procedural city buildings, batched by shared geometry/material
js/world/backdrop.js       deterministic distant neighborhoods, hills and extended ground behind all landmarks
js/world/parks.js          park and plaza geometry, landscaping and sign-clearance rules
js/world/landmarks.js      London landmarks, Heathrow plane, Glasgow and São Paulo builder orchestration
js/world/glasgow.js        George Square, City Chambers and Duke of Wellington statue with traffic cone
js/world/saopaulo.js       São Paulo landmarks and Brazil-era skyline
js/world/{bus,figure}.js   vehicles and closing figure
js/world/{people,crowd,npc3d}.js deterministic pedestrian plan and movement (people, crowd) and the 3D skinned walkers that draw it (npc3d)
js/world/{phone,houses}.js phone boxes and house geometry helpers
js/world/{sky,water,ambient,beams,textures,palette,post}.js environment, lighting effects, materials and postprocessing
tests/*.test.mjs           node:test checks for content, route/camera logic and procedural geometry
tests/*.browser.py         browser checks for scene, landmarks, vehicles, people, fallback and visual regressions
```

## Data and interfaces

- `stops` is the ordered route and panel index. Each item has `id`, `section`, `year`, and `country`; journey stops also have a `brand` monogram/color for the accessible HTML panel. The 11 branded 3D career plaques no longer render; their former anchors remain placement clearances without replacement objects. Stops do not carry a `t`: route progress is derived from array position. Localized panel copy is in `i18n[lang].sections` and `i18n[lang].stops`.
- `sectionStart(section)` returns the first stop index for a section. `SECTIONS` defines the section order used by navigation and content tests.
- `scroll.js` exports `progressFromScroll(scrollY, scrollHeight, viewport)`, `nearestStop(progress, count)`, `routeT(progress, count)`, `scrollYForStop(index, count, scrollHeight, viewport)` and `watchScroll(callback)`. The callback receives progress only.
- `initUI({ onGoto, onTheme })` renders the current panel and returns `{ theme, setActive(index) }`. Language and theme preferences use guarded `localStorage` access. Keyboard `j`/`k`, buttons and section links navigate by stop index.
- Sound is synthesized with native Web Audio (no audio files, no dependency) and is on by default. The `[data-sound]` button toggles it; the choice is stored as `localStorage.sound` (`on`/`off`, guarded), and a saved `off` wins over the default. The audio starts on the first click or key press of the visit, since browsers block audio before a gesture. `setEnabled(v)` (engine) fades the mix; `createSound({ stops, marks, progress, night, world })` (driver) returns `{ tick(), shutter(), state, live }`. The driver only reads: scroll progress, the theme, its own `createMood(stops)` instance and the world's `flash` getter (thunder). `audioState(input)` in `js/audio/state.js` is the single place levels are set; `VOICE_CAP` bounds one-shot voices per family. The intro's `ding()`/`hiss()` bypass the toggle and the compressor, as before.
- `createWorld(canvas, stops, { reducedMotion, onProgress })` asynchronously returns `{ setProgress(p), jump(p), setTheme(name), dispose() }`. `onProgress` receives current animated progress. `dispose()` cancels the frame, removes resize/visibility listeners, disconnects the resize observer and disposes the renderer.

## Scene and rendering

`main.js` computes route-point distance and sets the scroll track to `100vh + (route length / STOP_SPACING) * 100vh`; it paints the panel immediately, probes `webgl2`, then dynamically imports `world/scene.js`. A failed probe or world import adds `no-webgl`; the canvas is hidden and the CSS gradient remains behind the usable HTML panel. The fallback does not draw a static skyline.

`scene.js` builds a Catmull–Rom route from one world point per stop and assembles the city, landmarks, vehicles, people, water, sky and closing figure. Existing lot descriptors remain source of truth. The approved five archetypes use deterministic recipes, shared atlas/materials and chunk-local mass/trim/glass merging; compatible citywide rollout is complete. Supported townhouse geometry uses cached LOD0/1 and AABB hysteresis. Standard culling remains per pass. See [current architecture](architecture/3d-city.md) and [final observed budgets](architecture/rendering-budget.md) for counts, controls, preserved lots and release status; the old16-batch pilot is no longer the production path. Landmark modernization is dedicated geometry sharing existing surfaces; map topology, route and approved lot envelopes remain preserved.

The rear infill street stays behind z=-100 and clears the university, museum backdrop and countryside hills. `backdrop.js` generates staggered neighborhood rows behind z=-110, with simpler muted blocks farther away, green transitions around the countryside, and ground extending beyond the fog horizon. Its separate instanced group casts no shadows; tests cap it below 2,500 boxes. Fog fades from 240 to 900 m by day and 180 to 680 m by night, scaled by the regional mood. Raised scenery follows documented landmark and route clearances. Urban paving fills distant blocks while countryside bands remain green.

The scroll target is smoothed with a spring and the bus follows the resulting route parameter. Camera shots vary by content section; `blendShots` eases framing between adjacent stops, while `FRAME_LIFT` gives selected journey stops extra headroom. Desktop and mobile use different framing to account for the panel. Resize handling updates DPR (capped at 1.5 desktop and 1 mobile), viewport, shadow-map enablement and camera view offset. The renderer configures a 2048² directional shadow map and disables shadow rendering on mobile.

Postprocessing uses a render pass, bloom and output pass. Desktop starts at the high tier with GTAO and sun rays; mobile and reduced-motion start at medium, without those heavier passes. On desktop, an average below 40 FPS over a two-second sampling window lowers high to medium; the tier does not rise again. This is a quality fallback, not a guaranteed FPS target.

## Extending the route: Glasgow example

Add a stop to `content.js` in chronological order, with matching English and Portuguese panel copy, and add its stop-specific geometry through a landmark builder. Route points, scroll mapping, panel indices and camera interpolation derive from `stops.length`, so the extra stop extends the route and page track without per-stop `t` values. Stop landmarks are anchored by ID through `LANDMARKS` and `stopIndex`, rather than hard-coded route coordinates.

Glasgow follows the London OLM stop and precedes Tribal. `LANDMARKS.glasgow` anchors George Square at that route point; its builder receives the point and places the square/civic frontage on the far side of the road. `city.js` suppresses far-side houses whose footprints intersect the square's x/z bounds, while `blocks.js` includes its clearance rectangle among protected regions. Existing stop furniture is derived from the curve, and parks/plazas are checked against pedestrian loops and their clearances. This keeps the new landmark footprint free as the route is regenerated.

The camera continues to use the same section shots and smooth blend at the new stop. Glasgow has no special `FRAME_LIFT`, so it uses the normal follow framing. Geometry joins the existing color batches where possible; adding a stop does not add a new render pass. Keep the landmark modest and preserve instancing/clearance checks so route growth does not needlessly increase draw calls or crowd the camera. The current FPS tier mechanism can drop desktop postprocessing quality if measured performance falls below its threshold.

`building-kit.js` integrates the approved archetype builders, exact controls and compatible citywide chunks. Deterministic vertex data provides variation without per-building materials. Legacy renderer paths remain for genuine special lots and baseline tests; they are not disposable benchmark instrumentation. There are no new external assets. Existing road/path clearances remain; ambient traffic maps elapsed time through refined route-distance marks so speed stays consistent across short and long segments.

The city includes road and sidewalk surfaces, plaza details, landmarks, bridge/water, vehicles and streetscape geometry. Their dated implementation and validation records live in the architecture and rendering-budget documents. The bus and people intentionally remain stylized.

## Motion and accessibility behavior

- With `prefers-reduced-motion`, route progress snaps to the nearest stop, ambient time and pedestrian movement are paused, and the world starts on the medium postprocessing tier. The HTML panel and its navigation remain available.
- Without WebGL, or if dynamic world loading fails, the panel remains usable over a CSS gradient background. Sound then plays only the city bed and the weather (no vehicles, plane, crowd or bells).
- Sound is not motion: it stays available with `prefers-reduced-motion`. The audio context is suspended while the tab is hidden and while sound is off; any audio failure is silence, never a console error.
- The canvas is `aria-hidden`; content, links, controls and announcements are HTML. The panel is the source of truth; the 3D world is decorative.
- Mobile CSS turns the panel into a bottom sheet; the scene reframes its camera around the visible viewport region.

## Testing

- `node --test tests/` checks localized content integrity, route and camera math, palette, landmark geometry, pedestrian plans, park clearance and Glasgow footprint clearance.
- `tests/*.browser.py` exercise real WebGL rendering and browser behavior, including fallback, world assembly, camera, vehicles, people and visual regressions.
- `tests/building-kit.browser.py` checks five procedural archetypes, lot bounds and instancing; `tests/real-city.browser.py` checks ordinary plot integration, shared batches, road/path continuity and Tower Bridge clearance; `tests/citywide.browser.py` covers the production rollout and controls; `tests/vehicles.browser.py` checks consistent distance-mapped traffic speed.
- `tests/audio-state.test.mjs` checks the pure mix (gain bounds, region crossfade, day/night, tunnel, voice caps, thunder delay, door and bell cues). `tests/audio.browser.py` renders two reference scenes through the real graph on an `OfflineAudioContext` (not silent, peak below -1 dBFS), drives the Sound button with a real click, and rides the whole route to hear every family.
- The manual verification matrix is in `CLAUDE.md`: desktop and 375px mobile, day/night, EN/PT, WebGL disabled, reduced motion, no console errors and Lighthouse accessibility at least 95.

## Privacy

The contact UI exposes email, LinkedIn and GitHub only. Do not publish a home address or phone number. The current repository policy in `CLAUDE.md` says any shipped CV must be redacted or omitted.

Public-space pedestrians are 3D skinned walkers (assets/npc/npc_pack.glb) on bidirectional rectangular walks: 600 original pedestrians plus 400 spread over 17 additional corridors at Sé, MASP, the Thames, George Square and Wembley. Per-person insets, starting positions and speeds vary; raised paving sets the foot height. Population stays the same day and night; reduced motion pauses walking.

Tree rendering and placement have evolved since the historical inventory. Consult the owning tree modules and dated validation records before relying on old counts or asset details.
