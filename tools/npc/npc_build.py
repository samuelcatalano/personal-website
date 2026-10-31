# Build the five NPCs from npc_a_walk.blend and the body coordinates written by npc_bodies.py.
# Each body is a collapse-decimated copy; the jacket, jeans and sneakers are shelled off it and follow their bones
# rigidly; the hair is a procedural planoC style; each NPC is one vertex-coloured mesh. All five share the armature of
# NPC_A and the retargeted NPC_Walk clip, and they go into one GLB.
# Run: /opt/homebrew/bin/blender -b --factory-startup --python npc_build.py
import os
import bmesh
import json
import sys

import bpy
from mathutils.kdtree import KDTree

OUT = os.environ["NPC_OUT"]  # .blend, PNG and GLB outputs
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # hair_styles.py sits next to this script
import hair_styles as hs  # noqa: E402

hs.HEAD_BONE = "head"  # the MPFB game_engine rig names this bone "head" (UAL uses "Head")

DECIMATE = 0.20  # collapse ratio for each body; the garments are shelled off the same low-res copy
GARMENT_SPECS = {
    "jacket": dict(keep=["spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r",
                         "upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r"],
                   avoid=["hand_l", "hand_r"], rule="any", zlo=0.86, zhi=1.50, offset=0.020, thick=0.012),
    "jeans": dict(keep=["spine_01", "spine_02", "pelvis", "thigh_l", "thigh_r", "calf_l", "calf_r"],
                  avoid=["foot_l", "foot_r", "ball_l", "ball_r"], rule="all", zlo=0.08, zhi=1.10, offset=0.012,
                  thick=0.010),
    "shoes": dict(keep=["foot_l", "foot_r", "ball_l", "ball_r", "calf_l", "calf_r"],
                  avoid=[], rule="all", zlo=0.00, zhi=0.17, offset=0.014, thick=0.024),
}
NPCS = [  # NPC_A is the body already in npc_a_walk.blend; the others come from body_<name>.json
    dict(name="NPC_A", json=False, hair=("textured_crop", "#2b1e14"), skin="#c99272",
         colours=dict(jacket="#22334f", jeans="#2e4a6e", shoes="#ececec")),
    dict(name="NPC_B", json=True, hair=("buzz", "#120e0b"), skin="#8d5a3b",
         colours=dict(jacket="#7a2e2e", jeans="#55595f", shoes="#2a2a2a")),
    dict(name="NPC_C", json=True, hair=("undercut", "#6b5a48"), skin="#e2b59a",
         colours=dict(jacket="#5f6b3a", jeans="#5b6572", shoes="#f2efe9")),
    dict(name="NPC_D", json=True, hair=("two_block", "#1b1b1b"), skin="#b07a57",
         colours=dict(jacket="#1f4e3d", jeans="#4a5a70", shoes="#c94f2a")),
    dict(name="NPC_E", json=True, hair=("side_part", "#4a2f1b"), skin="#f0c9a8",
         colours=dict(jacket="#d9c7a1", jeans="#3b5878", shoes="#111111")),
]

bpy.ops.wm.open_mainfile(filepath=f"{OUT}/npc_a_walk.blend")  # body on the rig, NPC_Walk already retargeted
scene = bpy.context.scene
layer = bpy.context.view_layer
_MATERIAL = None


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_linear(h):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4)) + (1.0,)


def part(verts, faces, weights, colour):
    return dict(verts=verts, faces=faces, weights=weights, colour=colour)


def compact(verts, faces, weights):
    # keep only the vertices that a face uses, renumbered in order
    used = sorted({i for f in faces for i in f})
    remap = {old: new for new, old in enumerate(used)}
    return [verts[i] for i in used], [tuple(remap[i] for i in f) for f in faces], [weights[i] for i in used]


def body_weights(body, bones):
    # per full-resolution body vertex: {bone name: weight}; MPFB helper groups that match no bone are dropped
    names = {g.index: g.name for g in body.vertex_groups}
    return [{names[g.group]: g.weight for g in v.groups if names[g.group] in bones} for v in body.data.vertices]


def nearest_weights(kd, bw, co, k=4):
    out, tot = {}, 0.0
    for _, i, d in kd.find_n(co, k):
        w = 1.0 / (d + 1e-4)
        tot += w
        for name, val in bw[i].items():
            out[name] = out.get(name, 0.0) + val * w
    return {n: v / tot for n, v in out.items()}


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length


