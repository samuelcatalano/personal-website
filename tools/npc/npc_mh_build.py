# Textured NPC build (MakeHuman system assets, CC0): one person per run for now (stage 1 of the textured pipeline).
# The body is NPC_A's rigged MPFB body from npc_a_walk.blend (rig + walk clips), optionally reshaped to body_<NPC>.json
# (same topology, already fitted to the rig by warp.py). Clothes, shoes, hair, brows, lashes and eyes are MakeHuman MHCLO
# assets fitted to that body by MPFB (vertex-bound to the base mesh, weights interpolated from the body). Each asset keeps its
# own UVs and gets a plain Principled material with its diffuse (and normal) map, downscaled, so glTF exports it as is.
# Run: NPC_OUT=<dir with npc_a_walk.blend + body jsons> MH_ASSETS=<unzipped makehuman_system_assets_cc0> \
#      NPC=NPC_A python3 bl_run.py npc_mh_build.py
import os
import json

import addon_utils
import bpy

OUT, MH = os.environ["NPC_OUT"], os.environ["MH_ASSETS"]
NPC = os.environ.get("NPC", "NPC_A")
TEX = int(os.environ.get("MH_TEX", 1024))  # texture edge after downscale (px)
LOOK = dict(  # per person: skin, clothes (suit + shoes), hair, brows, lashes, eye colour (all CC0 MakeHuman system assets)
    NPC_A=dict(skin="young_caucasian_male", clothes=["male_casualsuit04", "shoes06"], hair="short02",
               brows="eyebrow001", lashes="eyelashes01", eyes="brown"),
)[NPC]

addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402

bpy.ops.wm.open_mainfile(filepath=f"{OUT}/npc_a_walk.blend")
layer = bpy.context.view_layer
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
arm.data.pose_position = "REST"  # fit and bind in the rest pose (see npc_build.py)
layer.update()
if NPC != "NPC_A":
    coords = json.load(open(f"{OUT}/body_{NPC}.json"))
    for v, c in zip(body.data.vertices, coords):
        v.co = c
    body.data.update()


def find(kind, name, ext):
    d = os.path.join(MH, kind, name)
    hits = [f for f in os.listdir(d) if f.endswith(ext)]
    return os.path.join(d, hits[0]) if hits else None


def mhmat_maps(path):
    # diffuseTexture / normalmapTexture entries of a MakeHuman material, as absolute paths
    out, d = {}, os.path.dirname(path)
    for line in open(path):
        k, _, v = line.strip().partition(" ")
        if k in ("diffuseTexture", "normalmapTexture") and v:
            p = os.path.join(d, os.path.basename(v))
            if os.path.exists(p):
                out[k] = p
    return out


def image(path):
    img = bpy.data.images.load(path)
    if max(img.size) > TEX:
        img.scale(TEX, TEX)
    img.pack()
    return img


def material(name, maps, alpha=False):
    # Principled BSDF with an image texture straight into Base Color (and a Normal Map node), the shape glTF exports
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.85
    if "diffuseTexture" in maps:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = image(maps["diffuseTexture"])
        nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha:
            nt.links.new(t.outputs["Alpha"], bsdf.inputs["Alpha"])
            m.blend_method = "CLIP" if hasattr(m, "blend_method") else None
    if "normalmapTexture" in maps:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = image(maps["normalmapTexture"])
        t.image.colorspace_settings.name = "Non-Color"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(t.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def add(kind, name, asset_type, alpha=False):
    clo = find(kind, name, ".mhclo")
    ob = HumanService.add_mhclo_asset(clo, body, asset_type=asset_type, subdiv_levels=0, material_type="MAKESKIN")
    mat = find(kind, name, ".mhmat")
    ob.data.materials.clear()
    ob.data.materials.append(material(f"{NPC}_{name}", mhmat_maps(mat) if mat else {}, alpha))
    for mod in ob.modifiers:  # no subdivision in the export
        if mod.type == "SUBSURF":
            ob.modifiers.remove(mod)
    print("MH asset", asset_type, name, "faces", len(ob.data.polygons), flush=True)
    return ob


parts = [add("clothes", c, "Clothes") for c in LOOK["clothes"]]
parts.append(add("hair", LOOK["hair"], "Hair", alpha=True))
parts.append(add("eyebrows", LOOK["brows"], "Eyebrows", alpha=True))
parts.append(add("eyelashes", LOOK["lashes"], "Eyelashes", alpha=True))
eyes = add("eyes", "low-poly", "Eyes")
eyes.data.materials[0] = material(f"{NPC}_eyes", {"diffuseTexture": os.path.join(MH, "eyes", "materials", f"{LOOK['eyes']}_eye.png")}
                                   if os.path.exists(os.path.join(MH, "eyes", "materials", f"{LOOK['eyes']}_eye.png")) else {})
parts.append(eyes)
skin = mhmat_maps(find("skins", LOOK["skin"], ".mhmat"))
body.data.materials.clear()
body.data.materials.append(material(f"{NPC}_skin", skin))
body.name = NPC
body.data.name = NPC

arm.data.pose_position = "POSE"
bpy.ops.object.select_all(action="DESELECT")
for o in [body] + parts:
    o.select_set(True)
arm.select_set(True)
layer.objects.active = arm
path = f"{OUT}/npc_mh_{NPC}.glb"
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_animations=True, export_skins=True,
                          export_all_influences=False, export_yup=True, export_apply=True, export_image_format="JPEG",
                          export_jpeg_quality=85)
print("MH exported", path, os.path.getsize(path), flush=True)
