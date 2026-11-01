# Textured NPC pack (MakeHuman system assets, CC0 1.0). Every person is NPC_A's rigged MPFB body from npc_a_walk.blend
# (rig + walk clips) reshaped to body_<NPC>.json (same topology, fitted to the rig by warp.py). MPFB fits a low-poly body
# proxy (male1591 / female1605), the clothes, shoes, hair, brows, lashes and eyes (MHCLO assets, vertex-bound to the base
# mesh) and interpolates their skin weights from the body. Each asset keeps its own UVs and gets a plain Principled material
# with its diffuse (and normal) map, downscaled; images and materials are shared between people, so glTF stores each once.
# Output: $NPC_OUT/npc_pack_mh.glb with one armature, the walk clips and, per person, NPC_X (skin proxy) + NPC_X_<asset>.
# Run: NPC_OUT=<dir with npc_a_walk.blend + body jsons> MH_ASSETS=<unzipped makehuman_system_assets_cc0> python3 bl_run.py npc_mh_build.py
import os
import json

import addon_utils
import bpy

OUT, MH = os.environ["NPC_OUT"], os.environ["MH_ASSETS"]
TEX = {"skin": int(os.environ.get("MH_TEX_SKIN", 1024)), "default": int(os.environ.get("MH_TEX", 512)), "normal": int(os.environ.get("MH_TEX_N", 256))}  # texture edge (px)
ONLY = os.environ.get("NPC")  # build one person only (debug)
M, F = "male1591", "female1605"
PEOPLE = {  # skin, body proxy, clothes (suit + shoes), hair, brows, lashes, eye colour
    "NPC_A": dict(skin="young_caucasian_male", proxy=M, clothes=["male_casualsuit04", "shoes06"], hair="short02", brows="eyebrow001", eyes="brown"),
    "NPC_B": dict(skin="young_african_male", proxy=M, clothes=["male_casualsuit05", "shoes03"], hair="afro01", brows="eyebrow003", eyes="brown"),
    "NPC_C": dict(skin="young_caucasian_male2", proxy=M, clothes=["male_casualsuit06", "shoes01"], hair="short01", brows="eyebrow002", eyes="green"),
    "NPC_D": dict(skin="middleage_african_male", proxy=M, clothes=["male_casualsuit03", "shoes04"], hair="short04", brows="eyebrow005", eyes="brownlight"),
    "NPC_E": dict(skin="young_caucasian_male", proxy=M, clothes=["male_casualsuit06", "shoes05"], hair="short03", brows="eyebrow004", eyes="blue"),
    "NPC_F": dict(skin="young_caucasian_female", proxy=F, clothes=["male_casualsuit02", "shoes05"], hair="long01", brows="eyebrow010", eyes="brown"),
    "NPC_G": dict(skin="young_asian_female", proxy=F, clothes=["male_casualsuit06", "shoes06"], hair="ponytail01", brows="eyebrow011", eyes="brown"),
    "NPC_H": dict(skin="young_african_female", proxy=F, clothes=["male_casualsuit05", "shoes02"], hair="afro01", brows="eyebrow012", eyes="brown"),
    "NPC_I": dict(skin="young_asian_male", proxy=M, clothes=["male_casualsuit02", "shoes06"], hair="short04", brows="eyebrow006", eyes="brown"),
    "NPC_J": dict(skin="middleage_caucasian_male", proxy=M, clothes=["male_worksuit01", "shoes03"], hair="short02", brows="eyebrow007", eyes="bluegreen"),
    "NPC_K": dict(skin="young_african_female", proxy=F, clothes=["male_casualsuit04", "shoes01"], hair="braid01", brows="eyebrow009", eyes="brown"),
    "NPC_L": dict(skin="young_caucasian_female2", proxy=F, clothes=["male_casualsuit03", "shoes04"], hair="bob02", brows="eyebrow008", eyes="lightblue"),
}

addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.clothesservice import ClothesService  # noqa: E402

_CURRENT = {"path": None}  # the asset being added: MPFB looks it up in its own library when it interpolates weights
ClothesService.find_clothes_absolute_path = staticmethod(lambda *_a, **_k: _CURRENT["path"])

bpy.ops.wm.open_mainfile(filepath=f"{OUT}/npc_a_walk.blend")
layer = bpy.context.view_layer
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
base = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
arm.data.pose_position = "REST"  # fit and bind in the rest pose (see npc_build.py)
layer.update()
base_co = [v.co.copy() for v in base.data.vertices]
_IMAGES, _MATS = {}, {}
KEEP = {"clothes": float(os.environ.get("MH_KEEP_CLOTHES", 0.5)), "shoes": float(os.environ.get("MH_KEEP_SHOES", 0.3)),
        "hair": float(os.environ.get("MH_KEEP_HAIR", 0.7))}  # decimation ratio per asset type


def find(kind, name, ext):
    d = os.path.join(MH, kind, name)
    hits = sorted(f for f in os.listdir(d) if f.endswith(ext))
    return os.path.join(d, hits[0]) if hits else None


def mhmat_maps(path):
    # diffuseTexture / normalmapTexture of a MakeHuman material, as absolute paths
    out, d = {}, os.path.dirname(path)
    for line in open(path):
        k, _, v = line.strip().partition(" ")
        if k in ("diffuseTexture", "normalmapTexture") and v:
            p = os.path.join(d, os.path.basename(v))
            if os.path.exists(p):
                out[k] = p
    return out


def image(path, edge):
    if path not in _IMAGES:
        img = bpy.data.images.load(path)
        if max(img.size) > edge:
            img.scale(edge, edge)
        img.pack()
        _IMAGES[path] = img
    return _IMAGES[path]


