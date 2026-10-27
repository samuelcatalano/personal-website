# Prompt: sky, clouds, sun, moon and rain upgrade

> Written for OpenAI Codex (also works for any coding agent). Hand this whole file over as the task. Part 1 of 4 in the graphics upgrade
> (sky/weather → background → more buildings → pedestrians). "Owner decision" items are fixed;
> "agent's call" items are defaults you may tune after captures.

## Role and mission

You are a senior real-time graphics engineer working on a plain-ES-module Three.js portfolio
(a 3D city that a red double-decker bus drives through as the visitor scrolls). Your mission is
to make the **sky and weather** look rich and believable in a stylized way, with **rain as the
hero feature**. Every capture of the site shows the sky, so this pass changes the mood of every
scene. Make it feel like a hand-art-directed game sky, not a two-colour gradient with stickers.

Read first: `AGENTS.md` (project rules; same file as `CLAUDE.md`), `docs/art-direction.md`, `docs/architecture/rendering-budget.md`,
`docs/plans/north-star-full-scene-upgrade.md` (North Star = stylized golden-hour city,
saturated blue sky, sparkling water).

## Hard constraints (non-negotiable)

- No build step, no npm. `three` comes from the pinned jsDelivr importmap in `index.html`.
  Three's own `examples/jsm` addons (e.g. `objects/Sky.js`, `objects/Lensflare.js`) are allowed
  because they ship with the pinned version. Any other dependency: ask first.
- No external textures unless CC0 / clearly permissive, logged in `ASSET_SOURCES.md`. Prefer
  procedural (canvas or shader noise).
- Do not touch the map, routes, stops, landmarks, buildings, lot data, cameras, UI or copy.
- `prefers-reduced-motion`: no animated rain, no cloud drift, no lightning, no twinkle. A static,
  still-rainy look (darker sky, wet ground) is fine.
- WebGL-off must keep working (the HTML panel is the source of truth; the world is decoration).
- Performance: desktop and emulated mobile p95 may regress at most **+1 ms desktop / +2 ms
  mobile** against the current baseline (method in `rendering-budget.md`). Respect the existing
  `post.js` tiers (`high` gets MSAA; lower tiers must get cheaper weather, e.g. fewer streaks,
  no splashes).
- No SSR, no cubemaps, no extra shadow-casting lights, no new render passes unless measured
  within budget.
- Mark every deliberate shortcut with a `ponytail:` comment naming its ceiling.
- Reply to the owner in pt-BR; code, comments and commits in English. Commit per milestone after
  tests; never push unless asked; never `git reset/restore/clean/stash`.

## Current state (read this code before changing anything)

| File | What it does now |
|---|---|
| `js/world/sky.js` | Back-side sphere dome with a two-stop zenith/horizon `smoothstep` gradient; canvas-disc sprite sun (hard white core + faint ring) and cartoon moon (white disc + 5 grey crater dots); 10 clusters of flattened low-poly spheres as clouds, one flat colour, pinned to NDC points of the upper frame and drifting sideways; 500 fixed-size star points; drives sun/hemi intensity and every `userData.glow` emissive by `night`. **`untone()` pre-inverts ACES** because the composer tone-maps the whole frame: every new sky colour must go through it or it washes out. |
| `js/world/mood.js` | Per-region day look (`entry`, `sp`, `lon`, `gla`): zen/hor/cloud/light colours, sun/hemi scale, fogK, cloudOp, `rain` (only Glasgow = 1). Blended along scroll progress `t`. Tested by `tests/mood.test.mjs`, `tests/hero-mood.test.mjs`. |
| `js/world/rain.js` | 600 (250 mobile) identical straight `LineSegments` streaks in a 70×40×70 box around the bus, constant slant, one colour, opacity `0.55*amount`. Nothing else. |
| `js/world/scene.js:108,209-211` | Wires sky, mood and rain; rain amount = `mood.rain * (1 - 0.5*night)`. |
| `js/world/post.js` | EffectComposer, HalfFloat target, bloom, grade pass, OutputPass (ACES). |
| `js/world/water.js` | River plane with analytic sky/sun highlights. |
| `js/world/glass-reflection.js` | Analytic sky reflection on shared glass (inherits sky colours). |

Problems observed in captures (2026-10-26; stops SP 5, London 9.5, Glasgow 11, day/night):

1. Sky is a flat two-colour gradient. No sun glow, no horizon haze band, no depth.
2. Clouds read as flat stacked pancakes: one colour, no lit top or shaded base, no softness,
   no variety (all the same cumulus type).
3. Sun is a white sticker with a faint ring. No bloom halo, no warm glow in the sky around it.
4. Moon is a cartoon (crater dots). Night sky is a uniform navy; stars are uniform dots.
5. **Glasgow shows a bright sun by day and a full bright moon by night while it is raining.**
   Weather and sky contradict each other.
