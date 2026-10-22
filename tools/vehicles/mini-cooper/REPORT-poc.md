# MINI Cooper (F56 look) POC report

Files: build_mini.py, render_mini.py, validate_mini.py, mini-original-poc.glb (+ .blend), renders/ (10 views, all_views.jpg, left_vs_right.jpg, compare.jpg, validate.txt).
all_views.jpg order: row1 front, front_right, right, rear_right, top_right; row2 rear, rear_left, left, front_left, top_left.
compare.jpg: top row = reference, bottom row = model; columns right, front, rear, front_right.

## Metrics
- Dims: L 3.82, W 1.73 (mirrors extra, ~1.9), H 1.44; wheelbase 2.53, overhang 0.74 / 0.55; wheel dia 0.64.
- Side profile traced from right.png (top silhouette tables in px at top of build_mini.py); vertical scale 0.88 of the ref because the ref is taller than a real F56.
- Tris 7242 total incl. 4 wheel instances (6012 unique); verts 4110; meshes 5 (Body, Roof, Glass, Lights, Wheel); materials 7; textures 0; GLB 171 KB.
- Hierarchy: CarRoot > Body, Roof, Glass, Lights, Wheels > FL FR RL RR (shared Wheel mesh).
- validate_mini.py: Body side faces outward/inward LEFT [841,38] RIGHT [841,38]; Glass [4,0]/[4,0]; Lights [62,0]/[63,0]; Roof [47,0]/[47,0]. The 38 inward-flagged faces per side are the concave wheel-arch cavity walls (symmetric, expected). Build-time check: body shell + glasshouse non-manifold edges = 0. After GLB re-import the Body island shows 228 non-manifold edges because decals/flares weld onto the shell on import (decal sheets are open by design); roof 78 (stripe sheets).

## Per view (honest)
- right / left: GOOD. Floating roof, black pillars, two-pane glass, door cut, chrome belt strip, red mirror caps, black sill. Wheel arches are clean after iteration 2 but still slightly faceted.
- front: GOOD. Round chrome headlamps, hex moustache grille, bonnet scoop, twin red stripes, fog lamps, lower intake. Grille chrome surround is thin; lamp lenses are plain white discs.
- front_left / front_right: GOOD. Reads as a MINI instantly.
- rear: MINOR FIX. Oval tail lamps with chrome rings, plate recess, diffuser, exhaust. Lamps are slightly fat and the plate recess is only an outline.
- rear_left / rear_right: MINOR FIX. The roof rear end shows a red oval/blade overhanging the rear glass (looks like a spoiler; ref has a thin flat lip).
- top_left / top_right: GOOD. Three roof stripes, hood stripes, scoop readable.

## Issues / known limits
- No interior: glasshouse is an opaque black shell with semi-transparent glass over it (no seats visible).
- Wheel rims use CarChrome (silver-grey) instead of graphite; brake calipers omitted.
- Lights lack a day/night emissive split beyond mild emission on CarHeadlight/CarTaillight; no door-flap, wipers, antenna.
- Left/right render diff in left_vs_right.jpg includes lighting differences (fixed sun), not only geometry.
- compare.jpg ortho framing for front/rear is approximate (refs are perspective).
- 2 corrective iterations used (arch row snapping + flares, roof lip); stopped per policy.