def material(key, maps, alpha=False, edge=TEX["default"]):
    # one Principled material per asset (shared by everyone wearing it): image texture straight into Base Color, plus a Normal Map
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.85
    if "diffuseTexture" in maps:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = image(maps["diffuseTexture"], edge)
        nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha:
            nt.links.new(t.outputs["Alpha"], bsdf.inputs["Alpha"])
    if "normalmapTexture" in maps:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = image(maps["normalmapTexture"], min(edge, TEX["normal"]))
        t.image.colorspace_settings.name = "Non-Color"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(t.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    _MATS[key] = m
    return m


def add(body, npc, kind, name, asset_type, alpha=False, mat_key=None, maps=None, edge=TEX["default"]):
    _CURRENT["path"] = find(kind, name, ".mhclo") or find(kind, name, ".proxy")
    ob = HumanService.add_mhclo_asset(_CURRENT["path"], body, asset_type=asset_type, subdiv_levels=0,
                                      material_type="MAKESKIN")
    for mod in list(ob.modifiers):  # no subdivision in the export
        if mod.type == "SUBSURF":
            ob.modifiers.remove(mod)
    if maps is None:
        mm = find(kind, name, ".mhmat")
        maps = mhmat_maps(mm) if mm else {}
    ob.data.materials.clear()
    ob.data.materials.append(material(mat_key or f"mh_{asset_type.lower()}_{name}", maps, alpha, edge))  # the type in the name: the runtime tints by it
    ob.name = f"{npc}_{asset_type.lower()}_{name}"
    ratio = KEEP.get("shoes" if name.startswith("shoes") else asset_type.lower(), 1.0)
    if ratio < 1.0:  # collapse decimation, applied by the export (budget: ~8k tris per person, the pack ~4-5 MB)
        d = ob.modifiers.new("decimate", "DECIMATE")
        d.ratio = ratio
    return ob


LEGS = ("thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r", "ball_l", "ball_r")  # no pelvis: the tee hem rides on it and turned trouser-blue


def tag_parts(ob):
    # float attribute _part per vertex (exported as glTF _PART): 0.25 = top (torso/arms), 0.5 = trousers (legs and hips by
    # skin weight), so the runtime recolours a top without touching the denim (suit textures put them in arbitrary UV places)
    names = {g.index: g.name for g in ob.vertex_groups}
    a = ob.data.attributes.new("_part", "FLOAT", "POINT")
    for v in ob.data.vertices:
        leg = sum(g.weight for g in v.groups if names[g.group] in LEGS)
        tot = sum(g.weight for g in v.groups) or 1.0
        a.data[v.index].value = 0.5 if leg / tot > 0.5 else 0.25


PLAIN = ("male_casualsuit02", "male_casualsuit04", "male_casualsuit06")  # tees with a printed logo / stripes: made plain


def plain_top(ob, suit):
    # Repaint the tee part of a suit texture as plain grey fabric: inside the UV islands of the top faces (_part 0.25) the
    # colour becomes the luminance after a median filter (the logo, the print and the sleeve stripes are thin shapes and go;
    # the folds and the shading stay), normalised so the runtime can multiply any colour onto it. The denim is untouched.
    from PIL import Image, ImageDraw, ImageFilter, ImageOps
    mat = ob.data.materials[0]
    node = next(n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image.colorspace_settings.name != "Non-Color")
    src = Image.open(mhmat_maps(find("clothes", suit, ".mhmat"))["diffuseTexture"]).convert("RGB").resize((1024, 1024))
    W, H = src.size
    mask = Image.new("L", src.size, 0)
    dr = ImageDraw.Draw(mask)
    uv, part = ob.data.uv_layers.active.data, ob.data.attributes["_part"].data
    for poly in ob.data.polygons:
        if all(part[v].value < 0.3 for v in poly.vertices):
            dr.polygon([(uv[li].uv[0] * W, (1.0 - uv[li].uv[1]) * H) for li in poly.loop_indices], fill=255)
    mask = mask.filter(ImageFilter.MaxFilter(11))  # cover the island borders and the printed hem line
    import numpy as np
    L0, M = np.asarray(ImageOps.grayscale(src), dtype=np.float32), np.asarray(mask) > 0
    lo, hi = np.percentile(L0[M], 25), np.percentile(L0[M], 70)  # the print is far brighter or darker than the cloth: clip it away
    lum = Image.fromarray(np.clip(L0, lo, hi).astype(np.uint8)).filter(ImageFilter.MedianFilter(31)).filter(ImageFilter.GaussianBlur(3))
    L = np.asarray(lum, dtype=np.float32)
    L = np.clip(L / max(1.0, float(np.median(L[M]))) * 0.78, 0.0, 1.0) * 255.0  # median of the tee -> 0.78 grey
    out = np.asarray(src, dtype=np.float32).copy()
    out[M] = L[M][:, None]
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    orange = (r - b > 70) & (r > g) & (r > 120)  # the printed orange hem/sleeve lines sit just outside the tee islands
    out[orange] = 0.78 * 255.0
    path = os.path.join(OUT, f"plain_{suit}.png")
    Image.fromarray(out.astype(np.uint8)).save(path)
    node.image = image(path, TEX["default"])
    mat.name = f"mh_clothes_{suit}_plain"  # the runtime paints a colour on the plain tops
    print("MH plain top", suit, "mask px", int(M.sum()), flush=True)


def hide_covered(skin_ob, garments, reach=0.06):
    # drop skin faces that lie under a garment: from each vertex a ray along its normal hits the garment within `reach` (m).
    # MPFB hides the base mesh under clothes, but not the low-poly body proxy, which then showed through tees and jeans.
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    trees = [BVHTree.FromObject(g, dg) for g in garments]
    me = skin_ob.data
    covered = []
    for v in me.vertices:
        hit = any(t.ray_cast(v.co + v.normal * 0.001, v.normal, reach)[0] is not None for t in trees)
        covered.append(hit)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    drop = [f for f in bm.faces if all(covered[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    bm.to_mesh(me)
    bm.free()
    return len(drop)


exported = []
for npc, look in PEOPLE.items():
    if ONLY and npc != ONLY:
        continue
    body = base.copy()
    body.data = base.data.copy()
    bpy.context.scene.collection.objects.link(body)
    if npc != "NPC_A":
        coords = json.load(open(f"{OUT}/body_{npc}.json"))
        for v, c in zip(body.data.vertices, coords):
            v.co = c
    else:
        for v, c in zip(body.data.vertices, base_co):
            v.co = c
    body.data.update()
    skin = mhmat_maps(find("skins", look["skin"], ".mhmat"))
    proxy = add(body, npc, "proxymeshes", look["proxy"], "Proxymeshes", mat_key=f"mh_skin_{look['skin']}", maps=skin, edge=TEX["skin"])
    parts = [add(body, npc, "clothes", c, "Clothes") for c in look["clothes"]]
    tag_parts(parts[0])  # the suit (the shoes stay as they are)
    if look["clothes"][0] in PLAIN and not parts[0].data.materials[0].name.endswith("_plain"):
        plain_top(parts[0], look["clothes"][0])
    parts.append(add(body, npc, "hair", look["hair"], "Hair", alpha=True))
    parts.append(add(body, npc, "eyebrows", look["brows"], "Eyebrows", alpha=True))
    # no eyelashes: 370 triangles each, invisible at street distance
    for mod in list(proxy.modifiers):  # MPFB's per-garment masks hid NPC_A's whole proxy at export; hide_covered does that job
        if mod.type == "MASK":
            proxy.modifiers.remove(mod)
    print("MH hidden skin faces", npc, hide_covered(proxy, parts[:len(look["clothes"])]), flush=True)
    eye_png = os.path.join(MH, "eyes", "materials", f"{look['eyes']}_eye.png")
    parts.append(add(body, npc, "eyes", "low-poly", "Eyes", mat_key=f"mh_eyes_{look['eyes']}", maps={"diffuseTexture": eye_png}))
    # one object per person: one glTF mesh (a primitive per material) bound to one skin, so the runtime updates one skeleton
    # per walker instead of one per garment (6x the bone matrices before)
    dg = bpy.context.evaluated_depsgraph_get()
    tris = sum(sum(len(p.vertices) - 2 for p in o.evaluated_get(dg).data.polygons) for o in [proxy] + parts)
    for o in [proxy] + parts:
        bpy.context.view_layer.objects.active = o
        for mod in list(o.modifiers):
            if mod.type in ("DECIMATE", "MASK"):
                bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action="DESELECT")
    for o in [proxy] + parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = proxy
    bpy.ops.object.join()
    proxy.name = npc
    parts = []
    body.hide_set(True)
    body.hide_render = True
    for o in [body, proxy] + parts:  # out of the rig's family until the export: MPFB replaces a proxy it finds among its relatives
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    exported += [proxy] + parts
    print("MH person", npc, "tris", tris, "parts", len(parts) + 1, flush=True)

for o in exported:  # under the shared rig only now: MPFB looks for a person's existing proxy among the rig's children
    o.parent = arm
    o.matrix_parent_inverse.identity()
arm.data.pose_position = "POSE"
bpy.ops.object.select_all(action="DESELECT")
for o in exported:
    o.select_set(True)
arm.select_set(True)
layer.objects.active = arm
path = f"{OUT}/npc_pack_mh.glb"
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_animations=True, export_skins=True,
                          export_all_influences=False, export_yup=True, export_apply=True, export_attributes=True, export_image_format="WEBP",
                          export_image_quality=80)  # WebP keeps the hair/brow alpha (EXT_texture_webp, read by three)
print("MH exported", path, os.path.getsize(path), "images", len(_IMAGES), "materials", len(_MATS), flush=True)
