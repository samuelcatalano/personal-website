# Botanical vegetation — 2026-11-14

Owner reopened vegetation quality and explicitly prioritized realism before a later performance pass. Baseline `736377d`. Desktop only; unrelated `.codex/config.toml` preserved; no automatic commit/push. The chosen delivery replaces geometric low planting and the generic simplified tree with original botanical geometry, keeping the route/content/map intact.

## Final visual direction

Five original families — spreading oak, plane, fine pale-barked birch, spruce-like conifer and restrained flowering ipê — have connected curved/tapering branches, rooted bases, individual bent textured foliage, bark relief and per-leaf depth variation. Regional selection now receives the existing real `treeRegion()` callback. Instance rotation/proportion/subtle tint varies deterministic placements; candy-coloured whole crowns are removed. The final density pass increases overlap of the existing leaf surfaces, retaining all branch topology/leaf positions/seeds/triangle counts; birch remains airy. These are procedural botanical interpretations, not scanned specimens or an exact taxonomic reconstruction.

All tree centres, original height/crown envelopes, planting locations, paths and landmark sightlines remain. No global lighting, architecture, route, HTML copy, population or dependencies changed. The full-world captures retain **317 trees and 739 plot descriptors**. Source-data tests separately cover 630 generated tree records and preserve obstacle/plot/lamp/kiosk exclusions.

Original grass blades are narrow and curved, with lower mown-lawn heights instead of five broad upright spikes. Shrubs/hedges have connected stems and layered leaves; flowers have thin stems and curved petals. Shared normalized geometry covers voxel planting, tree understory, hero plaza and swap planters. Leaf backfaces remain visible; nonmetal rough materials add restrained light transmission. Grass receives existing architectural/tree shadows. The hero planting has its own botanical material rather than the masonry atlas; its original furniture/water/ground remain separate.

Turf uses one seeded original 512px fine texture, low-contrast dry/green patches, edge contact and distance-faded surface-normal relief. Normal perturbation fades its completed gradient, avoiding undefined higher-order derivatives. Lawn shape/footprints are retained; the pale city base skirt, asphalt and paving were not recoloured.

## References actually inspected

Internet images were temporary modelling references only, never included in production textures or meshes:

