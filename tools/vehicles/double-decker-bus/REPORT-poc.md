# Double-decker bus POC, geometry correction pass

Files: build_bus.py, render_bus.py (10 views, `--variant glasgow`), validate_bus.py, bus-original-poc.glb, renders/ (10 views, all_views.jpg, left_vs_right.jpg, compare.jpg), renders_glasgow/.

## Root cause of the "one-sided" bus
`f.normal` of a freshly created bmesh face is zero until `normal_update()`. My patch/disc orientation test (`normal.dot(outward)`) therefore never flipped, so left-side glass/trim patches kept inward winding and were back-face culled in three.js. Fixed (normal_update before the test). validate_bus.py on the exported GLB now shows left/right symmetric: Glass outward/inward L=[228,0] R=[228,0]; Body L=[1158,12] R=[1156,12] (the 12 inward are wheel-arch inner faces, intended).

## Layout (one function, side = +-1)
Constants at top of the layout block: UPPER_Z 2.78-3.82, LOWER_Z 1.08-2.05, UP_X -4.55..4.25 (7-8 bays), LOW_X -3.35..0.75 (4 bays + partial), shared pillar grid GRID0 -3.3 / PITCH 1.15 / 0.08 m BusTrim (aligned deck to deck), RED diagonal body band (rear edge through x=3.14,z=3.77, 42 degrees, 0.7 m horizontal width) rising towards the front; upper ribbon (z 3.07-3.77) is cut by its rear edge; stair glass only FORWARD of it (z 2.0-3.77) with 2 slanted pillars; lower ribbon z 1.2-2.0 runs to the front door. Door pillars only on the left (kerb). Both sides: rear engine louvre recess, side display. Rear: wrap-around upper window, 8-slat louvre grille, plate recess, tail lamps. Front unchanged.

## Metrics, before -> after
- Unique tris 5,820 -> 5,700 (6,996 with wheel instances). Verts 3,632 -> 3,540. Meshes 5 -> 5. Materials 8 -> 8. Textures 0. GLB 164 KB -> 171 KB.
- Hull (closed shell, before decals): non-manifold edges 0. Body in the exported GLB reports ~2.3k "non-manifold" edges only because decal patches (trim backing, pillars, louvres) are open sheets sharing the mesh and glTF splits vertices per normal; no loose verts. Inverted normals: none outside the 12 intended arch faces per side.

## Self-review per view
- front GOOD; rear MINOR FIX (grille reads, plate plain); left GOOD; right GOOD; front_left GOOD; front_right GOOD; rear_left GOOD; rear_right GOOD; top_left GOOD; top_right GOOD.
- Stair region now follows the lead's measurements (red diagonal band, glass only ahead of it) and reads like the reference; left/right/front_* upgraded to GOOD apart from small details. Wheels now dark graphite with thin metal rim ring. Remaining: plain rear plate, no roundel, display band brown.
