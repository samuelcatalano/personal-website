# Original Wellington statue

Original Blender-authored geometry; supplied Wellington photographs are visual references only. No reference pixels, external geometry, textures or dependencies are included. The statue is a normal Glasgow camera asset, with broad anatomy and silhouette taking priority over close-up ornament.

Build and diagnostic renders (installed Blender):

```sh
blender -b --factory-startup -P tools/landmarks/wellington/build_wellington.py
blender -b --factory-startup -P tools/landmarks/wellington/render_wellington.py -- tools/landmarks/wellington/wellington-original-poc.glb /private/tmp/wellington-pass/renders
```

The build creates the POC GLB and copies the identical production GLB to `assets/landmarks/wellington.glb`. No `.blend` file is needed: the deterministic script is the editable source. Blender axes are +X horse forward, Z up; GLB/Three axes are +X forward, Y up. Ground origin is Y=0. The exact 5.8 × 3 pedestal footprint and 2.6 top datum match the procedural source. Overall bounds are [-2.9,0,-1.5] to [2.927,7.775,1.5]; the muzzle projects beyond the pedestal, within the previous envelope.

Three semantic meshes/materials: bronze (12,544 triangles), stone (1,728), vertex-colored cone (332), total 14,604 triangles. The connected horse/rider mass uses voxel fusion, smoothing and controlled decimation. Articulated legs, curved neck, shaped muzzle, ears, coat skirts, boots, bicorne and reins establish the silhouette. Broad saddle/coat folds replace reliefs, medals and facial microdetail.

The cached loader owns source geometry and materials for the module lifetime. Each world gets an independent cloned root with shared resources. Successful adoption disposes only procedural geometries; world teardown removes its clone without invalidating another world. A failed load retains the procedural statue and a disposed world rejects a late result. `tests/wellington.browser.py` checks the contract through browser-harness on the local preview.

No new lights, emission, environment maps, textures, renderer passes or changes to other landmarks. Fine relief panels and highly detailed likeness are outside this normal-camera scope.
