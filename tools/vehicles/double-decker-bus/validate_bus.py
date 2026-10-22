# blender -b --factory-startup -P validate_bus.py -- in.glb   : winding/manifold checks on the exported GLB
import bpy, bmesh, sys
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index('--') + 1])
for ob in bpy.context.scene.objects:
    if ob.type != 'MESH': continue
    me = ob.data; mw = ob.matrix_world; res = {'left': [0, 0], 'right': [0, 0]}
    for p in me.polygons:
        c = mw @ p.center; n = mw.to_3x3() @ p.normal
        if abs(c.y) > 0.9 and abs(n.y) > 0.5: res['left' if c.y > 0 else 'right'][0 if n.y * c.y > 0 else 1] += 1   # [outward, inward]
    bm = bmesh.new(); bm.from_mesh(me)
    nm = sum(1 for e in bm.edges if not e.is_manifold); loose = sum(1 for v in bm.verts if not v.link_edges)
    print(f'{ob.name:8s} tris={sum(len(p.vertices)-2 for p in me.polygons):5d} side-faces(outward,inward) L={res["left"]} R={res["right"]} non-manifold-edges={nm} loose-verts={loose}')
