# Vehicles, Heathrow removal and landmark night lighting — design & plan

Date: 2026-10-21 · Branch `feat/site-gamefication` · Status: **for user review, not implemented**.

## Intent

Make the vehicles read as the user's North Star references (Mini Cooper, London black cab, London double-decker, Glasgow First-style bus, BA-style A330) as **3D procedural models** in the existing Three.js scene; make the A330 an independent ambient element; remove Heathrow and fold its site back into the city; give Ponte Estaiada, Tower Bridge, Riverside Museum and the Wembley arch convincing night lighting. DAY stays natural; NIGHT gets markedly better; performance stays flat.

**Decided by the user:** 3D models, not sprites (no spritesheets, no 8-direction frames, no road graph, no pathfinding, no camera change, no new airport, no purple Routemaster as Glasgow bus, no dozens of dynamic lights). Five visually distinct vehicle models. Keep the route-curve traffic system. A330 decoupled from Heathrow and from the Mini→bus transition. Heathrow removed completely; site rebuilt from existing city systems.

**Reference reading (silhouette, not textures):**

| Vehicle | Real-world model the reference shows | Must read as |
|---|---|---|
| Mini Cooper | current F56-style Mini hatch: cream body, red roof + mirror caps, twin red bonnet stripes, roof stripes, black wheel-arch trim, oval headlamps, hexagon grille, bonnet scoop | instantly "Mini" from the 3/4 follow camera |
| London Cab | LEVC TX: tall rounded van-like body, big upright chrome radiator grille, round headlamps, lit TAXI roof sign, rear-hinged rear doors | black cab, not a black SUV |
| London Bus | New Routemaster: rounded front, asymmetric diagonal glazed staircase band on the side, black front lower mask, dot-matrix destination ("19 Finsbury Park" style), white roof pods | London bus of today |
| Glasgow Bus | Wright StreetDeck in First purple/white: squarer body, white-silver front/swoosh, purple body, lavender diagonal stripes, yellow mirror heads, white roof pods, orange LED destination ("6 Renfrew Street" style) | different bus from London at a glance |
| A330 | twin-engine wide-body: long cylindrical fuselage, tapered nose/tail, swept wings with winglets, two underwing turbofans, tall fin; white body, navy belly, red/white/blue tail ribbons | an airliner, not a bus-sized toy, not half the map |

**Trademarks (my call):** no logos/wordmarks (BA speedmarque/tail art, TfL roundel, First "f" mark, MINI badge). Use livery colours and abstract shapes only. Destination text uses generic route numbers/street names.

## A. Current state (audit summary)

- Renderer: Three.js 0.169, PerspectiveCamera follow shots (hero/follow/high/closing) blended with arcs; PCF shadows (desktop), GTAO + sun rays (high tier), bloom (threshold .95), OutputPass + colour grade.
- Vehicles: `vehicles.js` builds smooth merged geometry per material role, cached per type, materials shared (`fixed(role)`, `paint(color)`); `bus.js` builds the Routemaster shell + `setLivery()` purple repaint; `ambient.js` drives 15 vehicles along the route curve (two lanes, constant speed, `uk` region flags); headlight cones/pools/tails are fake additive quads (`beams.js`).
- Player: Mini while `t < swapAt`, Routemaster after; Routemaster repaints purple inside `scotRange`.
- Coupling to Heathrow (`LANDMARKS.heathrow = 'move'`): `swapAt` (Mini→bus, also used by `mood.js`, `roadmarks.js`, `ambient.js` uk flags), `planeAt` (plane only flies near that stop, positioned relative to the bus), boats start x (`ambient.js`), kiosk start (`city.js`), Heathrow geometry (`landmarks.js` + `createHeathrow`), frontage exclusion (`city.js`), block reservation `H('heathrow')` (`blocks.js`), tests (`landmarks.browser.py`, `landmark-geometry.browser.py`, `architecture-migration.test.mjs`, `content.test.mjs`).
- Night: `sky.update` drives `material.userData.glow` emissive by night level; landmark night uniforms in `landmark-materials.js`; lamp pools/beams are additive decals; zero point lights.

## B. Proposed changes

