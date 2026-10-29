# Caio Millennium II Volvo B10M — São Paulo

The build script imports the supplied Sketchfab GLB, removes its stray plane, corrects the model axes and ground origin, repaints the source meshes with the existing `Bus*` material roles, assigns the full-height articulation bellows to the light metallic `BusMetal` finish, projects a texture-free blue sweep onto the body and window surfaces, and preserves the supplied mesh density for both hero and secondary traffic. The supplied source is about 80k triangles; the exported bus has 52,588 after removing dense wheel-face islands and adding the livery sweep. No triangle-count cap or ambient decimation is applied.

```bash
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/build_sao_paulo_bus.py -- --source "$CAIO_SOURCE"
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/validate_sao_paulo_bus.py -- assets/vehicles/sao-paulo-bus.glb
blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/render_sao_paulo_bus.py -- assets/vehicles/sao-paulo-bus.glb tools/vehicles/caio-millennium-volvo-b10m/renders/desktop
```

The source GLB is external and supplied via `--source`; its private local path is not embedded in the script or runtime. Asset attribution and licence are recorded in `ASSET_SOURCES.md`.

Validated export: 52,588 triangles across 8 render meshes (one per `Bus*` material role); reimported mesh bounds 16.76 × 2.63 × 3.10 m; +X forward, +Y up, +Z right in the GLB; no images. The source meshes are joined by semantic role without decimation, preserving the remaining high-resolution geometry and reducing draw calls to eight. The blue sweep follows the +X body section (x=2.8–6.4 m), ray-projects onto body, glass, and trim side surfaces, and sits 6 mm off the shell. Six named FL/FR/ML/MR/RL/RR wheel pivot markers carry axle positions/radius as node extras. The source wheel geometry is still embedded in larger meshes; runtime wheel splitting/rotation is a follow-up integration task.

Hero and secondary traffic share the same high-resolution GLB, preserving silhouette quality and material-role batching.
