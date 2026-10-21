# Full-scene visual atlas — North Star audit

Date: 2026-10-21. Branch `feat/site-gamefication`. Reference: the user-supplied **North Star** image (stylized golden-hour city: glass towers with mullions, warm plaster low-rise with awnings/balconies, dense round street trees, rich plaza with lamps/benches/flowerbeds, many pedestrians, smooth readable vehicles, painted road markings, MASP-like red frame, Estaiada-like X cable-stayed bridge, sparkling water, saturated blue sky). Direction, not a scene to copy.

"Atlas" here = visual **inventory**, not a texture atlas.

## Method

`createWorld` was driven through the real scroll route at 1440×900 (UI hidden, day theme), every stop and every half-stop: 35 positions covering Hero → São Paulo (Sé, MASP, Copan, Estaiada) → Heathrow → London (Big Ben/Parliament, London Eye, Tower Bridge) → countryside → Glasgow (George Square, Riverside, University) → London east (towers, terraces) → Wembley. Capture script: browser-harness, `window.__go(stopFloat)` → `scrollYForStop`. WebGL OK, zero console errors. Captures are machine-local (session scratchpad `before/`); representative BEFORE/AFTER pairs are listed at the end.

## Grades

**A** North-Star ready · **B** good, needs polish · **C** clearly below North Star · **D** placeholder/legacy, rebuild.
Recommendation: KEEP / POLISH / REBUILD / REPLACE. Cost: S < 1h, M few h, L day+.

### Architecture

| System | Grade | State vs North Star | Crit. | Gain | Cost | Rec. |
|---|---|---|---|---|---|---|
| Townhouse / terrace | B | Recessed windows, brick base, slate roofs; reads well. Missing awnings/balconies, flat lighting makes plaster grey | Med | Med | — | KEEP (approved geometry); lighting pass lifts it |
| Shop / mixed low-rise | B | Storefront bays exist; no awnings/canopy colour accents | Med | Med | S | KEEP geometry; lighting |
| Midrise | B | Good bays/rhythm | Low | Low | — | KEEP |
| Office | B | Grid façades OK; glass reads grey-blue under flat light | Med | Med | — | KEEP; glass/lighting |
| Tower | B | Straight/stepped/asymmetric families; mullion grid OK; glass too dark/grey vs North Star cyan-blue | High | High | S | POLISH via lighting/sky (glass reflection is analytic sky) |
| Industrial / special (Copan) | C | Copan = stacked flat slabs, no S-curve brise-soleil read | Med | Med | M | POLISH (deferred) |
| Distant backdrop | C | Flat grey boxes; acceptable at distance once fog/haze is warmer | Low | Med | S | POLISH via atmosphere |

### Landmarks

| Landmark | Grade | State | Crit. | Gain | Cost | Rec. |
|---|---|---|---|---|---|---|
| Wembley | A- | Continuous bowl + tubular arch (modernized) | Low | Low | — | KEEP |
| Big Ben / Parliament | B+ | Modernized, 4 clock faces | Low | Low | — | KEEP |
| MASP | B | Modernized; red frame + glass box, matches North Star language | Low | Low | — | KEEP |
| **London Eye** | **D** | Ring of 60 separate cubes + cube spokes; reads as dotted voxel circle | **High** | **High** | S | **REBUILD**: tube rim, spokes, A-frame legs, capsules |
| **Ponte Estaiada** | **D** | Stepped cube stack forming X, cube "cables" | **High** | **High** | S | **REBUILD**: tapered continuous X pylon, real cable fans, deck |
| **Catedral da Sé** | **D** | Voxel stepped domes/spires | High | High | M | **REBUILD**: lathe dome, octagonal spires, gothic massing |
| Tower Bridge | C | Box towers, no pointed roofs/turrets | High | High | M | **REBUILD**: gothic towers, pyramidal roofs, corner turrets, blue walkways |
| Heathrow | D | Grey box terminal + box control tower | Med | Med | S | REBUILD: curved roof terminal, tapered control tower w/ cab |
| Glasgow Riverside / University | C | Voxel saw-tooth roof / box gothic | Low | Med | M | POLISH (secondary, deferred) |
| Wind turbines | B | Readable | Low | Low | — | KEEP |

### Vehicles

| Vehicle | Grade | State | Crit. | Gain | Cost | Rec. |
|---|---|---|---|---|---|---|
| **Mini Cooper (player, SP)** | **D** | ~150 boxes; octagon wheels; reads as voxel toy | **High** (on screen all of SP) | **High** | M | **REBUILD**: extruded rounded body, glasshouse, round lamps, cylinder wheels |
| Routemaster (player, UK) | B- | Extruded rounded shell, real window rhythm; box details | High | Med | S | POLISH: rounded roof, curved windscreen frame, better wheels |
| Ambient cars + black cabs | D | `car()` voxel boxes | High | High | M | **REPLACE** with shared smooth car family (sedan / hatch / cab / van), deterministic colours |
| Ambient bus (UK) | B- | Same as Routemaster | Med | — | — | inherits Routemaster |
| **Airplane** | **D** | Box fuselage/wings/stepped tail | High | High | S | **REBUILD**: cylindrical fuselage, nose/tail cones, swept wings, engines, fin |
| Boats | C | Boxes | Low | Low | S | POLISH (optional) |
| Vans/trucks/emergency/rail | — | Not present | — | — | — | Not added (no scope need) |

### Public realm

