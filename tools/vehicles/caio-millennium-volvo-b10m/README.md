# Caio Millennium II Volvo B10M (São Paulo articulated bus)

Authored from scratch in Blender (`build_sao_paulo_bus.py`, no external source): a lofted low-floor body with rounded corners, a raked wrap-around windscreen and destination blind, window and door pockets cut with exact booleans (so frames and recesses are real geometry, not overlapping panels), three sliding doors on the right/kerb side, a pleated bellows joint, rear engine grille and tail lamps, wheel arches, roof units and six wheels. The livery sweep is a recessed `BusSweep` ribbon cut into the lower body (no coplanar overlay).

```bash
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/build_sao_paulo_bus.py
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/validate_sao_paulo_bus.py -- assets/vehicles/sao-paulo-bus.glb
VIEWS=front-34,side,rear-34,front-close blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/render_sao_paulo_bus.py -- assets/vehicles/sao-paulo-bus.glb tools/vehicles/caio-millennium-volvo-b10m/renders/desktop
```

Contract (js/world/vehicle-assets.js depends on it): +X forward, +Y up, +Z right in the GLB; 16.758 x 3.10 x 2.634 m with the origin on the ground at the centre; one render mesh per `Bus*` role (BusBody, BusSweep, BusTrim, BusGlass, BusRubber, BusMetal, BusHeadlight, BusTaillight, BusDisplay; the dark skirt is BusTrim); empties FL/FR/ML/MR/RL/RR at x = +5.8 / +0.75 / -5.3, |z| = 0.98, y = 0.52 with `wheel_radius` 0.52. Only wheel triangles lie inside those circles (tyre, rim, discs and lug nuts use BusRubber/BusMetal), so ambient buses can still split and spin the axles. `BusDisplay` carries UVs for the destination canvas (front blind and a small right-side blind). No images are embedded.

Budget: about 14.6k triangles, 9 render meshes, 0.42 MB (the previous source-derived asset had 52.6k triangles, 8 meshes and 1.6 MB).
