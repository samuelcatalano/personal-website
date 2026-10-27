# Mini Cooper F56 asset

`assets/vehicles/mini-cooper.glb` is a game-ready derivative of "2014 Mini Cooper S (F56)" by [Ddiaz Design](https://sketchfab.com/ddiaz-design), CC-BY-NC-SA-4.0, owner-approved 2026-10-27 ([source](https://sketchfab.com/3d-models/2014-mini-cooper-s-f56-bec89391257c426d824a8b0434bbcf6b)). The derivative stays CC-BY-NC-SA-4.0; keep the attribution.

Rebuild (source GLB is gitignored in `assets/models/source/mini-f56/`):

```bash
blender -b --factory-startup -P tools/vehicles/mini-cooper-f56/build_mini_f56.py          # writes assets/vehicles/mini-cooper.glb
blender -b --factory-startup -P tools/vehicles/mini-cooper-f56/render_views.py -- assets/vehicles/mini-cooper.glb tools/vehicles/mini-cooper-f56/renders after
```

Same contract as the previous Mini: forward +X, up +Y, right +Z, ground y=0, 3.9 x 1.7 x 1.5 m. Nodes `CarRoot` > `Body` (9 materials) + `FL FR RL RR` (origin at the wheel centre, no rotation, tyre `CarTrim` + rim `CarRim`; calipers stay on the body). Materials: CarBody, CarRoof (roof, mirror caps, calipers, twin bonnet stripes cut by exact planes), CarGlass, CarTrim, CarChrome, CarHeadlight, CarTaillight, CarInterior, CarPlate. No textures, no UVs. The script decimates each source piece to a triangle budget (`T` dict), rebuilds the tyre as a 36-segment revolve, drops engine and hidden internals.

Runtime: the player's front wheels steer from the path heading change (`js/world/scene.js`); ambient Minis do not.

`renders/` holds before (procedural Mini) and after stills with the player palette.