| System | Grade | State | Crit. | Gain | Cost | Rec. |
|---|---|---|---|---|---|---|
| **Roads** | C | Near-black asphalt, small white dashes only | High | High | S | POLISH: lighter warm asphalt, double yellow centre (SP) / white (UK) lines, edge lines |
| Crossings | D | None | Med | Med | S | ADD zebra at stops |
| Curbs / sidewalks | B | Tangent curbs, grey pavers | Med | Med | — | KEEP; warmer palette |
| Plazas | B- | Large bare paved areas | Med | Med | — | lighting + trees |
| Parks | B | Lawns, paths, beds, benches | Low | Med | — | KEEP |
| Waterfront / water | B | Gradient water, shimmer | Med | Med | S | POLISH: warmer glint, bluer |
| Bridges (generic) | C | Boxes | Low | Low | — | deferred |
| Benches / lamps / phone booths / bus stops / signs | B | Readable boxes, phone booths good | Low | Low | — | KEEP |

### Nature

| System | Grade | State | Crit. | Gain | Cost | Rec. |
|---|---|---|---|---|---|---|
| **Trees** | C | Painted billboard atlas (good art), but capped at 4.2 m and sparse; street edges bare | **High** | **High** | S | POLISH: larger capped size, fuller crowns, street-verge trees |
| Shrubs / understory | B | Low ellipsoids | Low | Low | — | KEEP |
| Grass | B- | Saturated green, slight noise | Med | Med | S | warmer tint via lighting |
| Flowerbeds | B | Coloured boxes | Low | Low | — | KEEP |

### Environment

| System | Grade | State | Crit. | Gain | Cost | Rec. |
|---|---|---|---|---|---|---|
| **Lighting / atmosphere** | **C** | Flat, pale, desaturated; fog washes everything grey-white; sun weak vs hemi | **Highest** (every pixel) | **Highest** | S | **POLISH**: golden-hour key, warmer/stronger sun, lower hemi, saturated sky gradient, warmer haze |
| Sky / clouds | B- | Rounded clouds, pale gradient | High | High | S | deeper zenith blue, warm horizon |
| Shadows | B | PCF soft 1024 | Med | Med | — | contrast via key/fill ratio |
| Glass | B | Analytic sky reflection | Med | Med | — | inherits sky |
| Ground materials | B | Triplanar noise | Low | Low | — | KEEP |

### People

| System | Grade | State | Crit. | Gain | Cost | Rec. |
|---|---|---|---|---|---|---|
| Pedestrians | B | Animated billboard atlas, good density and scale | Low | Low | — | KEEP |

## Root-cause summary (§5 resolution audit)

The gap is **not texture resolution**. Architecture uses a 512² generated atlas + metric UVs; trees use a 1254² painted atlas; noise is 16² triplanar tiled at 1 m (fine). Actual causes, in order:

1. **Lighting/atmosphere** — flat key/fill ratio, pale fog, desaturated tone: every system looks a generation older.
2. **Voxel legacy geometry** — vehicles, plane, London Eye, Estaiada, Sé, Tower Bridge, Heathrow use `voxel.js` unit boxes. Silhouette problem, solved with geometry, not maps.
3. **Vegetation scale/density** — trees capped small; streets lack canopy rhythm.
4. **Road surface** — no markings, near-black.

Details: [asset-quality-spec](../art/asset-quality-spec.md). Plan: [north-star-full-scene-upgrade](../plans/north-star-full-scene-upgrade.md).

## Progress log

- 2026-10-21 — audit complete (35 captures).
- M1/M2 (6e63848): lighting/atmosphere C→B+ (golden key, saturated sky, colour grade), roads C→B+ (centre/edge lines, zebras), trees C→B+ (round canopies, verge rhythm), water B→A-.
- M3 (264ec8f): Mini D→A-, Routemaster B-→A-, ambient cars D→B+ (5 shared smooth types).
- M4 (352990e): London Eye D→A, Estaiada D→A-, Sé D→B+, Tower Bridge C→B+, Heathrow D→B+, airplane D→B+.
- M5 (0e30066, 1f712b2): Copan C→B+ (S-curve + brise-soleil), Riverside C→B+, University C→B+, boats C→B, George Square City Chambers + Wellington statue C→B+.
- Technical gate (60d7670): strict coplanar guard 207 → 0 pairs via source nudges (0.01–0.04 m).

## Final traversal — 2026-10-21

Same 35 positions re-captured. No region of the route still reads as the old voxel generation for its dominant elements. Remaining deliberate limits (graded **C**, cheap by design): distant backdrop boxes (fog-covered), generic lamp posts/benches, legacy box detailing on a few far-side special plots. Approved building families unchanged (B).

BEFORE / AFTER (left/right, 1440×900 day, UI hidden):

- [Hero](captures/00.0-hero.jpg) · [São Paulo street + Sé + MASP](captures/03.5-insane.jpg) · [Copan, Estaiada, airplane, Heathrow](captures/06.5-reclame.jpg)
- [London: Big Ben, London Eye, Thames](captures/10.0-olm.jpg) · [Glasgow George Square](captures/11.0-glasgow.jpg) · [Wembley / contact](captures/17.0-contact.jpg)

## Vehicles / Heathrow / night lighting — 2026-10-21

Heathrow removed (site rebuilt as riverside); A330 now an independent 40 m flyover (B+); Mini A-, LEVC cab B+, New Routemaster A-, Glasgow StreetDeck B+ (distinct model, swap hidden in a railway arch); traffic 20 vehicles with speed profiles. Night: Estaiada, Tower Bridge, Riverside and Wembley arch lit (B+/A-). Spec: [vehicles/Heathrow/night design](../superpowers/specs/2026-10-21-vehicles-heathrow-night-design.md).
