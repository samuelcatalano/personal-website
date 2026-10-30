# Caio Millennium II Volvo B10M (São Paulo articulated bus)

Authored from scratch in Blender (`build_sao_paulo_bus.py`, no external source): a lofted low-floor body with rounded corners, a raked wrap-around windscreen and destination blind, window and door pockets cut with exact booleans (so frames and recesses are real geometry, not overlapping panels), three sliding doors on the right/kerb side, a pleated bellows joint, rear engine grille and tail lamps, wheel arches, roof units and six wheels. The livery sweep is a recessed `BusSweep` ribbon cut into the lower body (no coplanar overlay).

```bash
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/build_sao_paulo_bus.py
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/validate_sao_paulo_bus.py -- assets/vehicles/sao-paulo-bus.glb
VIEWS=front-34,side,rear-34,front-close blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/render_sao_paulo_bus.py -- assets/vehicles/sao-paulo-bus.glb tools/vehicles/caio-millennium-volvo-b10m/renders/desktop
```

Contract (js/world/vehicle-assets.js depends on it): +X forward, +Y up, +Z right in the GLB; 16.758 x 3.10 x 2.70 m (mirrors set the width) with the origin on the ground at the centre; one render mesh per `Bus*` role (BusBody green lower body, BusAccent lime roof lip / front chin, BusSweep light belt stripe and roundels, BusTrim black glazing band / front mask / skirt, BusGlass, BusRubber, BusMetal bellows, wheel discs and roof units, BusHeadlight, BusTaillight, BusDisplay); empties FL/FR (x +5.8), ML/MR (+0.75), RL/RR (-4.6) and TL/TR (-5.85, rear tandem) at |z| 0.98, y 0.52 with `wheel_radius` 0.52. Only wheel triangles lie inside those circles (tyre, steel disc, hub and lug nuts use BusRubber/BusMetal), so ambient buses can still split and spin the four axles. `BusDisplay` carries UVs for the destination canvas (front blind and a small right-side blind). Livery colours come from `BUS_VARIANTS['sao-paulo']` (green #0a8f3c, lime #9bd02a, light #e6eee6). No images are embedded.

Budget: about 25k triangles, 10 render meshes, 0.7 MB.

References followed: Caio Apache VIP / Caio-BYD electric buses of Goiania and the São Paulo articulated electric bus (black glazing band, black front mask with lime chin, tall glazed double doors on the kerb side, grey ribbed bellows, rear tandem axles, roundel with "SP").