6. Rain is thin uniform lines over a dry world: no darker storm sky, no low cloud deck, no wet
   ground, no puddles or reflections, no splashes, no mist, no change in lighting.

## Goals

### A. Sky dome
- Replace the two-stop gradient with an analytic sky: zenith → mid → horizon band plus a
  **sun-direction glow (Mie-like lobe)** that warms the sky around the sun and a slightly
  brighter horizon haze band that meets the fog colour exactly (no seam where the city meets
  the sky). Option: adapt three's `Sky.js` (Preetham), but it must pass through `untone()` /
  the ACES inverse and stay stylized; a custom gradient you control is acceptable and probably
  easier. Keep all colours driven by `mood.js` per region plus `night`.
- Sunset tints when `night` is between 0 and 1 (the theme toggle animates through it): warm
  orange/pink horizon, purple zenith on the way to night.
- Night: deep blue zenith, slightly lighter horizon (city light pollution glow over SP and
  London, low and warm), not flat navy.

### B. Clouds
- Soft, volumetric-looking clouds with a **lit top, shaded blue-grey base and soft edges**,
  coloured by sun direction and time of day (golden rims at sunset, dim blue-grey at night,
  moonlit edges).
- Technique suggestion (choose and justify): camera-facing billboards or a few large dome-layer
  quads with an FBM noise shader (procedural, no textures), alpha-feathered; or keep the sphere
  clusters but add a vertical shade gradient plus a noise-dithered alpha edge. Two layers at
  least: puffy cumulus mid-layer plus thin high cirrus streaks.
- Region variety: SP = scattered fair-weather cumulus; London = more broken cloud; Glasgow =
  continuous low overcast deck that hides sun/moon.
- Keep the existing NDC-pinned placement concept (the follow camera looks down, so the sky only
  shows in the upper frame); clouds must never overlap UI or pop when the camera jumps between
  stops.

### C. Sun
- Disc plus a soft wide additive halo that blooms through the existing bloom pass, colour
  shifting from warm white at day to deep orange near sunset.
- Optional subtle lens flare (`Lensflare.js`) only on the `high` tier, and only if it looks
  tasteful; skip it if it reads cheesy.
- Veiled by cloud cover: opacity falls with `mood.cloudOp`/rain; under Glasgow overcast it must
  vanish (a faint brighter patch in the overcast is OK).

### D. Moon and stars
- Procedural moon: soft-edged disc with maria (large dark smooth patches, not dot craters), a
  faint limb darkening, a cool halo/glow; size close to the real angular size relative to the
  sun disc (already approximated). **Always a full moon (owner decision).**
- Stars: varied size/brightness, a few coloured, gentle twinkle (off with reduced motion),
  hidden near the horizon haze and fully hidden under overcast/rain. Optional faint Milky Way
  band on the `high` tier only.
- Moonlight: cool directional key at night already exists (`NIGHT.light`); keep it consistent
  with the moon position.

### E. Rain (hero feature)
Rain must read as *weather*, not a particle effect. A believable rainy scene has:

1. **Storm sky:** when `rain` > 0, darken and desaturate the sky, lower the cloud deck, hide sun
   and moon, shorten fog (`fogK`), lower sun intensity, raise cool hemisphere fill. Most of this
   exists in `mood.gla`; make it complete and consistent.
2. **Streaks:** two or three depth layers (near: longer, brighter, faster, slightly thicker;
   far: shorter, fainter, denser), per-streak length/speed/opacity variation, gusting wind slant
   that changes slowly over time, motion-blur-like fade along each streak (head bright, tail
   transparent). Streaks catch light: brighter near street lamps and headlights at night and
   against dark backgrounds; nearly invisible against bright sky. Keep the camera-following
   wrap box approach (cheap) but centre it on the camera view, not only the bus.
3. **Rain curtain / mist:** distant haze sheets or a fog boost so far buildings fade into rain;
   optional slanted translucent "rain shafts" in the distance.
4. **Wet surfaces:** a global `uWet` (0–1) uniform injected (`onBeforeCompile`) into the shared
   ground/road/sidewalk/roof materials: darker albedo, lower roughness, stronger specular so the
   sun/sky/lamps reflect. Roads should look glossy black with blurred streaks of headlight and
   lamp reflection at night.
5. **Puddles:** procedural puddle mask (noise in world XZ) on roads/sidewalks/plazas, mirror-ish
   in the mask (analytic sky colour plus lamp/headlight highlights; no SSR), tiny animated
   ripple rings where drops land (normal perturbation, off with reduced motion and on low
   tiers).
