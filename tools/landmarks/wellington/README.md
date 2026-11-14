# Original Wellington statue

Original Blender-authored geometry; supplied Wellington photographs are visual references only. No reference pixels, external geometry, textures or dependencies are included. The statue is a normal Glasgow camera asset, with broad anatomy and silhouette taking priority over close-up ornament.

Build and diagnostic renders (installed Blender):

```sh
blender -b --factory-startup -P tools/landmarks/wellington/build_wellington.py
blender -b --factory-startup -P tools/landmarks/wellington/render_wellington.py -- tools/landmarks/wellington/wellington-original-poc.glb /private/tmp/wellington-pass/renders
```

The build creates the POC GLB and uses the existing `tools/pipeline/compress-lossless.mjs` (installed pipeline tooling) to write a Meshopt-compressed production GLB with identical decoded data to `assets/landmarks/wellington.glb`. No `.blend` file is needed: the deterministic script is the editable source. Blender axes are +X horse forward, Z up; GLB/Three axes are +X forward, Y up. Ground origin is Y=0. The exact 5.8 × 3 stone pedestal footprint and 2.6 top datum match the procedural source. Current overall Three.js bounds are [-2.9,0,-1.5] to [2.93175,7.90,1.5]. Existing placement, orientation and cone are preserved.

## Reference-led sculpt revision — 2026-11-14

Actually viewed reference photographs (reference only; no photographs shipped):

- [Art UK, Equestrian Monument to the Duke of Wellington](https://artuk.org/discover/artworks/equestrian-monument-to-the-duke-of-wellington-254058), [viewed profile photograph](https://d3d00swyhr67nd.cloudfront.net/w1200h1200/collection/PUBSCULPT/G1/G1_GB_S038-014.jpg): upright arched neck, forward ears, strong shoulder/haunch, raised tail root, hanging tail, uniform skirts and saddle cloth. The Art UK HTML page returned 403; its photograph was fetched and viewed successfully.
- [University of Exeter, Cast in Stone](https://castinstone.exeter.ac.uk/database/s/en/item/3769), [viewed frontal three-quarter photograph](https://castinstone.exeter.ac.uk/database/files/large/04fccd1eed9ca0981e545e455dca9966404e8fc4.jpg), credited on the source page to Jacqueline Banerjee: chest/leg separation, rein loops, military coat and bronze battle-relief panels within stone moldings.

The original procedural model now has interpolated anatomical lofts, fuller shoulder/pectoral/haunch transitions, less crouched hindlegs, a slightly lifted/extended far forehoof matching the profile photograph, and a higher tail root. Narrow coat-tail sheets, a draped scalloped saddle cloth, epaulettes/fringe, lapels, sash, buttons, boot stirrups, short overlapping mane locks, eyes/nostril rims and continuous bridle/reins establish recognizable medium-distance detail. A shallow bronze mounting plate meets the hooves. Original abstract infantry/cavalry friezes fill the side panels; stone end-panel moldings complete the other views. These reliefs evoke the reference's craft and are not a reconstruction of its battle scenes. The face remains a stylized likeness, not a portrait scan.

Bronze uses coherent position-based vertex patina exported as standard glTF vertex colors, with roughness 0.51 and metalness 0.58. No procedural shader must run in Three.js. The existing cone retains its reflective band, truncated neck and chamfered square rubber foot.

| Authored asset | Baseline | Revised |
| --- | ---: | ---: |
| Bronze triangles | 12,544 | 87,622 |
| Stone triangles | 1,728 | 2,808 |
| Cone triangles | 408 | 408 |
| Total triangles | 14,680 | 90,838 |
| GLB bytes | 415,008 | 2,780,048 |
| Semantic meshes / materials | 3 / 3 | 3 / 3 |
| Image textures / external buffers | 0 / 0 | 0 / 0 |

This is the authored quality source. The extra geometry is an explicit quality cost; delivery compression preserves all authored detail. No decimation of the final delivery asset is implied by these numbers.

Validation: Blender build assertions check finite coordinates, exactly three meshes, the preserved stone footprint/top datum and a bounded authored triangle count. The production GLB is 1,636,452 bytes (41.14% below the 2,780,048-byte authored source); the compressor reads it back and asserts identical decoded accessors, materials and scene metadata. No geometry simplification, attribute precision reduction or texture changes; glTF checks confirm three meshes/materials, normals, no images and no external buffers. Baseline and revised renders were inspected from front, rear, both sides and three-quarter under identical offline studio lighting. Diagnostic rendering now prints bytes, per-mesh triangles and world bounds. Local review images are in `/tmp/wellington-upgrade/{baseline,final}/`; reference downloads are temporary and are not repository artifacts. Browser/runtime integration and the product matrix are separate primary-agent checks.

The cached loader owns source geometry and materials for the module lifetime. Each world gets an independent cloned root with shared resources. Successful adoption disposes only procedural geometries; world teardown removes its clone without invalidating another world. A failed load retains the procedural statue and a disposed world rejects a late result. `tests/wellington.browser.py` checks the contract through browser-harness on the local preview.

No new lights, emission, environment maps, textures, renderer passes or changes to other landmarks. Highly detailed portrait likeness and exact historical relief reconstruction remain outside this normal-camera scope.
