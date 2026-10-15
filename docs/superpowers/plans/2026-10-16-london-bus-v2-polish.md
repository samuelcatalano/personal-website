# London Bus v2 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the voxel-London portfolio closer to bridglabs.com's polish. That means a pixel-art render, cinematic per-section camera, a living city, gradual day/night, in-world signs and a figure, and company monograms in the panel.

**Architecture:** Evolve the v1 modules (branch `feat/london-bus`). New math lives in a pure, node-testable `js/world/camera.js`. `scene.js` becomes a frame loop that drives registered units `{ update(frame) }`: water, ambient, signs. `sky.js` is updated last. The `createWorld(canvas, stops, {reducedMotion}) → {setProgress, setTheme, dispose}` contract with `main.js` does not change.

**Tech Stack:** HTML/CSS/ES modules, `three@0.169.0` (min) via importmap, Node ≥ 18 test runner. No build step.

**Spec:** `docs/superpowers/specs/2026-10-15-london-bus-v2-polish-design.md` (builds on `2026-10-15-london-bus-portfolio-design.md`, `docs/PRD.md`, `docs/TRD.md`).

## Global Constraints

- No build step, no npm, no `package.json`. three stays `https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js`.
- Every user-facing string lives in `js/content.js` with `en` and `pt`. Brand initials and colours are proper nouns and data, not copy.
- Never publish home address or phone. `tests/content.test.mjs` scans served files and must stay green. Write hex colours in **lowercase** so the postcode regex never trips.
- The site must work with WebGL unavailable (`no-webgl`) and with `prefers-reduced-motion: reduce` (no camera easing, no ambient motion, instant day/night).
- All URLs relative. Commit messages end with a `Co-Authored-By: Claude <model> <noreply@anthropic.com>` trailer naming the authoring model.
- Local servers used by implementers run on port **8001**, never 8000 (the controller's preview).

## Review Focus

1. First frame after load or reload mid-page: the camera and bus must appear at the real scroll position with no fly-in. `spring` snaps when `dt <= 0`; the test is in Task 1, the wiring in Task 2.
2. Toggling the theme in the middle of a transition reverses smoothly from the current value, with no jump. The `approach` test is in Task 1.
3. Resizing or rotating while pixelated: the drawing buffer is recomputed at 1/3 or 1/2 of the new size, and the view offset is re-applied. This is the resize step in Task 2, browser-checked in Task 7.
4. A hidden tab or long pause returns without a huge jump. `dt` is clamped to 0.1 s and rendering is skipped while hidden (Task 2).
5. If the pixel font hasn't loaded, canvas signs still paint, with a fallback font, and never throw. `document.fonts.load(...).catch` happens in Task 5.

---

## File map

```
js/content.js            + brand {initials, color} on journey stops            (Task 1)
js/world/camera.js       NEW pure: SECTION_SHOT, shotFor, blendShots, spring, approach (Task 1)
tests/logic.test.mjs     + camera tests                                         (Task 1)
tests/content.test.mjs   + brand test, fix cwd-relative walk                    (Task 1)
js/world/scene.js        rewrite: pixel render, spring, shots, units loop       (Task 2) + sky/water (3) + ambient (4) + signs/figure (5)
css/style.css            pixelated canvas (2), monogram + hero (6), drop #year-sign (5)
js/world/sky.js          NEW day/night + stars                                  (Task 3)
js/world/water.js        NEW Thames shader                                      (Task 3)
js/world/city.js         drop flat water box                                    (Task 3)
js/world/ambient.js      NEW traffic, boats, pigeons, blinking light            (Task 4)
js/world/signs.js        NEW canvas sprite signs (year + company monograms)    (Task 5)
js/world/figure.js       NEW voxel body + Memoji head                           (Task 5)
index.html, js/ui.js     drop #year-sign (5); monogram badges, bigger hero (6)
```

---

### Task 1: Brands in content + pure camera math

**Files:**
- Modify: `js/content.js` (journey stops), `tests/content.test.mjs`, `tests/logic.test.mjs`
- Create: `js/world/camera.js`

**Interfaces:**
- Produces:
  - `stops[i].brand = { initials: string, color: '#rrggbb' }`, set only on journey stops.
  - `js/world/camera.js`, which does not import three:
    - `SECTION_SHOT: Record<section, 'hero'|'follow'|'high'|'closing'>`
    - `shotFor(kind, bus:{x,y,z}, { extent:{minX,maxX}, mobile:boolean }) → { position:[x,y,z], target:[x,y,z] }`
    - `blendShots(a, b, t, arc = 0) → shot`
    - `spring(state:{value,velocity}, target, dt, smoothTime) → state`
    - `approach(current, target, dt, rate) → number`

- [ ] **Step 1: Write failing tests.**

  Append to `tests/logic.test.mjs`:

```js
import { SECTION_SHOT, shotFor, blendShots, spring, approach } from '../js/world/camera.js';
import { SECTIONS as ALL_SECTIONS } from '../js/content.js';

const close = (a, b, eps = 1e-6) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < eps, `${a} vs ${b}`));

test('every section has a shot kind', () => {
  for (const s of ALL_SECTIONS) assert.ok(['hero', 'follow', 'high', 'closing'].includes(SECTION_SHOT[s]), s);
});

test('shotFor returns finite vectors for every kind', () => {
  for (const k of ['hero', 'follow', 'high', 'closing']) for (const mobile of [false, true]) {
    const s = shotFor(k, { x: 10, y: 0, z: -3 }, { extent: { minX: -225, maxX: 225 }, mobile });
    [...s.position, ...s.target].forEach(v => assert.ok(Number.isFinite(v), k));
  }
});

test('blendShots hits endpoints and arcs at the middle', () => {
  const a = { position: [0, 10, 40], target: [0, 0, 0] };
  const b = { position: [50, 30, 60], target: [60, 5, -20] };
  close(blendShots(a, b, 0).position, a.position); close(blendShots(a, b, 0).target, a.target, 1e-4);
  close(blendShots(a, b, 1).position, b.position); close(blendShots(a, b, 1).target, b.target, 1e-4);
  assert.ok(Math.abs(blendShots(a, b, 0.5, 18).position[1] - (20 + 18)) < 1e-9);
});

test('blendShots turns the short way round', () => {
  const a = { position: [0, 0, 0], target: [-10, 0, 1] };   // yaw ≈ +174°
  const b = { position: [0, 0, 0], target: [-10, 0, -1] };  // yaw ≈ -174°
  const mid = blendShots(a, b, 0.5).target;
  assert.ok(mid[0] < -9.9 && Math.abs(mid[2]) < 1e-6);       // still looking to -x, not swung round to +x
});

test('spring snaps on dt <= 0 and converges without overshoot', () => {
  assert.deepEqual(spring({ value: 0, velocity: 3 }, 1, 0, 0.32), { value: 1, velocity: 0 });
  let s = { value: 0, velocity: 0 };
  for (let i = 0; i < 240; i++) { s = spring(s, 1, 1 / 60, 0.32); assert.ok(s.value <= 1 + 1e-12); }
  assert.ok(Math.abs(s.value - 1) < 1e-3);
});

test('approach moves at most rate*dt and reverses smoothly', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);
  near(approach(0, 1, 0.1, 1.4), 0.14);
  near(approach(0.9, 1, 0.5, 1.4), 1);
  near(approach(0.5, 0, 0.1, 1.4), 0.36);
});
```

  Append to `tests/content.test.mjs`:

```js
test('journey stops have a brand monogram', () => {
  for (const s of stops.filter(s => s.section === 'journey')) {
    assert.match(s.brand?.initials ?? '', /^[A-Z]{1,3}$/, s.id);
    assert.match(s.brand?.color ?? '', /^#[0-9a-f]{6}$/, s.id);
  }
});
```

  In the same file, fix the cwd-relative walk in the privacy test. Change `...walk('js')].map(f => join(root, f))` to:

```js
  const files = [...['index.html', 'css/style.css', 'README.md'].map(f => join(root, f)), ...walk(join(root, 'js'))];
```

- [ ] **Step 2: Run the tests and confirm they fail.**

  Run: `node --test tests/`. Expected: FAIL, with `Cannot find module '.../js/world/camera.js'` and the brand test failing.

- [ ] **Step 3: Add brands to the journey stops** in `js/content.js`, replacing those 10 stop lines:

```js
  { id: 'puc', section: 'journey', year: '2003', country: 'BR', brand: { initials: 'PUC', color: '#1e3a8a' } },
  { id: 'arizona', section: 'journey', year: '2011', country: 'BR', brand: { initials: 'AP', color: '#e4572e' } },
  { id: 'insane', section: 'journey', year: '2012', country: 'BR', brand: { initials: 'IG', color: '#7b2cbf' } },
  { id: 'taqtile', section: 'journey', year: '2014', country: 'BR', brand: { initials: 'TQ', color: '#00a6a6' } },
  { id: 'mira', section: 'journey', year: '2017', country: 'BR', brand: { initials: 'ME', color: '#f28c28' } },
  { id: 'reclame', section: 'journey', year: '2017', country: 'BR', brand: { initials: 'RA', color: '#36a43b' } },
  { id: 'millimetric', section: 'journey', year: '2020', country: 'UK', brand: { initials: 'MM', color: '#2b59c3' } },
  { id: 'xdesign', section: 'journey', year: '2020', country: 'UK', brand: { initials: 'XD', color: '#ff3e6c' } },
  { id: 'olm', section: 'journey', year: '2021', country: 'UK', brand: { initials: 'OLM', color: '#0f766e' } },
  { id: 'tribal', section: 'journey', year: '2024', country: 'UK', brand: { initials: 'TW', color: '#e2001a' } },
```

- [ ] **Step 4: Write `js/world/camera.js`.**

```js
// Pure camera math (no three import) so node tests can load it.
export const SECTION_SHOT = {
  hero: 'hero', journey: 'follow', stack: 'high', articles: 'high', repos: 'high', recs: 'high', contact: 'closing',
};

// Shots are plain arrays: position and look-at target in world units.
export function shotFor(kind, bus, { extent, mobile = false }) {
  const k = mobile ? 1.8 : 1;
  const { x, y, z } = bus;
  switch (kind) {
    case 'hero': {
      const cx = (extent.minX + extent.maxX) / 2;
      return { position: [cx - 60, 120 * k, 190 * k], target: [cx, 0, -50] };
    }
    case 'follow': return { position: [x + 14 * k, y + 14 * k, z + 46 * k], target: [x, y + 7, z - 12] };
    case 'high': return { position: [x + 30 * k, y + 34 * k, z + 60 * k], target: [x - 6, y + 6, z - 20] };
    case 'closing': return { position: [x - 6 * k, y + 12 * k, z + 42 * k], target: [x - 2, y + 12, z - 60] };
    default: throw new Error(`unknown shot ${kind}`);
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
function aim({ position: p, target: q }) {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const len = Math.hypot(...d) || 1;
  return { yaw: Math.atan2(d[2], d[0]), pitch: Math.asin(d[1] / len), len };
}

// Position moves in a straight line plus a sin arc; the view direction turns by yaw/pitch the short way.
export function blendShots(a, b, t, arc = 0) {
  const A = aim(a), B = aim(b);
  const dyaw = ((B.yaw - A.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const yaw = A.yaw + dyaw * t, pitch = lerp(A.pitch, B.pitch, t), len = lerp(A.len, B.len, t);
  const position = a.position.map((v, i) => lerp(v, b.position[i], t));
  position[1] += Math.sin(Math.PI * t) * arc;
  const target = [
    position[0] + Math.cos(yaw) * Math.cos(pitch) * len,
    position[1] + Math.sin(pitch) * len,
    position[2] + Math.sin(yaw) * Math.cos(pitch) * len,
  ];
  return { position, target };
}

// Critically damped spring (SmoothDamp). dt <= 0 snaps, which gives the first frame its exact position.
export function spring(state, target, dt, smoothTime) {
  if (dt <= 0 || smoothTime <= 0) return { value: target, velocity: 0 };
  const omega = 2 / smoothTime, x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = state.value - target;
  const temp = (state.velocity + omega * change) * dt;
  const value = target + (change + temp) * exp;
  if ((target - state.value > 0) === (value > target)) return { value: target, velocity: 0 }; // no overshoot
  return { value, velocity: (state.velocity - omega * temp) * exp };
}

// Linear approach capped at rate per second (day/night fade).
export const approach = (current, target, dt, rate) =>
  current + Math.max(-rate * dt, Math.min(rate * dt, target - current));
```

- [ ] **Step 5: Run the tests and confirm they pass.**

  Run: `node --test tests/`. Expected: everything passes (14 old + 7 new = 21).

- [ ] **Step 6: Commit.**

```bash
git add js/content.js js/world/camera.js tests/logic.test.mjs tests/content.test.mjs
git commit -m "feat: brand monograms data and pure camera math"
```

---

### Task 2: Pixel render, spring scroll, cinematic shots

**Files:**
- Replace: `js/world/scene.js`
- Modify: `css/style.css`

**Interfaces:**
- Consumes: `SECTION_SHOT`, `shotFor`, `blendShots`, `spring` (Task 1); `routeT`, `nearestStop` (`js/scroll.js`); the existing builders.
- Produces: `createWorld` with the same signature. Inside `scene.js`:
  - an array `units` of `{ update(frame) }`;
  - `frame = { time, dt, progress, active, bus:{x,y,z} }`;
  - a `night` mechanism, which Task 3 replaces. Until then, `setTheme` switches instantly as in v1.

- [ ] **Step 1: Replace `js/world/scene.js`.**

```js
import * as THREE from 'three';
import { routeT, nearestStop } from '../scroll.js';
import { routePoints } from './layout.js';
import { createBoxes, buildMeshes } from './voxel.js';
import { buildCity } from './city.js';
import { buildLandmarks } from './landmarks.js';
import { buildBus } from './bus.js';
import { SECTION_SHOT, shotFor, blendShots, spring } from './camera.js';

const THEMES = {
  day: { sky: 0xa9d8f5, fog: 0xcfe8f7, sun: 1.6, hemi: 1.1, glow: 0x000000 },
  night: { sky: 0x0d1b3a, fog: 0x14244a, sun: 0.25, hemi: 0.35, glow: 0xffc85a },
};
const PIXEL_DESKTOP = 3, PIXEL_MOBILE = 2; // drawing buffer = viewport / k, upscaled with image-rendering: pixelated
const SCROLL_SMOOTH = 0.32;                // seconds
const ARC = 18;                            // camera lift when blending between different shot kinds

export async function createWorld(canvas, stops, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !matchMedia('(max-width: 767px)').matches;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(THEMES.day.sky);
  scene.fog = new THREE.Fog(THEMES.day.fog, 90, 340);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 900);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a7a4a, 1.1);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 300 });
  scene.add(hemi, sun, sun.target);

  const n = stops.length;
  const pts = routePoints(n);
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, 0, p.z)));
  const { add, list } = createBoxes();
  buildCity(add, stops, pts, curve);
  const { eye, plane, planeAt } = buildLandmarks(add, stops, pts);
  const bus = buildBus();
  scene.add(buildMeshes(list, { glow: ['#ffd86b', '#fff7c2'] }), eye, plane, bus);
  const extent = { minX: pts[0].x, maxX: pts[n - 1].x };

  // Per-frame units register here as { update(frame) }; frame = { time, dt, progress, active, bus }.
  const units = [];

  let mobile = false;
  const resize = () => {
    mobile = innerWidth < 768;
    const k = mobile ? PIXEL_MOBILE : PIXEL_DESKTOP;
    renderer.setSize(Math.ceil(innerWidth / k), Math.ceil(innerHeight / k), false);
    camera.aspect = innerWidth / innerHeight;
    // bus right of the 400px panel on desktop, above the bottom sheet on mobile
    if (!mobile) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.12, 0, innerWidth, innerHeight);
    else camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.18, innerWidth, innerHeight);
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  const sign = document.getElementById('year-sign');
  const busPos = { x: 0, y: 0, z: 0 };
  const tmp = new THREE.Vector3();
  const updateSign = () => {
    if (!sign) return;
    tmp.set(busPos.x, 11, busPos.z).project(camera);
    sign.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
  };
  const updatePlane = (p) => {
    const d = (p - planeAt) * (n - 1); // -1..1 around the 2020 stop
    plane.visible = planeAt >= 0 && Math.abs(d) < 1;
    if (plane.visible) plane.position.set(busPos.x + d * 60, 22 - Math.max(0, d) * 14, busPos.z - 6);
  };

  let scroll = { value: 0, velocity: 0 }, target = 0, clock = 0, last = 0, raf = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; // first frame dt=0 → spring snaps
    last = now;
    if (document.hidden) return;
    scroll = reducedMotion ? { value: target, velocity: 0 } : spring(scroll, target, dt, SCROLL_SMOOTH);
    if (!reducedMotion) clock += dt;

    const p = scroll.value, t = routeT(p, n);
    const bp = curve.getPointAt(t), tan = curve.getTangentAt(t);
    bus.position.copy(bp);
    bus.rotation.y = Math.atan2(-tan.z, tan.x);
    Object.assign(busPos, { x: bp.x, y: bp.y, z: bp.z });

    const s = t * (n - 1), i = Math.min(Math.floor(s), n - 2);
    const ka = SECTION_SHOT[stops[i].section], kb = SECTION_SHOT[stops[i + 1].section];
    const view = { extent, mobile };
    const shot = blendShots(shotFor(ka, busPos, view), shotFor(kb, busPos, view), s - i, ka === kb ? 0 : ARC);
    camera.position.fromArray(shot.position);
    camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
    sun.position.set(bp.x + 40, 80, bp.z + 30);
    sun.target.position.copy(bp);

    eye.rotation.z = clock * 0.1;
    updatePlane(p);
    const f = { time: clock, dt, progress: p, active: nearestStop(p, n), bus: busPos };
    for (const u of units) u.update(f);
    renderer.render(scene, camera);
    updateSign();
  };

  return {
    setProgress(p) { target = p; },
    setTheme(name) {
      const th = THEMES[name] ?? THEMES.day;
      scene.background.set(th.sky);
      scene.fog.color.set(th.fog);
      sun.intensity = th.sun;
      hemi.intensity = th.hemi;
      scene.traverse((o) => { if (o.material?.userData?.glow) o.material.emissive.set(th.glow); });
      if (!raf) raf = requestAnimationFrame(frame);
    },
    dispose() { cancelAnimationFrame(raf); raf = 0; removeEventListener('resize', resize); renderer.dispose(); },
  };
}
```

- [ ] **Step 2: Make the canvas pixelated.** In `css/style.css`, change the `#world` rule to:

```css
#world { position: fixed; inset: 0; width: 100vw; height: 100vh; display: block; image-rendering: pixelated; }
```

- [ ] **Step 3: Check and commit.**
  - Run `node --check js/world/scene.js` and `node --test tests/` (21 should pass).
  - The controller checks visually that:
    - the scene renders in chunky pixels;
    - the hero shows an aerial view of the route;
    - scrolling into the journey swoops down with an arc to follow the bus;
    - Stack…Kind words rises higher;
    - Contact frames Wembley;
    - a reload mid-page shows the right shot immediately;
    - reduced motion jumps with no easing.

```bash
git add js/world/scene.js css/style.css
git commit -m "feat: pixel-art render, spring scroll and per-section camera shots"
```

---

### Task 3: Gradual day/night, stars and Thames water shader

**Files:**
- Create: `js/world/sky.js`, `js/world/water.js`
- Modify: `js/world/scene.js`, `js/world/city.js`

**Interfaces:**
- Consumes: `approach` (Task 1); `units` and `frame` (Task 2); `RIVER_Z` (`layout.js`).
- Produces:
  - `createSky(scene, { hemi, sun }) → { update(night) }`. It must be created **after** every object with glow materials is in the scene; later tasks add their objects before it.
  - `createWater({ span, z, width }) → { mesh, update(time, night) }`.

- [ ] **Step 1: Write `js/world/sky.js`.**

```js
import * as THREE from 'three';

const DAY = { sky: new THREE.Color(0xa9d8f5), fog: new THREE.Color(0xcfe8f7), sun: 1.6, hemi: 1.1 };
const NIGHT = { sky: new THREE.Color(0x0d1b3a), fog: new THREE.Color(0x14244a), sun: 0.25, hemi: 0.35 };
const GLOW = new THREE.Color(0xffc85a);

// Call after every glow material is in the scene: it collects them once.
export function createSky(scene, { hemi, sun }) {
  const glow = [];
  scene.traverse((o) => { if (o.material?.userData?.glow) glow.push(o.material); });

  const pos = [];
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * Math.PI * 2, r = 300 + Math.random() * 200;
    pos.push(Math.cos(a) * r, 60 + Math.random() * 220, Math.sin(a) * r - 150);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }),
  );
  scene.add(stars);

  return {
    update(night) {
      scene.background.lerpColors(DAY.sky, NIGHT.sky, night);
      scene.fog.color.lerpColors(DAY.fog, NIGHT.fog, night);
      sun.intensity = DAY.sun + (NIGHT.sun - DAY.sun) * night;
      hemi.intensity = DAY.hemi + (NIGHT.hemi - DAY.hemi) * night;
      stars.material.opacity = night;
      stars.visible = night > 0.02;
      for (const m of glow) m.emissive.copy(GLOW).multiplyScalar(night);
    },
  };
}
```

  Stars do not need to be deterministic, so `Math.random` is fine.

- [ ] **Step 2: Write `js/world/water.js`.**

```js
import * as THREE from 'three';

const vertexShader = /* glsl */`
#include <fog_pars_vertex>
varying vec3 vPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const fragmentShader = /* glsl */`
uniform float uTime;
uniform float uNight;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uGlint;
uniform vec3 uNightTint;
varying vec3 vPos;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 cell = floor(vPos.xz / 2.0);
  float w = sin(cell.x * 0.7 + uTime * 2.0) * sin(cell.y * 1.3 - uTime * 1.5);
  vec3 c = mix(uDeep, uShallow, step(0.3, w));
  c = mix(c, uGlint, step(0.985, hash(cell + floor(uTime * 2.0))));
  c = mix(c, uNightTint, uNight * 0.75);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function createWater({ span, z, width }) {
  const geo = new THREE.PlaneGeometry(span, width).rotateX(-Math.PI / 2);
  let mat, shader = true;
  try {
    mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, uNight: { value: 0 },
        uDeep: { value: new THREE.Color(0x3f7fb8) }, uShallow: { value: new THREE.Color(0x5a9fd6) },
        uGlint: { value: new THREE.Color(0xd6f0ff) }, uNightTint: { value: new THREE.Color(0x16264a) },
      }]),
      vertexShader, fragmentShader, fog: true,
    });
  } catch {
    shader = false;
    mat = new THREE.MeshLambertMaterial({ color: 0x4f86b8 }); // flat fallback
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.1, z);
  return {
    mesh,
    update(time, night) {
      if (!shader) return;
      mat.uniforms.uTime.value = Math.floor(time * 8) / 8; // stepped, pixel-art shimmer
      mat.uniforms.uNight.value = night;
    },
  };
}
```

- [ ] **Step 3: Remove the flat water box from `js/world/city.js`.** Delete the line below, and drop `WATER` from the colour constants if it becomes unused:

```js
  add(0, -0.9, RIVER_Z, span, 1, 22, WATER);                // Thames
```

- [ ] **Step 4: Wire sky and water into `js/world/scene.js`.**
  1. Imports: add `approach` to the camera import, and add these:

```js
import { routePoints, RIVER_Z } from './layout.js';
import { createSky } from './sky.js';
import { createWater } from './water.js';
```

     (Replace the existing `import { routePoints } from './layout.js';`.)
  2. Delete the `THEMES` constant. Set the initial background and fog from literals: `new THREE.Color(0xa9d8f5)` and `new THREE.Fog(0xcfe8f7, 90, 340)`.
  3. Right after `const units = [];`, add:

```js
  const water = createWater({ span: pts.length * 30 + 120, z: RIVER_Z, width: 22 });
  scene.add(water.mesh);
  // ── later tasks add more units ABOVE this line; sky must stay last (it collects glow materials) ──
  const sky = createSky(scene, { hemi, sun });
  let night = 0, nightTarget = 0;
```

  4. In `frame`, immediately before `renderer.render(scene, camera);`, add:

```js
    night = reducedMotion ? nightTarget : approach(night, nightTarget, dt, 1.4);
    sky.update(night);
    water.update(clock, night);
```

  5. Replace the `setTheme` method with:

```js
    setTheme(name) {
      nightTarget = name === 'night' ? 1 : 0;
      if (!raf) { night = nightTarget; raf = requestAnimationFrame(frame); }
    },
```

- [ ] **Step 5: Check and commit.**
  - Run `node --check js/world/*.js` and `node --test tests/` (21 should pass).
  - The controller checks visually that:
    - the Thames shows a stepped shimmer with occasional glints;
    - toggling night fades the sky, fog and water over about 0.7 s, and windows and headlights glow;
    - stars appear at night;
    - toggling twice quickly reverses smoothly;
    - there are no shader errors in the console.

```bash
git add js/world/sky.js js/world/water.js js/world/scene.js js/world/city.js
git commit -m "feat: gradual day/night with stars and Thames water shader"
```

---

### Task 4: Living city (traffic, boats, pigeons, Big Ben light)

**Files:**
- Create: `js/world/ambient.js`
- Modify: `js/world/scene.js`

**Interfaces:**
- Consumes: `createBoxes` and `buildMeshes` (voxel); `RIVER_Z`, `LANDMARKS` and `stopIndex` (layout); `curve`, `pts`, `stops` and `units` (scene).
- Produces: `createAmbient(scene, { curve, pts, stops }) → { update(frame) }`.
  - Ambient movement is driven only by `frame.time`, which stops advancing under reduced motion, so everything freezes.
  - Headlight colour `'#fff7c2'` is a glow colour, so it lights up at night.

- [ ] **Step 1: Write `js/world/ambient.js`.**

```js
import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';
import { RIVER_Z, LANDMARKS, stopIndex } from './layout.js';

const LIGHT = '#fff7c2';

function cab() {
  const { add, list } = createBoxes();
  add(0, 0.4, 0, 3.2, 1.2, 1.6, '#16181c');
  add(-0.2, 1.6, 0, 1.8, 0.8, 1.5, '#16181c');
  add(0.5, 1.7, 0, 0.6, 0.5, 1.52, '#9fc6e6');
  add(1.62, 0.8, 0.5, 0.05, 0.3, 0.3, LIGHT);
  add(1.62, 0.8, -0.5, 0.05, 0.3, 0.3, LIGHT);
  for (const x of [-1, 1]) for (const z of [0.8, -0.8]) add(x, 0, z, 0.7, 0.7, 0.2, '#0b0b0b');
  return buildMeshes(list, { glow: [LIGHT] });
}

function miniBus() {
  const { add, list } = createBoxes();
  add(0, 0.6, 0, 7, 4.4, 2.4, '#d6211f');
  for (const y of [1.6, 3.6]) { add(0, y, 1.21, 6, 0.9, 0.05, '#bfe3ff'); add(0, y, -1.21, 6, 0.9, 0.05, '#bfe3ff'); }
  add(3.52, 0.9, 0.8, 0.05, 0.35, 0.35, LIGHT);
  add(3.52, 0.9, -0.8, 0.05, 0.35, 0.35, LIGHT);
  for (const x of [-2.3, 2.3]) for (const z of [1.1, -1.1]) add(x, 0, z, 1, 1, 0.3, '#0b0b0b');
  return buildMeshes(list, { glow: [LIGHT] });
}

function boat() {
  const { add, list } = createBoxes();
  add(0, 0, 0, 6, 1, 2.2, '#6b4f3a');
  add(-0.5, 1, 0, 2.6, 1.2, 1.8, '#f4f4f4');
  add(-0.5, 1.4, 0.91, 2, 0.4, 0.05, '#bfe3ff');
  return buildMeshes(list);
}

export function createAmbient(scene, { curve, pts, stops }) {
  const traffic = Array.from({ length: 6 }, (_, i) => {
    const mesh = i % 3 === 2 ? miniBus() : cab();
    scene.add(mesh);
    return { mesh, lane: i % 2 ? 1 : -1, offset: i / 6, speed: 0.012 + (i % 3) * 0.004 };
  });

  const boats = [-0.3, 0.05, 0.35].map((f, i) => {
    const mesh = boat();
    mesh.position.set(pts[0].x + (pts.at(-1).x - pts[0].x) * (f + 0.3), 0.1, RIVER_Z + (i - 1) * 5);
    scene.add(mesh);
    return mesh;
  });

  const birds = new THREE.Group();
  const birdMesh = buildMeshes([{ x: 0, y: 0, z: 0, w: 0.8, h: 0.3, d: 0.5, color: '#7d8590' }]);
  for (let i = 0; i < 8; i++) {
    const b = birdMesh.clone();
    b.position.set(Math.cos(i) * 12, 26 + (i % 3) * 2, Math.sin(i) * 12);
    birds.add(b);
  }
  const bb = pts[stopIndex(stops, LANDMARKS.bigben)];
  birds.position.set(bb.x + 10, 0, RIVER_Z - 10);
  scene.add(birds);

  const blink = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  blink.position.set(bb.x, 34.4, RIVER_Z - 16); // top of Big Ben's spire
  scene.add(blink);

  const nrm = new THREE.Vector3();
  return {
    update({ time }) {
      for (const v of traffic) {
        let t = (v.offset + time * v.speed) % 1;
        if (v.lane < 0) t = 1 - t;
        const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        nrm.set(tan.z, 0, -tan.x).normalize();
        v.mesh.position.copy(p).addScaledVector(nrm, 2.6 * v.lane); // lanes clear of the 3.6-wide hero bus
        v.mesh.rotation.y = Math.atan2(-tan.z, tan.x) + (v.lane < 0 ? Math.PI : 0);
      }
      boats.forEach((b, i) => {
        b.position.y = 0.1 + Math.sin(time * 1.1 + i * 2) * 0.25;
        b.rotation.z = Math.sin(time * 0.9 + i) * 0.04;
      });
      birds.rotation.y = time * 0.3;
      blink.visible = Math.floor(time * 1.4) % 2 === 0;
    },
  };
}
```

- [ ] **Step 2: Wire it into `js/world/scene.js`.**
  - Add `import { createAmbient } from './ambient.js';`.
  - Directly after `scene.add(water.mesh);` and **above** the `── later tasks …` comment line, add:

```js
  units.push(createAmbient(scene, { curve, pts, stops }));
```

- [ ] **Step 3: Check and commit.**
  - Run `node --check js/world/ambient.js js/world/scene.js` and `node --test tests/`.
  - The controller checks visually that:
    - black cabs and small red buses drive both ways in side lanes without overlapping the hero bus;
    - boats bob on the Thames, pigeons circle near Big Ben, and its light blinks;
    - headlights glow at night;
    - everything is static with reduced motion.

```bash
git add js/world/ambient.js js/world/scene.js
git commit -m "feat: living city — traffic, boats, pigeons, blinking light"
```

---

### Task 5: In-world signs and the Wembley figure

**Files:**
- Create: `js/world/signs.js`, `js/world/figure.js`
- Modify: `js/world/scene.js`, `index.html`, `css/style.css`, `js/ui.js`

**Interfaces:**
- Consumes: `stops[i].brand` (Task 1), `units` (Task 2), `assets/avatar.png`.
- Produces:
  - `paintSign(text, { bg, fg }) → THREE.CanvasTexture` (nearest filtered);
  - `createSigns(scene, { stops, pts }) → Promise<{ update(frame) }>`;
  - `buildFigure() → THREE.Group`, which faces +z with its feet at y=0.
- The HTML `#year-sign` element, its CSS and its `ui.js` code are removed.

- [ ] **Step 1: Write `js/world/signs.js`.**

```js
import * as THREE from 'three';

export function paintSign(text, { bg = '#d6211f', fg = '#ffffff', w = 256, h = 96 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#111111'; g.fillRect(0, 0, w, h);
  g.fillStyle = bg; g.fillRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg;
  g.font = `${Math.round(h * 0.5)}px Silkscreen, monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const yearStyle = (s) => (s.country === 'BR' ? { bg: '#009c3b', fg: '#ffdf00' } : { bg: '#d6211f', fg: '#ffffff' });

export async function createSigns(scene, { stops, pts }) {
  await document.fonts?.load('48px Silkscreen').catch(() => {}); // fallback font if it never loads

  const yearMat = new THREE.SpriteMaterial({ map: paintSign(stops[0].year, yearStyle(stops[0])) });
  const year = new THREE.Sprite(yearMat);
  year.scale.set(8, 3, 1);
  scene.add(year);

  const company = [];
  stops.forEach((s, i) => {
    if (!s.brand) return;
    const p = pts[i];
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
    pole.position.set(p.x - 7, 3, p.z + 5);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: paintSign(s.brand.initials, { bg: s.brand.color, w: 128, h: 128 }) }));
    sprite.position.set(p.x - 7, 7.5, p.z + 5);
    sprite.scale.set(3.2, 3.2, 1);
    scene.add(pole, sprite);
    company.push({ i, sprite });
  });

  let shown = 0;
  return {
    update({ active, bus }) {
      year.position.set(bus.x, bus.y + 11, bus.z);
      if (active === shown) return;
      const s = stops[active];
      yearMat.map.dispose();
      yearMat.map = paintSign(s.year, yearStyle(s));
      yearMat.needsUpdate = true;
      for (const c of company) c.sprite.scale.setScalar(c.i === active ? 4.2 : 3.2);
      shown = active;
    },
  };
}
```

- [ ] **Step 2: Write `js/world/figure.js`.**

```js
import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';