### B1. Decouple region/aircraft logic from Heathrow
- **CHANGE:** add `ukStart(stops)` = index of first `country === 'UK'` stop in `layout.js`; `swapAt` derives from it. Boats start and kiosk start use the same helper. `planeAt` is deleted. `LANDMARKS.heathrow` is deleted.
- **WHY:** the "Moved to London" border is a content fact (country field), not an airport.
- **FILES:** `layout.js`, `ambient.js`, `city.js`, `scene.js`, `landmarks.js`, `tests/content.test.mjs`, `tests/logic.test.mjs`.
- **APPROACH:** same numeric value as today (first UK stop is `move`), so mood/roadmarks/uk flags are byte-identical. Node test asserts `swapAt` unchanged and no `heathrow` string remains in `js/`.
- **RISK:** low. **PERF:** none. **VISUAL:** none (pure refactor).

### B2. Remove Heathrow and rebuild its site
- **CHANGE:** delete `heathrow()`/`createHeathrow`, its apron/stripes, dispose entry, tests. Remove the `city.js` frontage exclusion so the normal river-side terrace frontage appears. Fill the old site with an explicit own-RNG infill (same pattern as the starting-park infill in `blocks.js`): 2–3 London terrace/midrise blocks on the riverbank side plus verge trees, routed through the existing citywide rollout (`onArchitecturePlot`) so they get the approved building families.
- **WHY:** user request; site should read as ordinary city.
- **FILES:** `landmarks.js`, `landmark-geometry.js`, `city.js`, `blocks.js`, `scene.js`, tests above.
- **APPROACH / key constraint:** `blocks.js` skips reserved rectangles with `x += 6` and no `r()` draws, so deleting the `H('heathrow')` rectangle would **shift every later block in that row** (London, Glasgow, Wembley). Therefore the rectangle stays as a neutral, renamed reservation (`ukRiverfront`) that only preserves the RNG sequence, and the explicit infill places buildings inside it. City frontage removal is safe (`townhouse/house` already run on a no-op so RNG stays aligned).
- **RISK:** medium (layout determinism). Mitigation: fingerprint all block/plot descriptors outside the site before/after; must be identical.
- **PERF:** +2–3 buildings (~3–6k tris, inside existing chunk batches; 0 new materials). **VISUAL:** continuous London riverside where the airport was.

### B3. Vehicle architecture (minimal)
- **CHANGE:** one spec table in `vehicles.js`: `{ type: { length, width, height, wheelbase, track, wheelR, wheels:[[x,z]...], front, beamY, build(parts, {hero}) } }` and one entry point `buildVehicle(type, { hero = false, color })` returning a Group with `userData = { length, front, beamY, wheels: Object3D[] }`. No class hierarchy.
- **Shared:** wheel/tyre/hub geometry cached per radius, lamp discs, glass/chrome/tyre/lamp/plate materials (`fixed()`), paint per colour. **Distinct:** every body shell, glasshouse and identity part.
- **Hero vs ambient:** `hero:true` (player Mini, player buses) adds simplified interior (seats, poles, lit cabin plane), destination display, separate wheel objects for spin, higher segment counts. Ambient variants skip interiors, use 12-seg wheels, wheels merged.
- **WHY:** distinct models + healthy reuse without refactor theatre. **FILES:** `vehicles.js`, `bus.js` (becomes thin: London/Glasgow bus builders using shared parts), `ambient.js`, `scene.js`.
- **RISK:** low. **PERF:** neutral/positive (shared geometry). **VISUAL:** none by itself.

### B4. Mini Cooper (rebuild to reference)
- **APPROACH:** extruded rounded side profile (short overhangs, wheels at corners, upright windscreen, floating roof over blacked-out pillars), cream body, red roof with twin white roof stripes, red mirror caps, twin red bonnet stripes, bonnet scoop, oval chrome-ringed headlamps, hexagon lower grille, black arch trim, 5-spoke dark alloys, vertical tail lamps. Hero (player, São Paulo) + ambient (London traffic) variants. Envelope ~3.8×1.5×1.8 m.
- **RISK:** low. **PERF:** hero ≤6k tris, ambient ≤2.5k. **VISUAL:** matches reference.

### B5. London black cab (LEVC TX)
- **APPROACH:** tall boxy-rounded body (~4.9×1.9×1.85 m), big upright chrome grille with vertical slats, round headlamps, black gloss paint (roughness ~.3), large glasshouse, chrome belt line, lit TAXI sign (existing canvas material). Ambient only (≤3k tris). Replaces current `cab`.
- **RISK:** low. **VISUAL:** unmistakable black cab.