## Round 2 (lead review) changes
- Rear: roof now ends in a flat thin lip (5 cm slab, ~4 cm overhang), red blob gone; tail lamps moved inboard (flush, vertical ovals 0.33 m, chrome ring, red lens, dark inner ring); body-colour hatch panel with plate recess outline; black diffuser (z 0.19-0.40) below body-colour bumper, exhaust left, two red reflectors.
- Roof narrowed to hw 0.575 over 0.55 pillar band (<=3 cm side overhang), squarer plan, 3 cm crown.
- Front: dark lens + white halo ring + chrome bezel headlamps; wider/taller grille with thicker chrome.
- Wheels: CarTrim spokes/disc (graphite-black, CarTrim lightened to #17191c), chrome lip ring only.
- A-pillar: corner radius 0.12 -> 0.09, side glass front edge and windscreen widened.
- Validate: Body L/R [790,38]/[789,38] (1-face exhaust asymmetry by design), Glass/Lights/Roof 0 inward.
- Remaining: hatch/plate outlines are thin dark lines; roof rear lip slightly wide in 3/4 rear; rear views now MINOR FIX (not re-judged vs ref by the lead).

## Round 3 (user-approved, geometry unfrozen) - before -> after
- Tris 7242 -> 9244 (instances incl.; hard cap 12k); verts 4110 -> 5026; meshes 5 -> 6 (added Interior); materials 7 -> 10 (added CarInterior, CarPlate, CarRim); GLB 171 -> 229 KB; textures 0.
- Interior visible: real window openings (boolean cuts in the pillar shell, solidify liner with CarInterior inner faces), cabin hole in the body top, Interior mesh = floor, RHD front seats (driver on -Y/three.js +Z), rear bench, dash + binnacle, steering-wheel ring, parcel shelf, door cards. Glass = 4 single-sided outward panes recessed 12 mm into the openings (CarGlass, runtime can fade it).
- Rear plate: raised body-colour frame with real walls (~2 cm recess), raised CarPlate panel, chrome hatch handle strip; tail lamps gained ring + bar graphic.
- Roof: greenhouse tumblehome 0.65 -> 0.50 half-width, roof half-width 0.525 (<=2.5 cm overhang), rounder edge (arc profile), 5.5 cm slab, thin raised strips, antenna.
- Wheels: CarRim graphite spokes (10) + rim ring, dark recessed CarTrim disc/hub, chrome lip + cap, red CarRoof caliper, rounded tyre (596 tris each).
- Extras: grille and lower-intake faceted honeycomb, chrome intake inserts, headlamp projector detail, shaped mirror housings with black glass face + stalks, door handle recess + chrome handle, side skirts, windscreen/rear wipers.
- Validate (renders/validate.txt): Body L/R outward [858,857] inward [88,87] (inward = arch cavity walls + the solidify liner, symmetric; 1-face exhaust asymmetry); Glass/Lights/Roof 0 inward; Interior [18,4] both sides. Closed body shell was 0 non-manifold at build time; Body now has an intentional cabin opening and open decal sheets, so re-import shows non-manifold edges on its islands.
- New renders: front_right_close.png, rear_close.png.
- Known: hood scoop reads as a flat patch in the close-up; grille chrome is faceted; roof rear lip still wide in rear 3/4; spokes are flat quads (no thickness); not re-rated per view vs refs.

## Round 4 (final polish)
- Tris 9244 -> 11472 (cap 12k); verts 5026 -> 6897; GLB 229 -> 288 KB; meshes 6, materials 10, textures 0.
- Hood scoop: now a raised CarBody dome (10x10 grid, sunk 4 mm at the edge so it blends into the bonnet) with a CarTrim slot; no separate pale decal.
- Grey smear behind the mirror: not stray geometry. Re-rendering with sun shadows off (NOSHADOW=1 env flag in render_mini.py) removes it; it is the mirror's cast shadow.
- Roof: greenhouse top half-width 0.519, roof 0.532 (~1.3 cm side overhang), front end at 0.49 (<=1.5 cm over the screen header); only the rear keeps a ~9 cm lip.
- Smoothness: headlamp bezel/halo rings 36 segs, lens 32, fog lamps 32, tail-lamp ovals 22/18 rows, grille chrome 24x12 grid, arch flares 28 segs (was 14).
- Spokes: 16 mm thick (top + two side walls).
- Validate: Body L/R outward [1033,1031] inward [100,100] (arch cavity walls + liner; 1-2 face difference = exhaust/handle details); Glass/Lights/Roof 0 inward both sides; Interior [18,4] both sides.
- Remaining: roof rear lip wide in rear 3/4; grille honeycomb is faceted shading only; per-view GOOD/MINOR/NO-GO not re-rated vs refs.

## Round 5 (max-realism pass) - before -> after
- Tris 11472 -> 26026 (incl. 4 wheel instances; budget 30k); verts 6897 -> 15867; GLB 288 -> 611 KB; meshes 6 (<=8), materials 10 (<=14), textures 0.
- Surface: body lofted with ~70 stations x 54 ring points (analytic refinement, rounded shoulder, bottom roll-in, finer rows at the sill), 26 stations x 32 pts on the roof; smooth shading threshold 66 deg so curved panels have no seams; roof edge arc profile.
- Gaps: real shallow grooves (dark floor between two soft raised lips) for both door lines, bonnet clamshell sides, hatch outline, right-hand fuel flap (right side only, so Body L/R tri counts differ by the flap).
- Roof rear lip: shorter (-1.47), thinner (60% thickness at the tail), spoiler-like; small third brake light on the rear screen.
- Grille: smooth round-section chrome tube (8 sides) around the hex outline, backing plate and ~170 hex honeycomb cell frames.
- Lights: headlamps = chrome bezel + white LED halo + chrome reflector cone + projector barrel/lens + clear glass dome (in Glass mesh); tail-lamp lens domed with ring, bar and inner dark ring; fog lamps with torus bezel; wing side repeaters (oval); mirror indicator strips; number-plate lamps.
- Wheels/tyres: 16-point rounded tyre profile (sidewall bulge, shallow tread groove), 10 concave 5-segment spokes 16 mm thick, caliper, centre cap, arch liners (half cylinders) inside every arch, wheels moved 15 mm inboard.
- Glass: panes bowed 6-12 mm with a black CarTrim ceramic border band (Glass mesh slot 1).
- Interior: seat bolsters + rounded headrests, console with armrest, gear lever and ball, round centre display (chrome ring), steering wheel, dash.
- Details: wiper arms, antenna fin + whip, washer jets, rear diffuser fins, exhaust tip, front and rear tow-eye covers.
- Validate: Body outward/inward L [2527,291] R [2818,333] (extra right faces = fuel flap; inward = arch cavity, liners and cabin liner); Glass [224,0] both; Interior [22,4] both; Lights [175,2] both; Roof [151,1]/[151,2]. Closed body shell 0 non-manifold at build time.
- New renders: hero_low_close.png (plus front_right_close, rear_close, all 10 views, compare, left_vs_right, all_views).
- Known: bonnet stripe ends show small speckle at the nose lip; plate-recess frame and hatch groove rectangle overlap slightly at the bottom edge; plate panel is blown out in the preview lighting; grille tube looks thin in 3/4; only checked front_right_close, hero_low_close and rear_close visually this round.