- [International Dendrology Society: London plane](https://www.treesandshrubsonline.org/articles/platanus/platanus-x-hispanica/): overlapping irregular foliage fans, visible major forks, fine leaf edges and mottled turf beneath.
- [Danish Dendrological Association: Lord Nelson oak](https://dendron.dk/dtr/detaljer.asp?Individual_ID=863): a winter photograph exposes progressive asymmetric tapering forks; its woodland proportions were not copied onto every street tree.
- [NatureSpot silver birch](https://www.naturespot.org/species/silver-birch), corroborated by [Woodland Trust](https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/british-trees/a-z-of-british-trees/silver-birch/): pale interrupted bark, fine drooping tips and a permeable crown.
- [IDS Scots pine](https://www.treesandshrubsonline.org/articles/pinus/pinus-sylvestris/): irregular needle pads and exposed scaffold, informing conifer variation rather than claiming the generated spruce-like form is Scots pine.
- [Botanist Ricardo Cardim: São Paulo ipês](https://arvoresdesaopaulo.wordpress.com/2008/09/03/ipes-amarelos-de-sao-paulo-comecaram-a-florir/): flowers gather at uneven twig tips, with exposed branches, rather than an opaque yellow sphere.

[Image-level observations / limitations](../evidence/botanical-vegetation/reference-observations.md), [original asset provenance](../../ASSET_SOURCES.md), [reproducible Blender build, dimensions and views](../../tools/vegetation/BOTANICAL.md).

## Quality decisions verified in the actual renderer

The initial three-level candidate was rejected: its mask/minification lost mesh foliage while a distant sprite kept different apparent coverage/brightness. High-resolution Basic-material probes, PNG/linear vertex-colour checks and actual GLB reimport proved the source faithful; an arbitrary brightness tint would conceal the rendering difference.

**Production retains two physical 3D LODs at every range.** Detailed trees switch with 130/150m hysteresis around a 140m initial threshold; farther trees retain the full physical LOD1. There is no active billboard stage and **no runtime atlas download**. The 512px-per-family diagnostic atlas remains an offline authoring artifact. Frustum chunks and real foliage shadow proxies remain.

Authored bent-leaf normals replace the legacy puffy-normal override. Linear leaf-map sampling avoids alpha-diluting mip averages, and MSAA alpha-to-coverage smooths cutouts on the existing desktop MSAA renderer. Bark retains its normal map and mip filtering. Source texture × vertex colour is preserved; no new emission/light is used to fake a bright canopy. Existing subtle wind/reduced-motion clock remains.

For all five families under flat and day light, final near/mid mean-luminance differences are **≤4.20%**, with **94.96–97.56%** projected coverage retained. Mid/far have identical geometry/materials and identical rendered coverage/luminance at the same comparison camera. Actual approach/departure sweeps select near at128m and far at152m (4m sample steps), retain physical LOD1 at1500m, and capture zero console errors for day/night. The 1500m case tests selection, not the site's camera/render distance.

[Five-family metrics](../evidence/botanical-vegetation/transitions.json), [day sweep](../evidence/botanical-vegetation/lod-day.json), [night sweep](../evidence/botanical-vegetation/lod-night.json). The guard compares the final physical levels; it does not claim the rejected sprite path became equivalent.

## Explicit costs

| Prototype | LOD0 triangles | LOD1 triangles |
| --- | ---: | ---: |
| Oak | 61,108 | 34,548 |
| Plane | 69,196 | 39,116 |
| Birch | 66,148 | 37,584 |
| Conifer | 56,340 | 32,406 |
| Ipê | 58,536 | 33,000 |
| Total unique prototypes | 311,328 | 176,654 |

Previous single supplied tree used 4,200/1,100 triangles. These are prototype counts, not full-frame submissions. The delivered original GLB is **19,683,804 bytes**, versus the old 905,592-byte model; the new three embedded maps are original leaf/bark albedo at1024² and bark normal at512². Verified lossless compression preserves all decoded source data. The **1,238,105-byte** diagnostic atlas is not downloaded by the runtime.

Low plants grow from20 to288 triangles per grass tuft, 40 to5,820 per shrub, 40 to7,372 per hedge, and108 to1,460 per flower group. In the fixed planting fixture, the unchanged10,157 grass instances submit **2,925,216 grass triangles** instead of203,140. The hero realm currently has203,076 triangles, five renderables and the same four maps; one extra botanical draw replaces material mixing with the masonry. The turf adds a shared512px texture. This is a material geometry/payload increase, accepted for quality; physical VRAM, cold public-network startup, universal FPS and a performance GO are **not measured/claimed**. Performance optimization is deferred as requested.

## Verification and evidence

- Regression-first checks failed on coarse old plants, single-family trees and the active sprite path, then passed the intended botanical/physical contracts.
- Final Node suite: **267 passed, zero failed** (including original content, route, footprint and preload integrity guards).
- Botanical runtime: five families/regions, original source indices/centres/crown/height caps, alpha depth/rough nonmetal materials, physical near/far selection, quantitative rendered transitions, foliage shadow proxies and idempotent teardown.
- Ground/hero/planting: deterministic normalized geometry, finite unit normals, preserved boxes/plant centres/plot-lamp-kiosk exclusions; hero owned geometry/material disposal and unchanged furniture/path obstacles.
- Loading: architectural/decoder worker checks retained; new GLB request held/released with no external atlas, injected503 rejection, procedural fallback and once-only disposal of shared geometry/materials/embedded maps.
- Streetscape wind/awning/source geometry and both physical tree bounds passed; day/night LOD sweeps passed.
- Desktop EN/PT content fallback with WebGL off, PT reduced-motion WebGL: passed with zero captured errors.
- Independent source/asset/ground/integration review approved after fixing the turf derivative and migrating three old three-level test/tool consumers. [Review](../evidence/botanical-vegetation/independent-review.md), [ground review](../evidence/botanical-vegetation/ground-review.md).

**Final desktop visual/runtime GO:** all four delivery captures passed with zero captured JavaScript errors, zero failed shader programs and `glGetError()=0`; botanical renderer active, 317 trees / 739 plot descriptors. The browser directly confirmed `botanical-trees.glb?v=9` (19,683,804 bytes), two physical levels, no atlas request and medium desktop tier. Captures match the baseline at1728×963/DPR2 and stops5/9.5/11, clear day plus Glasgow night, using actual loader, lighting, shadows and postprocessing. [Capture log](../evidence/botanical-vegetation/city-captures.log), [live runtime probe](../evidence/botanical-vegetation/runtime.log), [Node](../evidence/botanical-vegetation/node-tests.log), [loading](../evidence/botanical-vegetation/loading.log), [fallback/reduced motion](../evidence/botanical-vegetation/smoke.log).

Matched before/after details: [São Paulo](../evidence/botanical-vegetation/city-5-comparison.jpg), [London](../evidence/botanical-vegetation/city-9.5-comparison.jpg), [Glasgow](../evidence/botanical-vegetation/city-11-comparison.jpg). Full final views: [São Paulo day](../evidence/botanical-vegetation/city-5-day.jpg), [London day](../evidence/botanical-vegetation/city-9.5-day.jpg), [Glasgow day](../evidence/botanical-vegetation/city-11-day.jpg), [Glasgow night](../evidence/botanical-vegetation/city-11-night.jpg). [Five families: elevated and opposite views](../evidence/botanical-vegetation/five-families.jpg); [low-plant comparison: before front / after rear](../evidence/botanical-vegetation/low-plants-comparison.jpg).

## Known limits / next phase

One original model per family, procedural rather than scanned anatomy, and small cutout surfaces remain. Fine foliage can still shimmer during camera motion; linear/no-mip leaf sampling and physical far geometry are deliberate quality choices with GPU/bandwidth costs. Existing sub5cm shader sway retains static depth geometry, so exact moving-leaf shadow agreement is not claimed. No mobile, Lighthouse, full historical browser-suite run, cross-device/GPU profile or performance optimization in this pass. Asset/runtime quality remains reviewable through the actual site and saved comparisons.