### B6. London bus (New Routemaster) — player + ambient
- **APPROACH:** new shell (rounded nose and tail, ~11.2×4.4×2.55 m), full-length lower/upper glazing, diagonal glazed staircase band front and rear, black lower front mask with round lamps, white roof pods, dot-matrix destination plane (canvas 256×64, emissive at night), yellow-tipped mirrors, interior seats/poles hint (hero only), warm cabin glow at night (existing glow path). Replaces the classic Routemaster; `setLivery` removed.
- **RISK:** medium: changes the player silhouette people know from the site; tests `vehicles.browser.py` envelope/livery checks are rewritten.
- **PERF:** hero ≤8k tris, ambient ≤4k. **VISUAL:** modern London bus per reference.

### B7. Glasgow First-style bus (Wright StreetDeck) — player in Scotland + ambient
- **APPROACH:** own shell: squarer roof line, flatter front with large two-piece windscreen, silver-white front and diagonal swoosh, purple body, lavender diagonal stripes, yellow mirror heads, orange LED destination, white roof pods. Player model swaps London↔Glasgow at the existing `scotRange` boundaries (instant swap — same moment the purple repaint happens today); ambient Glasgow traffic uses it too.
- **RISK:** low/medium (instant swap pop on camera; accepted today for the livery). **PERF:** same as B6. **VISUAL:** distinct Glasgow identity.

