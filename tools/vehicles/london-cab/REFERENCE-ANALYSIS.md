# LEVC TX reference analysis

The three user-supplied images are the primary design references: a front three-quarter photograph, a near-orthographic side photograph and a stylized multi-view board. They are visual references only; no pixels, meshes, textures, logos or font files are embedded in the generated asset. All geometry is original procedural work.

## Recognition cues retained

- Tall, softly crowned cabin with an upright rear and short rounded bonnet. This is a modern LEVC TX, rather than the longer-bonnet TX4 silhouette.
- Three distinct rounded side-window zones, substantial body-color pillars, broad windscreen and dedicated rear window.
- Opposing front and rear coach-door handles around the central door seam, on both sides.
- Large upright chrome radiator surround with narrow vertical slats; round chrome-ringed headlamps, lower amber lamps and short chrome bumper accents.
- Small amber roof lamp with geometry TAXI lettering, disc-like wheel covers, narrow chrome sill strips, left rear-quarter fuel hatch outline, separate rear hatch, yellow plate and upright rear lamp towers.
- Right-hand-drive steering wheel and a minimal cabin with visible seat backs. No moving wheels or steering hierarchy.

## Proportions and coordinate contract

The [published LEVC TX specification](https://nd-mediagallery2-public-production.s3.amazonaws.com/951c20d8c278137041a124aab9199698/tx_price_specification_v5_uk_jan19_digital.pdf) supplies length **4.857 m**, body width **1.874 m**, width including mirrors **2.036 m**, height including sign **1.888 m**, wheelbase **2.986 m** and track **1.62 m**. Wheel radius is approximately **0.35 m**. These published dimensions drive the model; the photos guide shape and detail placement. The final length envelope is fitted after adding surface trim, preserving a centered origin.

Blender nose is +X, up +Z, UK driver's right is -Y. The origin is at ground level and centered along the vehicle. glTF uses the existing pipeline's `export_yup=True`, yielding Three.js nose +X, up +Y and right +Z.

## Geometry and runtime contract

Exactly six static mesh objects, each with one material: `CabBody`, `CabGlass`, `CabRubber`, `CabTrim`, `CabInterior`, `CabLights`. All carry normals and `COLOR_0`; body vertices stay white so a runtime body-material color can recolor paint. The lights mesh uses white/blue-white front lamps, red rear lamps and amber lamps/sign through vertex color. There are no external textures, animation nodes, wheel nodes or double-sided materials.

The lower body is a closed rounded loft with actual cylinder-cut wheel recesses and retained inner walls. The upper body is a hollow rounded loft with boolean-cut windows; separate thin closed glass panes fit inside the openings. Primitive components are closed, and semantic merging intentionally preserves intersecting closed detail components rather than adding costly Boolean unions everywhere. Validation welds glTF normal/color splits only for the topology audit, checks every component's winding and reports the actual exported contract.

Deliberate simplifications: coarse tire shoulders without tread, simple interior upholstery, no door opening or steering animation, no exact manufacturer badges, no mechanical underbody. Upgrade these only if close inspection in the city requires them. Ten neutral studio views, including both sides and rear, are the visual acceptance evidence; structural validation alone does not establish visual approval.
