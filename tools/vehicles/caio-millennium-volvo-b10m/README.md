# Caio Millennium II Volvo B10M — São Paulo

The build script imports the supplied Sketchfab GLB, removes its stray plane, corrects the model axes and ground origin, repaints the source meshes with the existing `Bus*` material roles, projects a texture-free blue sweep onto the body and window surfaces, and keeps the exported mesh below 12k triangles.

```bash
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/build_sao_paulo_bus.py -- --source "$CAIO_SOURCE"
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/validate_sao_paulo_bus.py -- assets/vehicles/sao-paulo-bus.glb
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/render_sao_paulo_bus.py -- assets/vehicles/sao-paulo-bus.glb tools/vehicles/caio-millennium-volvo-b10m/renders/desktop
```

The source GLB is external and supplied via `--source`; its private local path is not embedded in the script or runtime. Asset attribution and licence are recorded in `ASSET_SOURCES.md`.

Validated export: 6.4k triangles; reimported mesh bounds 16.76 × 2.63 × 3.10 m; +X forward, +Y up, +Z right in the GLB; no images. The blue sweep follows the +X body section (x=2.8–6.4 m), ray-projects onto body, glass, and trim side surfaces, and sits 6 mm off the shell. Six named FL/FR/ML/MR/RL/RR wheel pivot markers carry axle positions/radius as node extras. The source wheel geometry is still embedded in larger meshes; runtime wheel splitting/rotation is a follow-up integration task.