def seg_weights(segs, co, k=3):
    # garments follow their nearest bones rigidly: the three closest bone segments in the rest pose, blended by
    # inverse-square distance so joints still bend
    near = sorted((seg_dist(co, a, b), name) for name, a, b in segs)[:k]
    inv = [(1.0 / (d + 1e-3) ** 2, name) for d, name in near]
    tot = sum(w for w, _ in inv)
    return {name: w / tot for w, name in inv}


def decimate(body, ratio):
    # collapse-decimated copy of the body; the silhouette holds at city scale
    dg = bpy.context.evaluated_depsgraph_get()
    src = bpy.data.meshes.new_from_object(body.evaluated_get(dg))
    ob = bpy.data.objects.new("lo_raw", src)
    scene.collection.objects.link(ob)
    ob.modifiers.new("decimate", "DECIMATE").ratio = ratio
    layer.update()
    out = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(src)
    return out


def region(lo, lo_w, keep, avoid_pts, zlo, zhi, wmin=0.15):
    # low-res vertices a garment covers: its bones dominate the weight, the height is in range, and it stays 9 cm
    # clear of the joints it leaves bare (wrists for the jacket, ankles for the jeans). The collapsed hands carry
    # forearm weight, so the joints are checked by distance. A 6 cm margin in height lets cut_z() slice flat edges.
    return {v.index for v in lo.vertices
            if zlo - 0.06 <= v.co.z <= zhi + 0.06
            and max((lo_w[v.index].get(n, 0.0) for n in keep), default=0.0) >= wmin
            and all((v.co - p).length > 0.09 for p in avoid_pts)}


