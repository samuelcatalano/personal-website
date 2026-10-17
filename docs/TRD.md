# TRD — London Bus Portfolio

## Reference analysis (REA, 2026-10-15)
bridglabs.com: Vite + React 19 shell; lazy `World-*.js` chunk (~560 KB) with Three.js. Observed in the bundle: `WebGLRenderer`, `InstancedMesh`, `MeshLambertMaterial`, `Fog`, `DirectionalLight` + `HemisphereLight`, shadow maps. No scene images: the world is procedural voxels. Page ≈ 6.7k px tall; scroll drives the camera/vehicle; HTML side panel with sections; pixel font (Geist Pixel) for year signs; day/night theme via `data-theme`. Evidence: `ev_d6b53060938d1609e04d1323e36b0121cd24fab8cb54fab3edf6a245fc19cf40` (static, main bundle) plus runtime screenshots. We reproduce the *experience*, not the code or assets.

## Stack
- Static HTML/CSS + native ES modules. No bundler, no npm.
- `three@0.169.0` from `https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js` via importmap.
- Fonts: Google Fonts "Silkscreen" (pixel signs) + "Inter" (body).
- Hosting: GitHub Pages, `main` / root. All URLs relative.

## File layout
```
index.html            shell, importmap, panel markup skeleton, <canvas id="world">
css/style.css         tokens (day/night), panel, signs, mobile bottom sheet
js/content.js         export const content = { en: {...}, pt: {...} }, stops[]
js/main.js            boot: render panel, detect WebGL/reduced-motion, lazy import world
js/ui.js              panel render, nav, i18n toggle, theme toggle, active-stop highlight
js/scroll.js          scroll → progress (0..1) → active stop index; emits events
js/world/scene.js     renderer, camera, lights, fog, resize, render loop
js/world/voxel.js     helper: build InstancedMesh from list of {x,y,z,color}
js/world/city.js      ground, Thames, roads, generic buildings, trees, phone boxes
js/world/landmarks.js Big Ben, Tower Bridge, London Eye, Wembley arch, Heathrow
js/world/bus.js       red double-decker (voxels) + avatar in upper front window
js/world/route.js     CatmullRomCurve3 through stop points; bus + camera follow
tests/content.test.mjs node --test: every string has en+pt, stops chronological
assets/avatar.png     Memoji (pixel version generated from it)
```

## Interfaces
- `content.stops: Array<{ id, year, kind: 'hero'|'job'|'edu'|'stack'|'articles'|'repos'|'recs'|'contact', country: 'BR'|'UK', t: number /*0..1 on route*/ }>`; localized text in `content[lang][id]`.
- `scroll.js`: `onProgress(cb(progress, stopIndex))`.
- `world/scene.js`: `export async function createWorld(canvas, stops) → { setProgress(p), setTheme('day'|'night'), dispose() }`.
- `ui.js`: `renderPanel(lang)`, `setActiveStop(i)`, `setLang(lang)`, `setTheme(theme)`; persists lang/theme in `localStorage` (try/catch).

## Rendering
- All voxels are unit boxes in `InstancedMesh` grouped by material; target < 150 draw calls, < 60k instances.
- Lambert materials, flat colors; fog for depth; one directional light with shadows (shadow map 2048 desktop, off on mobile).
- DPR capped at 2 desktop, 1.5 mobile. Render loop only runs while progress or theme changes (idle = no frames), plus subtle ambient animation (Eye rotation, river shimmer) paused when tab hidden.
- Night theme: darker sky/fog, lit windows (emissive instances), bus headlights.

## Scroll model
Page height = `stops.length * 100vh`. `progress = scrollY / (scrollHeight - innerHeight)`. Bus position = `curve.getPointAt(ease(progress))`; camera = bus position + offset, `lookAt` bus, lerped per frame. Active stop = nearest `stop.t`. Year sign = HTML overlay projected from 3D point above the bus.

## Fallbacks
- No WebGL (`canvas.getContext('webgl2')` fails) → CSS gradient sky + static skyline SVG; panel unchanged.
- `prefers-reduced-motion` → no camera lerp, jump to stop poses; no ambient animation.
- Panel is real HTML with headings/lists/links; keyboard nav jumps between stops (`j/k`, arrows).

## Performance budget
Panel visible before world loads (world is a dynamic `import()`). Own JS code excluding three and the EN/PT copy in `js/content.js` < 68 KB (raised to 64 KB on 2026-10-16 and 68 KB on 2026-10-17; user decision 2026-10-16; content grows with the career). three module ~ 600 KB from CDN (cached).

## Testing
- `node --test tests/` content integrity.
- Manual matrix from CLAUDE.md; accesslint audit on `http://localhost:8000`.

## Privacy
Contact block only: samuel.catalano@gmail.com, linkedin.com/in/samuelcatalano, github.com/samuelcatalano. The CV PDF shipped in the repo must be a version without address/phone (Samuel to supply) or not linked.
