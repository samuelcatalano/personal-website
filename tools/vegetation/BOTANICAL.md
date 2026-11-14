# Original botanical trees

## Production integration decision — quality first

The active renderer uses **only the two physical mesh LODs**, including far trees; the 512px atlas below is a diagnostic authoring artifact and is **not requested at runtime**. This supersedes the originally proposed 3D→sprite path. Browser tests found that minified alpha masks removed foliage and exposed dark bark while the sprite retained a different apparent coverage/lighting response. Separate PNG/COLOR_0/GLB reimport probes proved the source colour faithful; no arbitrary colour correction was applied.

Runtime retains authored curved-leaf normals and source texture × vertex colour. The leaf map uses linear sampling without alpha-diluting mip averages and MSAA alpha-to-coverage; opaque bark retains its normal map/filtering. Both physical levels use the same materials/placement matrices. Near/mid brightness and projected-coverage guards cover all five families under flat and daylight illumination; mid/far use exactly the same physical geometry/materials. Standard chunk culling and 130/150 m hysteresis remain, without a flat billboard stage. More far geometry and possible fine cutout shimmer are explicit quality costs for the later performance pass.


Five original, reference-informed tree families for the existing city placement envelopes. `build_botanical_trees.py` creates the geometry and every production texture procedurally in Blender. It needs no `.blend`, downloaded asset, add-on, npm installation or external Python package. These are authored botanical approximations, not scans or claims of photographic species accuracy.

## Reproduce

From the repository root, using the installed Blender and existing lossless delivery tool:

```sh
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/vegetation/build_botanical_trees.py
node tools/pipeline/compress-lossless.mjs /tmp/vegetation-realism/authoring/botanical-trees.raw.glb assets/processed/vegetation/botanical-trees.glb
```

`BOTANICAL_EVIDENCE` changes the default `/tmp/vegetation-realism/authoring` evidence directory; use that same directory as the compression input. The Blender command writes the raw GLB both there and to the delivery path. The second command replaces only the delivery copy with verified lossless Meshopt: decoded attributes, indices/winding, textures, material parameters and transforms must remain equal. Reproduction was checked with Blender **5.2.3 LTS**. Use `--python-exit-code 1` so a failed assertion gives a failing process exit code.

## Runtime contract

- GLB meshes: `botanical-{oak,plane,birch,spruce,ipe}-LOD{0,1}`. All ten overlap at the origin. Exported geometry is Y-up, horizontally centred, foot Y=0 and top Y=1. LOD1 uses LOD0's coordinate normalization, not its own crown fit.
- Two shared materials: `botanical-bark` and `botanical-leaves`; roughness 0.94/0.87, metallic 0, no emission. Leaves are double-sided, glTF `MASK`, cutoff **0.42**. The generator explicitly patches Blender's dithered-alpha export to this contract and uses the same cutoff for diagnostics and impostors.
- Three embedded original maps: leaf/flower albedo **1024²**, bark albedo **1024²**, bark normal **512²**. `COLOR_0` carries modest variation and crown-interior/basal shading; multiply the authored texture by it. Do not replace the original palette with a flat instance colour.
- One diagnostic-only **2560×512 RGBA** atlas; left-to-right oak, plane, birch, spruce, ipê. Each tile is 512², front along glTF -Z, camera centred at `(0, fit/2)` in its screen plane. `fit=max(1, 2*radius)*1.16`; width and height use this same fit. The foot reaches the tile bottom, and transparent left/right margins prevent tile bleed. This bake is retained for authoring evidence; the active runtime uses the two physical GLB LODs at all distances, linear-filtered leaf textures and MSAA alpha coverage. Atlas parity is not a runtime acceptance gate.
- Atlas colour is unlit albedo × authored vertex colour. It contains no baked directional sun, specular term or cast shadow; diagnostic PBR highlights are consequently absent from the atlas. Source meshes contain no runtime emissive material.

## Morphology and measured cost

The branch hierarchy is trunk → uneven scaffold forks → secondary limbs → finer branchlets → alternating attached leaves. Bent broadleaf surfaces have leaf-specific silhouettes, petioles and restrained veins. Oak has spreading lateral and descending lower limbs; plane has a taller pruned crown; birch has pale mottled older wood, dark fine twigs and hanging tips; spruce uses irregular overlapping needle sprays; ipê mixes restrained terminal yellow corollas into green foliage. Roots taper out of the basal flare and meet the foot plane.

The final gameplay-density adjustment preserves every branch, attachment, seed and triangle count. Leaf/spray linear size scales are oak **1.45×**, plane **1.40×**, birch **1.20×**, spruce **1.60×**, ipê **1.55×**; flowers stay unchanged. This increases overlap of the existing small silhouettes rather than adding opaque inner masses. Actual front-view covered area grows 25.42%, 17.20%, 13.11%, 30.93% and 29.52% respectively after the standard bound normalization. Runtime placement centres and envelopes remain the integrating module’s source of truth.

LOD1 retains every leaf/spray/flower attachment, the branch hierarchy and crown envelope. It reduces leaf bending and fine-wood ring/segment counts. It does not decimate cutout triangles into isolated large crown panels.

