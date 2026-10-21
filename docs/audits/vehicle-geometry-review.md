# Vehicle geometry review vs North Star references — 2026-10-21

The user rejected the first pass of the vehicle models: **silhouette, proportion and geometry**, not textures or logos. Validation rule from now on: **with all colour removed (clay render), each vehicle must still be identified immediately.** References (user-supplied, local only): mini, London cab (LEVC TX), London bus (New Routemaster), Glasgow bus (Wright StreetDeck, First livery), A330.

Current models: `js/world/vehicles.js` (commit 3584528 / e053b4b). Findings come from isolated turntables at 3/4 front, side, 3/4 rear.

## Mini (current gen hatch)

| Aspect | Current | Reference | Fix |
|---|---|---|---|
| Silhouette | Box with rounded corners; reads as a generic low-poly car or a classic Mini | Soft, bulbous "bulldog" body; pronounced shoulder; short tail | Loft the body from several rounded cross-sections (not one extruded side profile) |
| Bonnet | Flat, horizontal, long | Short, domed, falls steeply to a rounded nose; clamshell shut-lines; scoop | Domed bonnet sloping ~12–15° down to the nose |
| Windscreen | Nearly upright | Raked ~55–60° from vertical, wraps into A-pillars | Rake the screen; black A-pillars |
| Roof | Flat slab | Slightly arched "floating" roof, blacked pillars all round, overhangs glass | Separate arched roof shell over a black pillar band |
| Wheels | Inset from corners, thin arches | At the very corners, short overhangs, round flared black arches | Wheelbase/length ratio ≈ 0.64; black arch rings |
| Lamps / grille | Small round lamps, small grille | Large near-oval headlamps with chrome rings set into the wings; hexagonal upper + wide lower grille; vertical tail lamps | Big oval lamp pods; hex grille |
| Side glass | Low and long | Tall-ish glasshouse, rising beltline toward rear, D-pillar kick | Glasshouse ≈ 38% of height |

## London cab (LEVC TX)

| Aspect | Current | Reference | Fix |
|---|---|---|---|
| Silhouette | Square wagon/SUV; flat roof; hearse-like length | Tall, rounded "capsule" body; roof arches and is highest at the rear doors; very short nose | Loft from rounded sections; arched roof |
| Bonnet / nose | Long flat bonnet | Very short sloping bonnet, almost one-box; big upright grille stands proud at the nose | Shorten bonnet to ~18% of length |
| Windscreen | Upright, small | Very large, steeply raked, deep | Large raked screen |
| Rear | Vertical slab | Vertical but softened, rounded corners, large rear screen | Round the rear corners |
| Glass | Small windows | Huge glazed area; separate rear-hinged door glass | Tall glasshouse, thin pillars |
| Wheels | Large relative to body | Small wheels, tall body, deep sills | Wheel radius ≈ 0.18 × height ratio smaller |
| Identity | Grille + sign | Big vertical chrome grille + round lamps + TAXI sign | Keep, scale up grille |

## London bus (New Routemaster) — highest priority

| Aspect | Current | Reference | Fix |
|---|---|---|---|
| Silhouette | Rectangular double-decker box with rounded edges | Rounded "pebble" profile: front and rear corners strongly radiused in plan and elevation; roof edges rounded | Loft body from rounded rectangle sections with large end radii |
| Front | Flat face with black panel | Large curved two-level windscreen; black front mask wrapping round the lower front; destination display integrated in the upper mask | Curved front glass; integrated black mask band |
| Staircase glazing | Thin diagonal polygon on top of a box | Big asymmetric diagonal glazed band sweeping up from the front door to the upper deck — structural part of the body | Cut the diagonal glass into the body side as a recessed glazed volume, front and rear |
| Windows | Uniform rectangles | Continuous glazing following the body, upper deck band curving round the front | Continuous ribbon glazing |
| Rear | Flat | Rounded rear with its own diagonal glass | Rounded rear |
| Wheels | Large, centred | Smaller, front axle near the front, rear axle forward of the tail | Axles per reference proportions |
| Roof | Flat with white discs | Rounded roof edges; rectangular white AC pods | Rectangular pods |

## Glasgow bus (Wright StreetDeck)

| Aspect | Current | Reference | Fix |
|---|---|---|---|
| Identity | Variation of the London geometry | Squarer, upright modern body; distinct from the NRM even in clay | Own body: upright sides, flatter roof, squarer rear |
| Front | Copied front | Flat, upright front; large two-piece windscreen (lower screen deep, upper deck screen separate), split by a destination band; silver lower front | Own front geometry |
| Upper deck | Same proportions as London | Upper deck tall, front upper screen nearly vertical | Upright upper front |
| Windows | Same ribbons | Regular rectangular bays with pillars, both decks | Bay-pillar glazing |
| Rear | Rounded | Square rear with engine louvres | Square rear |
| Livery | OK colours | Purple body, silver/white front and diagonal swoosh, lavender diagonal stripes, yellow mirror heads, orange LED destination, white roof pods | Keep, apply to new shell |

## A330

| Aspect | Current | Reference | Fix |
|---|---|---|---|
| Fuselage | Short, thick | Long slender wide-body tube, length/diameter ≈ 10 | Slender lathe |
| Nose / cockpit | Blunt | Rounded A330 nose, cockpit windows band | A330 nose profile |
| Wings | Short, little sweep | Long, ~30° swept, high aspect ratio, winglets, dihedral | Longer swept wings |
| Engines | Small | Two large turbofans slung forward under the wings | Large nacelles on pylons |
| Tail | Simple fin | Tall swept fin with red/white/blue ribbon, swept stabilisers | Taller fin |
| Belly | — | Navy belly | Keep |

## Flyover

The new lifecycle placed the aircraft high and far, so it was almost never seen. Required: restore the **original user-visible flyover** (plane passes beside the bus around the "Moved to London" stop, `scene.js` before bfb029d: `x = bus.x + 16 + d·60`, `y = max(3, 14 − d·10)`, `z = bus.z + 8`, visible for |d| < 1) with the dependency taken from `ukStart` instead of Heathrow, and only swap the model to the A330.
