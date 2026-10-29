# Double-decker bus asset (London DD Bus)

`assets/vehicles/double-decker-bus.glb` is a game-ready derivative of "London DD Bus" by [jsa201077](https://sketchfab.com/unityjsa7), CC-BY-4.0 ([source](https://sketchfab.com/3d-models/london-dd-bus-a2a2736856a7452bbbaf712e07ed8eb4)). Keep the attribution; changes: hidden geometry filtered, source tessellation preserved, re-materialed, wheels re-rigged, repainted per city. The Glasgow livery is an original stylised repaint (white / blue skirt / magenta swoosh) from a reference photo of a McGill's bus; no logos or text.

Rebuild (source GLB is gitignored in `assets/models/source/london-bus/`):

```bash
blender -b --factory-startup -P tools/vehicles/double-decker-bus-dd/build_bus_dd.py        # writes assets/vehicles/double-decker-bus.glb
blender -b --factory-startup -P tools/vehicles/double-decker-bus-dd/render_views.py -- assets/vehicles/double-decker-bus.glb tools/vehicles/double-decker-bus-dd/renders after-london london
blender -b --factory-startup -P tools/vehicles/double-decker-bus-dd/render_views.py -- assets/vehicles/double-decker-bus.glb tools/vehicles/double-decker-bus-dd/renders after-glasgow glasgow
```

Contract (drop-in for the old bus): forward +X, up +Y, right +Z, ground y=0, 11.6 x 4.3 x 2.8 m (length, height, width incl. mirrors; old bus 11.2 x 4.4 x 3.2). 58,806 triangles, 1.32 MB, 14 material-role buckets, no textures or vertex colours. Body meshes: `BusBody BusAccent BusStripe BusTrim BusGlass BusHeadlight BusTaillight BusDisplay BusInterior BusSkirtF BusSweep BusLilac BusRear`; wheel meshes also use `BusRubber` and `BusMetal` plus nodes `FL FR RL RR` (origin at the wheel centre, no rotation; 64-segment tyres with four shallow circumferential grooves, 48-segment dished rims with dark `BusTrim` wedges so the spin reads; rear single wide tyres). Only `BusDisplay` has UVs (front blind + one blind on each side, laid out for `destMat`'s canvas).

Paint: the source texture is not used (its big triangles bleed over window edges). The build cuts the skin by exact planes (skirt, swoosh, rear kick, window rectangles from the glass panes, front line) and assigns by position: `BusAccent` = skirt (dark red London, blue Glasgow), `BusStripe` = swoosh and line above the screen (`BUS_VARIANTS.stripe`; omitted for London so it vanishes into the red body), `BusTrim` = window frames, arches, bottom lip. Glass panes block the visibility rays, so skin vs saloon is decided by what a ray reaches from outside; the saloon (frame, seats, floors) is one dark `BusInterior` mesh using the retained source tessellation.

Kerb-side (left, +Y) doors: front entrance and centre exit, glazed leaves recessed behind the skin with trim surround and seam; paint stops at the frames. The rear kick flashes end below the rear window sill. London colour `#b52a2d` / `#7e1c20`.

`renders/` holds before (procedural bus; Glasgow was purple/silver) and after stills with approximate runtime finishes.