// Voxel body in a black tee (like the Memoji) with the avatar as the head.
export function buildFigure() {
  const { add, list } = createBoxes();
  add(-0.45, 0, 0, 0.7, 2.4, 0.8, '#2b2d33');   // legs
  add(0.45, 0, 0, 0.7, 2.4, 0.8, '#2b2d33');
  add(0, 2.4, 0, 2, 2.6, 1.1, '#141414');       // torso
  add(-1.3, 2.7, 0, 0.6, 2.2, 0.7, '#141414');  // arms
  add(1.3, 2.7, 0, 0.6, 2.2, 0.7, '#141414');
  add(0, 5, 0, 0.7, 0.4, 0.7, '#e9c9b2');       // neck
  const fig = buildMeshes(list);
  const tex = new THREE.TextureLoader().load('assets/avatar.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  head.scale.set(2.6, 2.6, 1);
  head.position.set(0, 6.5, 0);
  fig.add(head);
  return fig;
}
```

- [ ] **Step 3: Wire them into `js/world/scene.js`.**
  - Imports: `import { createSigns } from './signs.js';` and `import { buildFigure } from './figure.js';`.
  - **Above** the `── later tasks …` comment line, below the ambient line, add:

```js
  units.push(await createSigns(scene, { stops, pts }));
  const figure = buildFigure();
  const end = curve.getPointAt(1);
  figure.position.set(end.x - 7, 0, end.z + 2); // beside the parked bus, framed by the closing shot
  scene.add(figure);
```

  - Delete the HTML-overlay code: the `sign` constant, `tmp`, the `updateSign` function and the `updateSign();` call in `frame`.

- [ ] **Step 4: Remove the HTML year sign.**
  - `index.html`: delete `<div id="year-sign" aria-hidden="true"></div>`.
  - `css/style.css`: delete the `#year-sign { … }`, `#year-sign[data-country="BR"]::after { … }` and `body.world-ready #year-sign { … }` rules.
  - `js/ui.js`:
    - delete `const sign = document.getElementById('year-sign');`;
    - delete the two lines `sign.textContent = st.year;` and `sign.dataset.country = st.country;`;
    - leave the `flag` helper alone, because the journey list still uses it.
  - Run `grep -rn "year-sign" index.html css js` and expect no output.

- [ ] **Step 5: Check and commit.**
  - Run `node --check js/world/*.js js/ui.js` and `node --test tests/` (the privacy scan includes the new files).
  - The controller checks visually that:
    - the pixel year sign floats over the bus, green with yellow text on Brazil stops and red on London stops;
    - each journey stop has a monogram sign on a pole, and the active one is bigger;
    - the Contact shot shows the voxel figure with the Memoji head beside the bus, with Wembley behind;
    - signs look crisp, not blurry.

```bash
git add js/world/signs.js js/world/figure.js js/world/scene.js index.html css/style.css js/ui.js
git commit -m "feat: in-world pixel signs, company monograms and Wembley figure"
```

---

### Task 6: Panel monogram badges and pixel hero

**Files:**
- Modify: `js/ui.js`, `css/style.css`

**Interfaces:**
- Consumes: `stops[i].brand` (Task 1).
- Produces: a `.mono` badge in each journey row (`aria-hidden`, so the company name stays the accessible text).

- [ ] **Step 1: Add the badge in `js/ui.js` `sectionHTML` journey case.**

  Replace:

```js
          <span class="yr">${st.year}</span> <span aria-hidden="true">${flag(st.country)}</span> ${c.title}</button>
```

  with:

```js
          <span class="yr">${st.year}</span> <span class="mono" style="--c:${st.brand.color}" aria-hidden="true">${st.brand.initials}</span> <span aria-hidden="true">${flag(st.country)}</span> ${c.title}</button>
```

- [ ] **Step 2: Add the styles in `css/style.css`.**

  Append:

```css
.mono { display: inline-grid; place-items: center; min-width: 26px; height: 22px; padding: 0 3px; vertical-align: middle;
  font: 9px var(--pixel); color: #fff; background: var(--c); border: 2px solid #111; box-shadow: 2px 2px 0 #111; }
```

  Change `.panel h1 { font: 34px/1.1 var(--pixel); margin: 8px 0; }` to:

```css
.panel h1 { font: clamp(34px, 4.4vw, 52px)/1.05 var(--pixel); margin: 8px 0; letter-spacing: 1px; }
```

- [ ] **Step 3: Check and commit.**
  - Run `node --test tests/`.
  - The controller checks visually that each journey row shows a coloured pixel badge with initials, readable in day and night, and that the hero name is larger and still fits on 375px.

```bash
git add js/ui.js css/style.css
git commit -m "feat: pixel monogram badges and larger pixel hero name"
```

---

### Task 7: Verification pass (controller)

**Files:** none. Fixes found here go to an implementer with the exact finding.

- [ ] **Step 1: Run the browser matrix** at `http://localhost:8000`.
  - Desktop and 375px: every section shot (hero, journey, stack, articles, repos, recs, contact).
  - Day↔night transition: gradual, reversible mid-way.
  - Reduced motion (DevTools emulation): no easing, ambient frozen, theme instant.
  - CDN blocked: `no-webgl` and a working panel.
  - Reload mid-page and `#contact`: correct shot immediately.
  - Resize 1280 ↔ 375: buffer and view offset follow.
  - Console clean, with no shader compile errors.
- [ ] **Step 2: Run Lighthouse** on desktop: a11y, best practices and SEO stay at 100. Record the performance score with a trace if available.
- [ ] **Step 3: Run accesslint** with no new serious findings.
- [ ] **Step 4: Run** `node --test tests/` and expect all green.
