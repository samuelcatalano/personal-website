# London cab TX4 asset

`assets/vehicles/london-cab.glb` is a game-ready derivative of "LTI TX4 London Taxi" by [Nieve5677](https://sketchfab.com/iori308408), CC-BY-4.0 ([source](https://sketchfab.com/3d-models/lti-tx4-london-taxi-9e57abf043744b86adbbc96083da637b)). Keep the attribution; changes: decimated, re-materialed, vertex-coloured, wheels re-rigged.

Rebuild (source GLB is gitignored in `assets/models/source/london-taxi/`):

```bash
blender -b --factory-startup -P tools/vehicles/london-cab-tx4/build_cab_tx4.py          # writes assets/vehicles/london-cab.glb
blender -b --factory-startup -P tools/vehicles/london-cab-tx4/render_views.py -- assets/vehicles/london-cab.glb tools/vehicles/london-cab-tx4/renders after
```

Contract (drop-in for the old cab): forward +X, up +Y, right +Z, ground y=0. 8,227 triangles, 398 KB, 4.572 x 1.932 x 2.211 m (length, height incl. roof sign, width incl. mirrors). Six buckets `CabBody CabGlass CabRubber CabTrim CabInterior CabLights`, each with normals and COLOR_0 (body/glass/rubber/trim/interior white, tinted by the runtime materials; lamps white, indicators amber, tail lamps red, roof sign warm amber). No textures, no UVs. Nodes `CarRoot` > six body meshes + `FL FR RL RR` (origin at the wheel centre, no rotation; tyre `CabRubber` revolve, dished rim `CabTrim` with alternating dark wedges so the spin reads). `axleWheels` takes the authored-node branch, so the old `CAB_AXLES` split is no longer used for the cab. Brake discs stay on the body.

The script culls faces not visible from outside (ray test, glass see-through), decimates per bucket to the `BUDGET` dict, adds a lit roof-sign slab and a dark radiator backing behind the grille. Ambient cabs do not steer.

`renders/` holds before (procedural cab) and after stills with approximate runtime finishes.
