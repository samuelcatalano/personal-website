# Double-decker bus asset (London + Glasgow liveries)

`assets/vehicles/double-decker-bus.glb` is an original, fully procedural low-floor double-decker (New Routemaster / StreetDeck proportions) authored by `build_bus_dd.py`. No third-party mesh or texture is used (the earlier Sketchfab base model was retired on 2026-10-29).

Rebuild and preview:

```bash
blender -b --factory-startup -P tools/vehicles/double-decker-bus-dd/build_bus_dd.py        # writes assets/vehicles/double-decker-bus.glb
blender -b --factory-startup -P tools/vehicles/double-decker-bus-dd/render_views.py -- assets/vehicles/double-decker-bus.glb tools/vehicles/double-decker-bus-dd/renders after london
blender -b --factory-startup -P tools/vehicles/double-decker-bus-dd/render_views.py -- assets/vehicles/double-decker-bus.glb tools/vehicles/double-decker-bus-dd/renders after glasgow glasgow   # CLOSE=1 for detail views
```

Contract: forward +X, up +Y, right +Z (kerb side = left = three.js -Z), ground y=0, 11.7 x 4.3 x 2.8 m incl. mirrors. 13.7k triangles, 0.39 MB, 17 material-role buckets, no textures or vertex colours. Meshes: `BusBody BusAccent BusStripe BusTrim BusGlass BusHeadlight BusTaillight BusDisplay BusInterior BusSkirtF BusSweep BusLilac BusRear BusMark BusMark2` (+ `BusRubber`, `BusMetal` on wheels and details); wheel nodes `FL FR RL RR` (origin at the wheel centre, no rotation). The stamped-steel wheel dish uses ten dark slots and ten raised lug nuts instead of thin radial cutouts. Only `BusDisplay` has UVs (front, rear and side blinds for `destMat`).

How it is built: the hull is lofted from rounded-rectangle outlines (0.74 m plan radius at nose and tail, raked upper deck, tumblehome, 0.45 m roof radius, crowned roof); wheel wells, the continuous upper-deck glass band (wraps nose and tail), the lower band with its raked front step, kerb doors, front and rear lower screens and the thin dark pillars are all cut into the skin with exact planes (flush `BusGlass` over a dark `BusInterior` copy, `BusTrim` frames); coplanar same-role faces are merged afterwards. Livery regions are position cuts (skirt, stripe line, diagonal sweep bands, roof, roundel) that the runtime recolours per city in `BUS_VARIANTS`: London keeps one red (with roundel `BusMark` ring + `BusMark2` bar), Glasgow is purple with a white roof, white and lilac sweep and a magenta line (roundel painted out).
