# blender -b --factory-startup -P validate_mini.py -- in.glb : face-orientation (outward/inward) per side + manifold checks on the exported GLB
import bpy, bmesh, sys
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index('--') + 1])
def islands(bm):
    seen, out = set(), []
    for f0 in bm.faces:
        if f0 in seen: continue
        st, comp = [f0], []; seen.add(f0)
        while st:
            f = st.pop(); comp.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g not in seen: seen.add(g); st.append(g)
        out.append(comp)
    return out
tot = 0
for ob in bpy.context.scene.objects:
    if ob.type != 'MESH' or ob.name.startswith(('FL', 'FR', 'RL', 'RR')) and False: continue
    me = ob.data; mw = ob.matrix_world; res = {'left': [0, 0], 'right': [0, 0]}
    for p in me.polygons:                                               # side faces: world +Y(after import) is left; outward = normal.y has sign of centre.y
        c = mw @ p.center; n = mw.to_3x3() @ p.normal
        if abs(c.y) > 0.5 and abs(n.y) > 0.5 and not ob.name in ('FL', 'FR', 'RL', 'RR'): res['left' if c.y > 0 else 'right'][0 if n.y * c.y > 0 else 1] += 1   # [outward, inward]
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    isl = islands(bm); big = [c for c in isl if len(c) > 150]
    nm_big = [sum(1 for f in c for e in f.edges if not e.is_manifold) // 1 for c in big]
    tris = sum(len(p.vertices) - 2 for p in me.polygons); tot += tris
    print(f'{ob.name:6s} tris={tris:5d} side-faces(outward,inward) LEFT={res["left"]} RIGHT={res["right"]} islands={len(isl)} main-shell-islands(>150 faces)={len(big)} non-manifold-edges-on-main-shells={nm_big}')
print('TOTAL tris (instances counted per object):', tot)