### B8. A330 + independent flight lifecycle
- **CHANGE:** new `aircraft.js` owning a tiny state machine `OFFSCREEN → ENTER → CRUISE → EXIT → COOLDOWN`, independent of stops/bus. Each cycle picks a diagonal path across the current view (computed from camera position/forward at ENTER), altitude 55–70 m, speed ~14 m/s, cruise ~20–25 s, cooldown 25–45 s (deterministic seed sequence). Gentle bank in/out, extremely subtle scale ease. Hidden when `prefers-reduced-motion`.
- **Model:** in `vehicles.js` (`buildVehicle('a330')`): lathe fuselage (16 seg) with nose/tail cones, cockpit windows, window band (dark strip), swept wings with winglets, 2 turbofans, stabilisers, tall fin; white body, navy belly, abstract red/white/blue tail ribbons. Visual length ~26 m (deliberately below real 58 m for readability at altitude).
- **Night:** nav lights red (left wingtip) / green (right) / white strobe (tail) as tiny glow meshes, strobe blinks; one additive soft ground blob shadow scaled by altitude (real shadow map does not reach 60 m reliably).
- **FILES:** new `aircraft.js` (why new: a self-contained ambient lifecycle with its own pure state function and test; doesn't belong to landmarks or traffic), `vehicles.js`, `scene.js`, `landmarks.js` (plane removed), `tests/aircraft.test.mjs` (pure state-machine test).
- **RISK:** low. **PERF:** ≤4k tris, ~5 draw calls only when visible. **VISUAL:** occasional elegant flyover in every section.

### B9. Traffic polish (same curve system)
- **Speed:** each vehicle gets a base speed by type (bus slow, cab/Mini medium) plus a smooth slow-down near zebra crossings/stops and ease back (speed profile over route parameter, integrated per frame → acceleration/deceleration without simulation).
- **Spacing:** per-lane minimum gap enforced by clamping progress behind the vehicle ahead (sorted per lane, O(n) per frame, n≈15).
- **Distribution:** London: 2 London buses, 4 cabs, 3 Minis, 3 generic cars; Glasgow: 2 First buses + 2 generic cars; São Paulo: generic cars only (+ player Mini). Total ≈ today's 15–16.
- **Wheels:** spin on hero vehicles only (separate wheel objects); ambient wheels static (sub-pixel at their distance).
- **Steering visual:** yaw lag smoothing (body yaw eases toward tangent yaw) — cheap, removes any snap at tight bends.
- **Lights:** existing beams; tail lamps brighten when decelerating (glowK bump), night only.
- **FILES:** `ambient.js`, `scene.js`. **RISK:** low. **PERF:** negligible CPU.

### B10–B13. Landmark night lighting (shared approach)
Add a fourth bucket to `landmark()` in `landmark-geometry.js`: **lights** — thin emissive strips/tubes merged into one mesh per landmark with one shared glow material (`userData.glow`, per-landmark `glowK` and colour), dark-neutral by day, emissive at night through the existing `sky.update` path; bloom threshold unchanged so only the brightest lines bloom softly. Optional **wash**: a few additive vertical-gradient quads (one shared material, opacity = night) for "uplight" on big faces. **Zero point lights.**

- **B10 Ponte Estaiada:** emissive edge strips along both X pylon legs (inner edges brighter), cables themselves move to the lights bucket (thin warm-white lines), deck-edge strip both sides, pylon-base wash. Distant read: glowing X + fan.
- **B11 Tower Bridge:** warm sodium-gold uplight wash on both stone towers, outline strips on tower corners/turret spires, upper walkways underside strips (cool white), chains as glowing lines (cool), deck-edge strip, lit gothic window recesses (existing glass → glow tint). No neon colours.
- **B12 Riverside Museum:** zig-zag roofline edge strip (cool white), glazed gable ends warm interior glow, entrance band, faint ridge accents on folds; walls stay dark.
- **B13 Wembley:** arch tube moved to lights bucket, strong cool-white glow (highest glowK in scene, beacon), cables faint; bowl glazing band low warm glow; stadium mass not emissive.
- **FILES:** `landmark-geometry.js`, `sky.js` only if a per-material night curve is needed. **RISK:** low/medium (bloom balance). **PERF:** +4 draw calls (+4 in normal pass on high), ≤6k tris total, 0 textures, 0 lights. **VISUAL:** four recognizable night beacons.

### B14. Day/night polish
Bus destination displays, cab sign, cabin glow, nav lights, landmark lights verified in both themes; DAY lights read as unlit fixtures (no emissive). Reduced-motion: no plane, static traffic as today.

## C. Files

| File | Change |
|---|---|
| `js/world/layout.js` | `ukStart`, `swapAt` via country; remove `LANDMARKS.heathrow` |
| `js/world/vehicles.js` | spec table, `buildVehicle(type,{hero})`, Mini, cab, generic cars, A330 |
| `js/world/bus.js` | London (New Routemaster) + Glasgow (StreetDeck) builders on shared parts; remove `setLivery`; keep `buildBus`/`buildMini`/`car` exports used by tests or update tests |
| `js/world/ambient.js` | distribution, speed profile, spacing, yaw smoothing, region models |
| `js/world/scene.js` | player model selection (Mini / London / Glasgow), hero wheel spin, aircraft unit, remove plane/planeAt |
| `js/world/aircraft.js` | **new** — flight lifecycle (pure state fn + update) |
| `js/world/landmarks.js` | remove heathrow + plane |
| `js/world/landmark-geometry.js` | remove `createHeathrow`/`createPlane`; lights bucket; Estaiada/TowerBridge/Riverside/Wembley light lines |
| `js/world/blocks.js` | neutral reservation + own-RNG infill |
| `js/world/city.js` | drop Heathrow frontage exclusion; kiosk start via `ukStart` |
| `tests/*` | vehicles, landmarks, landmark-geometry, architecture-migration, content, logic, zfight walk list; new `aircraft.test.mjs` |
| docs | atlas, plan, rendering budget, ASSET_SOURCES (still no external assets) |

## D. Vehicle / asset architecture

```text
SPECS[type] → buildVehicle(type, {hero, color})
  ├─ shell (type-specific extrude/lathe profile)      ← distinct
  ├─ glasshouse / identity parts (grille, stripes…)   ← distinct
  ├─ wheels (cached per radius; hero = spinnable)     ← shared
  ├─ lamps / plates / mirrors (cached)                ← shared
  ├─ materials: fixed(role) + paint(color)            ← shared
  ├─ night: userData.glow on head/tail/sign/display/cabin/nav
  └─ userData {length, front, beamY, wheels}
```

Merged per material role (≤8 meshes per vehicle). No textures except: existing TAXI sign canvas, 2 destination canvases (256×64). No LOD system: numbers don't justify it (ambient ≤3–4k tris, ~15 cars); hero/ambient split covers it; frustum culling handles distance. Revisit only if a measured scene needs it.

## E. Performance budget

| Item | Now | Planned | Δ |
|---|---|---|---|
| Ambient vehicles | 15, ~2.9k tris each, ~8 calls each | ~16, ≤3–4k tris, ≤8 calls | ~+10k tris, ~+8 calls |
| Player vehicles | Mini 4.5k + bus 4.2k (one visible) | hero ≤6k / ≤8k (one visible) | ~+4k |
| Plane | 2.3k, visible near one stop | ≤4k, visible ~40% of time | +2k when visible |
| Heathrow | ~0.9k + apron boxes | removed; +2–3 buildings ~3–6k in existing batches | ~+3k, 0 calls |
| Landmark lights | — | 4 meshes, ≤6k tris | +4 calls (+4 normal pass) |
| Materials / textures | — | +1 glow material per landmark (4), +2 destination canvases | small |
| Lights / shadow maps | 0 new | 0 new | 0 |

Ceiling: whole-scene draw calls +≤5%, submitted tris +≤5%, p95 within the established +1 ms desktop / +2 ms mobile limits (rendering-budget measurement contract).

## F. Implementation phases (adjusted order)

Decoupling and removal happen before the new models so each later phase is purely additive. Two independent tracks after phase 3: **vehicles** (vehicles/bus/ambient/scene/aircraft) and **lighting** (landmark-geometry) never touch the same files.

| # | Phase | Checks |
|---|---|---|
| 1 | Decouple: `ukStart`, `swapAt`, boats/kiosks; extract plane into `aircraft.js` lifecycle using the current plane model | Node (swapAt identical), mood/roadmarks unchanged, plane visible in other sections |
| 2 | Remove Heathrow + infill site | descriptor fingerprint outside site identical, citywide/real-city/landmarks suites, before/after capture 07.0–08.0 |
| 3 | Vehicle architecture: spec table + `buildVehicle`, port current types, no visual change | vehicles suite, zfight, same captures |
| 4 | Mini (hero + ambient) + London cab | vehicles suite, close-ups + route shots |
| 5 | London bus + Glasgow bus + player/ambient region swap | vehicles suite (rewritten envelope/region checks), shots 07.0, 10.0, 11.0 |
| 6 | A330 model + nav lights + blob shadow | aircraft test, day/night shots |
| 7 | Traffic polish (speed, spacing, distribution, yaw smoothing, hero wheel spin) | vehicles suite traffic checks, short screen recording |
| 8 | Lights bucket + Ponte Estaiada | night shots 05.5–06.5 |
| 9 | Tower Bridge lighting | night 10.5 |
| 10 | Riverside lighting | night 11.0 |
| 11 | Wembley arch lighting | night 16.5–17.0 |
| 12 | Day/night polish, perf sample (desktop high + mobile medium), full Node + 32 browser suites, console, final traversal day+night | milestone matrix |

Commits per phase; Sonnet implementers, Opus reviews/integrates; tracks 4–7 and 8–11 can run in parallel.

## Left to the builder

Exact profiles, segment counts within budget, colours within the references, timing constants of the flight lifecycle, glowK values, infill building mix (must use existing families).

## Calls I made (not yet confirmed by the user)

- No logos/wordmarks anywhere; abstract liveries.
- A330 visual length ~26 m at 55–70 m altitude.
- The Heathrow block reservation survives as a neutral RNG placeholder (renamed) to keep every other block in place; the site is filled by explicit infill.
- Player bus swaps model instantly at the existing Scotland boundaries.
- No runtime LOD; hero/ambient variants instead.
- Plane hidden under reduced motion.

## Builder-check answers

- **Authorization:** the user explicitly requested every item in this document (vehicles, Heathrow removal, the four night passes) on 2026-10-21; CLAUDE.md already records the reopened freeze and the Anthropic model policy (Sonnet implements, Opus orchestrates/reviews, Haiku for cheap mechanical work). Implementation still waits for the user's approval of this plan.
- **Parallel tracks:** allowed — vehicle files and `landmark-geometry.js` lighting never overlap; implementers do not commit, the primary agent reviews and commits per phase.
- **Player bus:** the user asked for the London bus "of the reference" (New Routemaster) — classic Routemaster is replaced; phase 5 is its own commit so it can be reverted alone.
- **Heathrow infill (my call):** river-side terrace frontage via the removed `city.js` exclusion (±23 m) plus two own-RNG blocks inside the old 36×24 m reservation — one London terrace pair and one 4–5 floor midrise, both through the citywide rollout families, with verge trees. No new landmark; the "Moved to London" stop keeps its stop sign, Thames and London frontage.
- **Night pass bar:** user visual sign-off on same-camera night captures (05.5–06.5, 10.5, 11.0, 16.5–17.0) plus the budget ceilings in E.
- **Test tooling:** exists — 32 `tests/*.browser.py` suites run via browser-harness and the measurement contract in `docs/architecture/rendering-budget.md`.