6. **Splashes:** small short-lived splash sprites or ripple rings on the ground near the camera
   and on the river surface (`water.js`: rain rings on the water plane).
7. **Ramp in/out:** rain, wetness and storm sky fade in over the existing mood blend as the bus
   enters Glasgow, and the ground dries more slowly than the rain stops (wetness lags
   rain amount by a few seconds of scroll).
8. **Night rain:** lamp halos slightly larger and softer (wet air), streaks lit inside lamp
   cones, glossy reflections on the road.
9. **Lightning (owner decision):** rare, soft, distant sheet lightning inside the cloud deck
   while it rains. Brightens a patch of the overcast and gently lifts the hemisphere fill for a
   fraction of a second; no bolts across the screen, never a full-screen strobe. At most about
   one flash every 20–40 s, never more than 3 flashes per second at any time
   (WCAG 2.3.1 photosensitivity), luminance change kept small. Fully off under reduced motion.
   Strongest in São Paulo storms, rarer in London, almost never in Glasgow drizzle (agent's call).
10. **Weather system (owner decision, 2026-10-26):** rain is no longer Glasgow-only. Build a
    small data-driven weather state (e.g. `clear | cloudy | rain`, with `rain`, `wet`, `storm`
    amounts) that `mood.js` blends per region, so London and São Paulo can rain too. Each region
    keeps its own rain character: London = steady grey drizzle; São Paulo = heavier tropical
    downpour (bigger, faster drops, warmer dim light); Glasgow = cold persistent drizzle under
    full overcast. Keep it one module, no engine.
    **Trigger (owner decision):** random once per visit, rolled independently per region with a
    different chance per city. Starting chances (agent's call, tune after captures): Glasgow 70%,
    London 45%, São Paulo 25%. Roll once on load (one seed per page load), never per frame, so
    the weather does not flicker while scrolling. Non-raining regions still get their own
    variety from the same roll (clear vs broken cloud). For validation add a query override,
    e.g. `?weather=rain|clear` (applies to every region), so captures and tests are
    deterministic. Reduced motion keeps the roll but renders rain statically (storm sky + wet
    ground, no falling streaks).
11. **No rain sound:** the site has no audio; do not add any.

## Deliverables and order

Work in vertical slices; capture and show the owner after each:

1. Sky dome plus sun glow plus horizon haze (all regions, day/night/sunset).
2. Clouds (two layers, region variety, overcast deck for Glasgow).
3. Sun/moon/stars polish, sun/moon hidden under overcast/rain.
4. Rain: storm sky, layered streaks, mist.
5. Rain: wet surfaces, puddles, splashes, water rings, night reflections.

Update `docs/art-direction.md` (sky/weather section) and `docs/audits/full-scene-visual-atlas.md`
(sky/clouds row grade) at the end. Log any asset in `ASSET_SOURCES.md`.

## Validation per slice

- `node --test tests/` (mood tests must stay green; add a small test if you add mood fields
  such as `wet` or `storm`).
- Captures, same shots every time: SP stop 5, London stop 9.5, Glasgow stop 11, each in day and
  night, plus one mid-transition (sunset) and one mobile 375 px. Serve with
  `python3 -m http.server 8000`, open `http://localhost:8000/`, set the theme with
  `localStorage.setItem('theme','night'|'day')` and reload, wait for `body.world-ready`, then
  scroll to a stop: `const s=await import('/js/scroll.js'),c=await import('/js/content.js'),
  L=await import('/js/world/layout.js'); const n=c.stops.length,m=s.stopMarks(L.routePoints(n));
  scrollTo({top:s.scrollYForStop(i,n,document.documentElement.scrollHeight,innerHeight,m)})`
  (stop ids: 5 = São Paulo, 9/10 = London, 11 = Glasgow). Use whatever headless browser your
  environment provides; if you have none, say so and list the shots for the owner to check.
  Do not install npm packages to get one.
- Reduced motion: rain static/off, no drift, no twinkle, no lightning. WebGL off: site usable.
- Zero console errors.
- Performance A/B only at slice 4/5 and the end (paired p95 per `rendering-budget.md`), not for
  every tweak.

## Success criteria

- A first-time visitor sees a sky that could pass as a stylized game key-art sky in every
  region and time of day.
- In Glasgow, someone with the sound off "feels" the rain: dark sky, no sun/moon, glossy wet
  streets, puddles, mist, visible drops, while text and the bus stay readable.
- No regressions in the matrix: desktop + mobile, day/night, EN/PT, WebGL off, reduced motion.

## Anti-goals

- Photoreal skybox photos, HDRIs or anything that clashes with the stylized city.
- Rain that hides the bus, the panel text or landmark sightlines.
- Strobing, full-screen flashes, or heavy screen-space effects that tank mobile.