def cut_z(mesh, zlo, zhi):
    # flat hems and waists: bisect at the two heights, then drop the faces that lie outside them
    bm = bmesh.new()
    bm.from_mesh(mesh)
    for z in (zlo, zhi):
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0.0, 0.0, z), plane_no=(0.0, 0.0, 1.0), dist=1e-6)
    outside = [f for f in bm.faces if not zlo <= f.calc_center_median().z <= zhi]
    bmesh.ops.delete(bm, geom=outside, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return mesh


def garment_shell(lo, ok, body, spec):
    # shrunk onto the body and thickened inwards; no subdivision, which would quadruple the triangles. The jacket keeps
    # any face that touches its region, so thin sleeves survive decimation; jeans and sneakers keep only whole faces,
    # because a face that touches both legs would bridge the crotch into a skirt
    keep = any if spec["rule"] == "any" else all
    faces = [tuple(p.vertices) for p in lo.polygons if keep(i in ok for i in p.vertices)]
    used = sorted({i for f in faces for i in f})
    remap = {old: new for new, old in enumerate(used)}
    me = bpy.data.meshes.new("shell_raw")
    me.from_pydata([lo.vertices[i].co.copy() for i in used], [], [tuple(remap[i] for i in f) for f in faces])
    me.update()
    ob = bpy.data.objects.new("shell_raw", me)
    scene.collection.objects.link(ob)
    sw = ob.modifiers.new("shrink", "SHRINKWRAP")
    sw.target = body
    sw.wrap_method = "NEAREST_SURFACEPOINT"
    sw.offset = spec["offset"]
    so = ob.modifiers.new("solid", "SOLIDIFY")
    so.thickness = spec["thick"]
    so.offset = -1.0  # the shell grows inwards from the shrunk surface, so its outside keeps the offset
    layer.update()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    return cut_z(baked, spec["zlo"], spec["zhi"])


def hair_part(body, arm, style, colour):
    points = [body.matrix_world @ v.co for v in body.data.vertices]
    sk = hs.skull_from_body(points, body.dimensions.z)
    obj = hs.build_style(style, sk, arm)
    obj.hide_render = False
    layer.update()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    me.transform(obj.matrix_world)
    verts = [v.co.copy() for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(me)
    return part(verts, faces, [{"head": 1.0} for _ in verts], colour)


def material():
    # one material for every NPC: the colour comes from the per-vertex colour attribute
    global _MATERIAL
    if _MATERIAL is None:
        _MATERIAL = bpy.data.materials.new("NPC_Vertex")
        _MATERIAL.use_nodes = True
        nt = _MATERIAL.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.7
    return _MATERIAL


def merge_to_npc(name, parts, arm):
    verts, faces, cols, wts = [], [], [], []
    for p in parts:
        off = len(verts)
        verts += p["verts"]
        faces += [tuple(i + off for i in f) for f in p["faces"]]
        cols += [p["colour"]] * len(p["verts"])
        wts += p["weights"]
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    for poly in me.polygons:
        poly.use_smooth = True
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for d, c in zip(attr.data, cols):
        d.color = c
    me.materials.append(material())
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.parent = arm
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    for n in sorted({n for w in wts for n in w}):
        ob.vertex_groups.new(name=n)
    for i, w in enumerate(wts):
        for n, val in w.items():
            if val > 1e-4:
                ob.vertex_groups[n].add([i], min(val, 1.0), "REPLACE")
    return ob


def build_npc(npc, body, bw, arm, segs):
    kd = KDTree(len(body.data.vertices))
    for v in body.data.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    lo = decimate(body, DECIMATE)
    lo_w = [nearest_weights(kd, bw, v.co) for v in lo.vertices]
    regions = {g: region(lo, lo_w, s["keep"], [arm.data.bones[b].head_local for b in s["avoid"]], s["zlo"], s["zhi"])
               for g, s in GARMENT_SPECS.items()}
    # the body is hidden only inside the final heights of each garment
    covered = set().union(*({i for i in regions[g] if s["zlo"] <= lo.vertices[i].co.z <= s["zhi"]}
                            for g, s in GARMENT_SPECS.items()))
    body_faces = [tuple(p.vertices) for p in lo.polygons if not all(i in covered for i in p.vertices)]
    b_verts, b_faces, b_w = compact([v.co.copy() for v in lo.vertices], body_faces, lo_w)
    parts = [part(b_verts, b_faces, b_w, hex_linear(npc["skin"]))]
    for gname, spec in GARMENT_SPECS.items():
        me = garment_shell(lo, regions[gname], body, spec)
        verts = [v.co.copy() for v in me.vertices]
        faces = [tuple(p.vertices) for p in me.polygons]
        parts.append(part(verts, faces, [seg_weights(segs, co) for co in verts], hex_linear(npc["colours"][gname])))
        bpy.data.meshes.remove(me)
    style, hcol = npc["hair"]
    parts.append(hair_part(body, arm, style, hex_linear(hcol)))
    bpy.data.meshes.remove(lo)
    ob = merge_to_npc(npc["name"], parts, arm)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print("BUILD", npc["name"], "body verts", len(b_verts), "merged verts", len(ob.data.vertices), "tris", tris,
          "groups", len(ob.vertex_groups), flush=True)
    return ob


def variant_body(npc, faces):
    # same topology as NPC_A's body, so the vertex weights carry over by index
    with open(f"{OUT}/body_{npc['name']}.json") as f:
        coords = json.load(f)
    me = bpy.data.meshes.new(npc["name"] + "_body")
    me.from_pydata([tuple(c) for c in coords], [], faces)
    me.update()
    ob = bpy.data.objects.new(npc["name"] + "_body", me)
    scene.collection.objects.link(ob)
    return ob


def export_glb(path, objs, arm):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    arm.select_set(True)
    layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_animations=True, export_skins=True, export_all_influences=False,
                              export_yup=True, export_vertex_color="MATERIAL", export_morph=False)


a_body = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
print("BUILD base", a_body.name, len(a_body.data.vertices), "arm", arm.name, "action",
      arm.animation_data.action.name, flush=True)

# build in the rest pose: the saved scene sits on a walk frame, and any posed body would bake that walk into the mesh
clip = arm.animation_data.action  # NPC_Walk; reattached before export
arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location, pb.rotation_quaternion, pb.scale = (0.0, 0.0, 0.0), (1.0, 0.0, 0.0, 0.0), (1.0, 1.0, 1.0)
layer.update()

bw = body_weights(a_body, arm.data.bones)
faces_base = [tuple(p.vertices) for p in a_body.data.polygons]
segs = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in arm.data.bones]  # rest bone segments

built = []
for npc in NPCS:
    body = variant_body(npc, faces_base) if npc["json"] else a_body
    built.append(build_npc(npc, body, bw, arm, segs))
    if body is not a_body:
        me = body.data
        bpy.data.objects.remove(body)
        bpy.data.meshes.remove(me)

bpy.data.objects.remove(a_body)
for o in list(bpy.data.objects):
    if o.type in ("CAMERA", "LIGHT"):
        bpy.data.objects.remove(o)
arm.animation_data.action = clip
arm.animation_data.action_slot = clip.slots[0]
export_glb(f"{OUT}/npc_pack.glb", built, arm)
print("BUILD exported", f"{OUT}/npc_pack.glb", "npcs", len(built), flush=True)
bpy.ops.wm.save_as_mainfile(filepath=f"{OUT}/npc_pack_built.blend")
print("BUILD saved", flush=True)