| Family | LOD0 triangles | LOD1 triangles | Leaf/spray/flower surfaces | Radius | Billboard fit |
|---|---:|---:|---:|---:|---:|
| Oak | 61,108 | 34,548 | 9,450 | 0.516480 | 1.198234 |
| Plane | 69,196 | 39,116 | 10,710 | 0.439036 | 1.160000 |
| Birch | 66,148 | 37,584 | 9,996 | 0.410536 | 1.160000 |
| Spruce | 56,340 | 32,406 | 8,442 | 0.403384 | 1.160000 |
| Ipê | 58,536 | 33,000 | 9,188 | 0.466735 | 1.160000 |

The count exceeds the initial 20–50k visual target to retain small foliage and connected morphology. It is an explicit quality-first cost, not evidence that the city frame budget passes. Both LODs use the same two materials and three maps.

## Authoring checks and evidence

The generator asserts finite source coordinates, ten named read-back glTF meshes, triangle counts, normalized foot/top, finite unit normals, nonmetal materials, transparent atlas margins and a grounded atlas foot. Actual glTF bounds/radii, geometry counts, original-map bytes and silhouette measurements are written to `manifest.json` and printed with `BOTANICAL_*` markers. The compressor verifies decoded equality separately.

Per family, evidence includes `*-LOD0-front.png`, `*-LOD0-opposite.png`, `*-LOD0-threequarter.png`, `*-LOD1-front.png`, `*-LOD0-elevated.png`, `*-detail.png` and `*-albedo.png`. `botanical-contact-sheet.png` columns follow atlas order; rows are front, opposite, three-quarter, LOD1 front. All five families, opposite sides, close detail crops and approximately 43° elevated gameplay-facing views were inspected during authoring.

At 512² with the strict 0.42 cutoff, LOD1 retains **97.30–98.84%** of LOD0's projected coverage. Pixel-mask intersection-over-union is **0.8515–0.8939**; fine bent-leaf edge pixels move when LOD1 flattens them. Every atlas tile has **1.0000** mask IoU with its matching LOD0 front render. These are fixed authoring-view checks, not browser LOD-transition or temporal-antialiasing proof.

A follow-up colour-path check recreated ipê from source and reimported the actual GLB, then rendered both using their own map × vertex colour under identical unlit MASK materials. After the final density adjustment, both 512² renders cover 60,932 pixels; mean absolute RGBA difference is **1.609e-8**. Exported BYTE_COLOR values match Blender's linear `.color` (not `.color_srgb`). Every final disk atlas tile is also byte-image-pixel identical to its source albedo render. These checks rule out a source/GLB/atlas gamma conversion error; they do not establish equal minified alpha coverage or browser lighting response.

Known limits: branch forks use intersecting tapered surfaces rather than a watertight sculpt; leaves and needles use original alpha cutouts, not geometry for every vein/needle. There is one morphology per family before runtime yaw/scale/tint variation. The spruce photograph below is Scots pine, so spruce morphology is a general conifer interpretation, not a reconstruction of that photograph. Fine cutouts can shimmer when minified. Desktop gameplay-scale foliage coverage, composition, loading and frame cost need runtime verification by the integrating owner; no mobile check is part of this authoring task.

## Observation references

Photographs were visually inspected, not copied into models or production textures. They are not redistributed or declared cleared production assets.

- [IDS London plane](https://www.treesandshrubsonline.org/articles/platanus/platanus-x-hispanica/): [inspected photograph](https://www.treesandshrubsonline.org/site/assets/files/32674/platanus-x-hispanica-augustine-henry-3.jpg), uneven connected canopy fans, root flare and visible forks.
- [Danish Dendrological Association, Lord Nelson oak](https://dendron.dk/dtr/detaljer.asp?Individual_ID=863): [inspected photograph](https://www.dendron.dk/dtr/photos/Lord-Nelson_HEL_MG_3507.JPG), irregular tapering scaffold hierarchy; winter habit informed branching, not a direct summer-crown copy.
- [NatureSpot silver birch](https://www.naturespot.org/species/silver-birch): [inspected photograph](https://warehouse1.indicia.org.uk/upload/med-14/78/53/o_1b0vpamqf1prm1rdsiv11pev136c8.jpg), pale interrupted bark and fine hanging branchlets. Summer foliage is an authored interpretation.
- [IDS Scots pine](https://www.treesandshrubsonline.org/articles/pinus/pinus-sylvestris/): [inspected photograph](https://www.treesandshrubsonline.org/site/assets/files/6733/pinus-sylvestris-1.jpg), disconnected needle pads and fine edge breakup; it is not a spruce-species reference.
- [Ricardo Cardim, São Paulo ipês](https://arvoresdesaopaulo.wordpress.com/2008/09/03/ipes-amarelos-de-sao-paulo-comecaram-a-florir/): [inspected photograph](https://arvoresdesaopaulo.wordpress.com/wp-content/uploads/2008/09/ipe-amarelo.jpg?w=640), terminal yellow flowers and transparent branching. The delivered mixed leaf/flower state is restrained artistic seasonality.
