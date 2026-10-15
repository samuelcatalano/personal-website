# London Bus Portfolio v2 — Polish Design (approved 2026-10-15)

Builds on `2026-10-15-london-bus-portfolio-design.md`. Same constraints (`CLAUDE.md`, `docs/TRD.md`): static GitHub Pages, no build, `three@0.169.0` min via importmap, all copy in `js/content.js` (en + pt), no home address/phone, works without WebGL and with reduced motion.

## Why
Owner feedback: v1 works but feels much simpler than bridglabs.com. REA comparison (`ev_ff915cae…`, application graphs share no entities) plus reading Bridg's own world code showed the gap is in rendering style, camera direction, ambient life and day/night, not in content.

## Observed in the reference (bridglabs.com `World-*.js`, static reading)
- Renders at 1/3 resolution (1/2 on narrow screens), `antialias:false`, `setPixelRatio(1)` → chunky pixel-art upscale.
- Per-section camera shots (hero establishing shot → vehicle follow → closing shot); transitions interpolate yaw/pitch with an arc lift; scroll progress smoothed by a critically damped spring (smooth time 0.32 s).
- Ambient life: instanced traffic moving along lanes, boats bobbing (`sin`), water shader with deep/shallow/glint colours and time quantised to 8 steps/s, blinking light.
- Night factor eased at ~1.4/s driving colours and emissive intensities.
- Canvas-painted sprite signs in-world; active sign scaled up. A person figure placed at a 3D anchor in the closing shot.
- Panel shows company logos next to journey entries.
We reproduce the experience with our own code; no code or assets are copied.

## Decisions
| Topic | Decision | Rejected |
|---|---|---|
| Approach | Evolve current modules; add focused new ones | Full rewrite; EffectComposer post-processing |
| Pixel look | Render buffer at `innerWidth/3 × innerHeight/3` (≥768px) or `/2` (mobile), `setPixelRatio(1)`, `antialias:false`, CSS `image-rendering: pixelated` on `#world` | RenderPixelatedPass |
| Tone | `ACESFilmicToneMapping`, `SRGBColorSpace` output | — |
| Logos | Pixel monograms generated from content (initials + brand colour) | Official logo files; scraped logos |
| Figure | Memoji head (existing `assets/avatar.png` sprite) on a voxel body, standing at the Wembley stop | Full-body Memoji image |
| Scope | All four groups: pixel look + camera, living city, smooth day/night, richer panel & signs | — |

## Units (new or changed)
- `js/world/camera.js` (new). Pure math, no three import, so node can test it. `shotFor(sectionIndex, busPos, viewport) → {position:[x,y,z], target:[x,y,z]}` and `blendShots(a, b, t, arcLift) → shot`. The blend interpolates yaw/pitch/length, plus a `sin(πt)·arcLift` height bump. `spring(state, target, dt, smoothTime) → state` is a critically damped spring.
- `js/world/sky.js` (new). `createSky(scene) → { update(night 0..1) }`. It owns the background, fog, hemi/sun intensities, and a stars `Points` layer whose opacity follows the night factor. `night` eases toward its target at a 1.4/s maximum rate, or snaps with reduced motion.
- `js/world/ambient.js` (new). `createAmbient(scene, curve, pts) → { update(time) }`. It holds black cabs and red buses as InstancedMesh, moving both ways along the road curve by offset over time. Boats bob on the Thames, a pigeon flock loops, and Big Ben's light blinks. Updates are skipped with reduced motion; objects stay static.
- `js/world/water.js` (new). A `ShaderMaterial` for the Thames with uniforms `uTime` (quantised `floor(t*8)/8`), `uDeep`, `uShallow`, `uGlint` and `uNight`. It replaces the flat water box colour.
- `js/world/signs.js` (new). Canvas-painted `Sprite` signs:
  - a year sign that follows the bus (replaces the HTML `#year-sign` overlay and its projection code);
  - one company-monogram sign per journey stop, scaled up when that stop is active.
- `js/world/figure.js` (new). A voxel body (black tee, dark trousers) with a head sprite from `assets/avatar.png`, placed beside the Wembley stop. The closing shot frames it.
- `js/world/scene.js` (changed):
  - wires the new units into one loop: `update(time, night, progress)`;
  - adds the low-res render, tone mapping, and the `document.hidden` pause;
  - keeps `createWorld(canvas, stops, {reducedMotion}) → {setProgress, setTheme, dispose}` unchanged for `main.js`.
- `js/content.js` (changed). Each journey stop gets `brand: { initials, color }`. Initials are 1–3 chars and the colour is a hex string, for example tribal `{ 'TW', '#e2001a' }`. Proper nouns need no translation.
- `js/ui.js` + `css/style.css` (changed):
  - each journey row shows a pixel monogram badge (CSS: Silkscreen initials on a brand-colour square, `aria-hidden`);
  - the hero name is larger, in the pixel font;
  - `#year-sign` HTML and its CSS are removed.

## Camera shots
| Section | Shot |
|---|---|
| hero | High aerial establishing view of the whole route: Thames, Eye and Big Ben on the horizon. Bus small at the start. |
| journey | Follows the bus (current side-front framing), with a gentle side sway driven by route position. |
| stack / articles / repos / recs | Bus keeps driving; camera rises and swings slowly (the blend between follow and a higher orbit). |
| contact | Closing shot at Wembley: stadium + arch, bus parked, figure beside it. |

Transitions between consecutive sections use `blendShots` with an arc lift. Desktop keeps the panel offset (bus right of the panel). Mobile keeps the bus above the bottom sheet.

## Error handling / fallbacks
Unchanged paths:
- no WebGL or CDN failure → `no-webgl` static panel;
- `prefers-reduced-motion` → spring and night ease snap, ambient frozen, shots jump.

New:
- The ShaderMaterial compile must not throw. If water creation throws, fall back to the flat Lambert water.
- Sprite canvases are created only after the world module loads.

## Testing
- Node (pure modules):
  - `camera.js`: `blendShots` endpoints equal inputs, the arc peaks at t=0.5, and yaw takes the shortest path. `spring` converges without overshoot and snaps when `dt` is 0 or reduced-motion is set.
  - content: every journey stop has `brand.initials` (1–3 uppercase chars) and a valid `#rrggbb` colour.
  - The privacy test keeps passing.
- Browser:
  - desktop + 375px, every section shot;
  - day↔night transition is gradual;
  - reduced motion, CDN blocked, console clean;
  - Lighthouse a11y/BP/SEO stay 100, and record the performance score.

## Done when
All four scope groups are visible in the browser at desktop and mobile widths. Tests are green. No regressions in the v1 verification matrix.
