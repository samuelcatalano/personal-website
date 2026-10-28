# Caio Millennium II Volvo B10M — São Paulo

The build script imports the supplied Sketchfab GLB, removes its stray plane, corrects the model axes and ground origin, repaints the source meshes with the existing `Bus*` material roles, adds a texture-free blue sweep, and keeps the exported mesh below 12k triangles.

```bash
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/build_sao_paulo_bus.py -- --source "$CAIO_SOURCE"
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/validate_sao_paulo_bus.py -- assets/vehicles/sao-paulo-bus.glb
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/render_sao_paulo_bus.py -- assets/vehicles/sao-paulo-bus.glb tools/vehicles/caio-millennium-volvo-b10m/renders/desktop
```

The source GLB is external and supplied via `--source`; its private local path is not embedded in the script or runtime. Asset attribution and licence are recorded in `ASSET_SOURCES.md`.

Validated export: 6.4k triangles; 16.76 m long, 2.73 m body width (3.25 m including mirrors), 3.10 m tall; +X forward, +Y up, +Z right in the GLB; no images. Six named FL/FR/ML/MR/RL/RR wheel pivot markers carry axle positions/radius as node extras. The source wheel geometry is still embedded in larger meshes; runtime wheel splitting/rotation is a follow-up integration task.
