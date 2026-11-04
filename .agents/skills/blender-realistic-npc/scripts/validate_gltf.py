#!/usr/bin/env python3
"""Inspect self-contained GLB structure and optional budgets, using only stdlib.

This is not full glTF conformance validation. It does not decode compressed
payloads, evaluate animation/skin deformation, or approve likeness/materials.
"""
import argparse
import base64
import copy
import json
import math
from pathlib import Path
import struct
import sys


COMPONENT_BYTES = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def integer(value, label, minimum=0):
    require(type(value) is int and value >= minimum, f"{label}: expected integer >= {minimum}")
    return value


def finite_vector(value, size, label):
    require(isinstance(value, list) and len(value) == size, f"{label}: wrong vector length")
    require(all(type(v) in (int, float) and math.isfinite(v) for v in value), f"{label}: nonfinite/nonnumeric value")


def validate_glb(raw):
    require(len(raw) >= 20, "Truncated GLB")
    magic, version, length = struct.unpack_from("<4sII", raw)
    require(magic == b"glTF" and version == 2, "Expected GLB version 2")
    require(length == len(raw) and length % 4 == 0, "GLB length/header mismatch")
    offset, chunks = 12, []
    while offset < length:
        require(offset + 8 <= length, "Truncated chunk header")
        size, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        require(size % 4 == 0 and offset + size <= length, "Invalid chunk length/alignment")
        chunks.append((kind, raw[offset:offset + size]))
        offset += size
    require(chunks[0][0] == 0x4E4F534A, "First chunk must be JSON")
    require(sum(k == 0x4E4F534A for k, _ in chunks) == 1, "Duplicate JSON chunks")
    require(sum(k == 0x004E4942 for k, _ in chunks) <= 1, "Duplicate BIN chunks")
    binary = next((v for k, v in chunks if k == 0x004E4942), b"")
    if binary:
        require(len(chunks) > 1 and chunks[1][0] == 0x004E4942, "BIN must follow JSON")
    def reject_constant(value):
        raise ValueError(f"Nonfinite JSON number: {value}")
    doc = json.loads(chunks[0][1].decode("utf-8"), parse_constant=reject_constant)
    require(isinstance(doc, dict) and doc.get("asset", {}).get("version") == "2.0", "Expected glTF asset version 2.0")
    arrays = {}
    for name in ("buffers", "bufferViews", "accessors", "meshes", "materials", "textures", "images", "samplers", "nodes", "skins", "animations", "scenes"):
        array = doc.get(name, [])
        require(isinstance(array, list) and all(isinstance(v, dict) for v in array), f"{name}: expected object array")
        arrays[name] = array
    def ref(name, value):
        integer(value, f"{name} index")
        require(value < len(arrays[name]), f"Missing {name}[{value}]")
        return arrays[name][value]
    buffer_sizes = []
    for i, buffer in enumerate(arrays["buffers"]):
        declared = integer(buffer.get("byteLength"), "buffer.byteLength", 1)
        uri = buffer.get("uri")
        if uri is None:
            require(i == 0 and bool(binary), "Missing embedded BIN buffer")
            require(declared <= len(binary) <= declared + 3, "BIN byteLength/padding mismatch")
        else:
            require(isinstance(uri, str) and uri.startswith("data:") and ";base64," in uri, "External buffer is not self-contained")
            decoded = base64.b64decode(uri.split(",", 1)[1], validate=True)
            require(len(decoded) == declared, "Data URI buffer length mismatch")
        buffer_sizes.append(declared)
    for view in arrays["bufferViews"]:
        ref("buffers", view.get("buffer"))
        start = integer(view.get("byteOffset", 0), "bufferView.byteOffset")
        size = integer(view.get("byteLength"), "bufferView.byteLength", 1)
        require(start + size <= buffer_sizes[view["buffer"]], "bufferView exceeds buffer")
        if "byteStride" in view:
            stride = integer(view["byteStride"], "bufferView.byteStride", 4)
            require(stride <= 252 and stride % 4 == 0, "Invalid bufferView stride")
    for accessor in arrays["accessors"]:
        count = integer(accessor.get("count"), "accessor.count", 1)
        component = accessor.get("componentType")
        kind = accessor.get("type")
        require(component in COMPONENT_BYTES and kind in COMPONENTS, "Invalid accessor component/type")
        width, components = COMPONENT_BYTES[component], COMPONENTS[kind]
        element = width * components
        if kind.startswith("MAT"):
            columns = int(kind[-1])
            element = columns * ((columns * width + 3) // 4 * 4)
        start = integer(accessor.get("byteOffset", 0), "accessor.byteOffset")
        require(start % width == 0, "Misaligned accessor offset")
        if "bufferView" in accessor:
            view = ref("bufferViews", accessor["bufferView"])
            stride = view.get("byteStride", element)
            require(stride >= element and stride % width == 0, "Invalid accessor stride")
            require((view.get("byteOffset", 0) + start) % width == 0, "Misaligned accessor in buffer")
            require(start + (count - 1) * stride + element <= view["byteLength"], "Accessor exceeds bufferView")
        else:
            require(start == 0, "Bufferless accessor cannot have byteOffset")
        for key in ("min", "max"):
            if key in accessor:
                finite_vector(accessor[key], components, f"accessor.{key}")
        if "min" in accessor and "max" in accessor:
            require(all(a <= b for a, b in zip(accessor["min"], accessor["max"])), "Accessor min exceeds max")
        if "sparse" in accessor:
            sparse = accessor["sparse"]
            require(0 < integer(sparse.get("count"), "sparse.count") <= count, "Invalid sparse count")
            for key in ("indices", "values"):
                ref("bufferViews", sparse[key].get("bufferView"))
    primitives = triangles = 0
    for mesh in arrays["meshes"]:
        require(isinstance(mesh.get("primitives"), list) and bool(mesh["primitives"]), "Mesh needs primitives")
        for primitive in mesh["primitives"]:
            attributes = primitive.get("attributes", {})
            position = ref("accessors", attributes.get("POSITION"))
            require(position["type"] == "VEC3" and position["componentType"] == 5126, "POSITION must be float VEC3")
            count = position["count"]
            for name, index in attributes.items():
                attribute = ref("accessors", index)
                require(attribute["count"] == count, f"Attribute {name} count mismatch")
            if "indices" in primitive:
                index = ref("accessors", primitive["indices"])
                require(index["type"] == "SCALAR" and index["componentType"] in (5121, 5123, 5125), "Invalid mesh index accessor")
                if "max" in index:
                    require(index["max"][0] < count, "Declared mesh index exceeds vertex count")
                count = index["count"]
            mode = integer(primitive.get("mode", 4), "primitive.mode")
            require(mode <= 6, "Unknown primitive mode")
            if mode == 4:
                require(count % 3 == 0, "TRIANGLES count must be divisible by 3")
                triangles += count // 3
            elif mode in (5, 6):
                triangles += max(0, count - 2)
            if "material" in primitive:
                ref("materials", primitive["material"])
            for target in primitive.get("targets", []):
                for index in target.values():
                    require(ref("accessors", index)["count"] == position["count"], "Morph target count mismatch")
            if "KHR_draco_mesh_compression" in primitive.get("extensions", {}):
                ref("bufferViews", primitive["extensions"]["KHR_draco_mesh_compression"].get("bufferView"))
            primitives += 1
    require(primitives > 0, "No mesh primitives")
    for image in arrays["images"]:
        require(("bufferView" in image) != ("uri" in image), "Image needs exactly one source")
        if "bufferView" in image:
            ref("bufferViews", image["bufferView"])
            require(image.get("mimeType") in ("image/png", "image/jpeg", "image/ktx2", "image/webp", "image/avif"), "Missing/unsupported image MIME type")
        else:
            uri = image["uri"]
            require(isinstance(uri, str) and uri.startswith("data:") and ";base64," in uri, "External image is not self-contained")
            require(bool(base64.b64decode(uri.split(",", 1)[1], validate=True)), "Empty image data URI")
    for texture in arrays["textures"]:
        if "source" in texture:
            ref("images", texture["source"])
        if "sampler" in texture:
            ref("samplers", texture["sampler"])
        for extension in texture.get("extensions", {}).values():
            if isinstance(extension, dict) and "source" in extension:
                ref("images", extension["source"])
    def texture_refs(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key.endswith("Texture"):
                    ref("textures", item.get("index"))
                texture_refs(item)
        elif isinstance(value, list):
            for item in value:
                texture_refs(item)
    for material in arrays["materials"]:
        texture_refs(material)
    parents = {}
    for i, node in enumerate(arrays["nodes"]):
        for key, size in (("matrix", 16), ("translation", 3), ("rotation", 4), ("scale", 3)):
            if key in node:
                finite_vector(node[key], size, f"node.{key}")
        require(not ("matrix" in node and any(k in node for k in ("translation", "rotation", "scale"))), "Node has both matrix and TRS")
        if "mesh" in node:
            ref("meshes", node["mesh"])
        if "skin" in node:
            ref("skins", node["skin"])
            mesh = ref("meshes", node.get("mesh"))
            for primitive in mesh["primitives"]:
                attrs = primitive["attributes"]
                require("JOINTS_0" in attrs and "WEIGHTS_0" in attrs, "Skinned primitive lacks joints/weights")
        for child in node.get("children", []):
            ref("nodes", child)
            require(child not in parents and child != i, "Node has duplicate parents or self-cycle")
            parents[child] = i
    for i in parents:
        seen, cursor = set(), i
        while cursor in parents:
            require(cursor not in seen, "Node hierarchy cycle")
            seen.add(cursor)
            cursor = parents[cursor]
    joint_nodes = set()
    for skin in arrays["skins"]:
        joints = skin.get("joints", [])
        require(isinstance(joints, list) and bool(joints), "Skin needs joints")
        for joint in joints:
            ref("nodes", joint)
        require(len(set(joints)) == len(joints), "Duplicate skin joints")
        joint_nodes.update(joints)
        if "skeleton" in skin:
            ref("nodes", skin["skeleton"])
        if "inverseBindMatrices" in skin:
            accessor = ref("accessors", skin["inverseBindMatrices"])
            require(accessor["type"] == "MAT4" and accessor["componentType"] == 5126 and accessor["count"] >= len(joints), "Invalid inverse bind matrices")
    for scene in arrays["scenes"]:
        for node in scene.get("nodes", []):
            ref("nodes", node)
    if "scene" in doc:
        ref("scenes", doc["scene"])
    for animation in arrays["animations"]:
        samplers, channels = animation.get("samplers", []), animation.get("channels", [])
        require(bool(samplers) and bool(channels), "Animation needs samplers and channels")
        for sampler in samplers:
            source = ref("accessors", sampler.get("input"))
            ref("accessors", sampler.get("output"))
            require(source["type"] == "SCALAR" and source["componentType"] == 5126, "Animation time must be float SCALAR")
        for channel in channels:
            i = integer(channel.get("sampler"), "animation sampler")
            require(i < len(samplers), "Missing animation sampler")
            target = channel.get("target", {})
            ref("nodes", target.get("node"))
            require(target.get("path") in ("translation", "rotation", "scale", "weights"), "Invalid animation target path")
    return {"bytes": len(raw), "meshes": len(arrays["meshes"]), "primitives": primitives,
            "triangles": triangles, "materials": len(arrays["materials"]),
            "textures": len(arrays["textures"]), "images": len(arrays["images"]),
            "skins": len(arrays["skins"]), "bones": len(joint_nodes),
            "animations": len(arrays["animations"]), "extensions_used": doc.get("extensionsUsed", []),
            "scope": "Structural references, ranges and counts; binary index/weight values, images and compressed payloads are not decoded"}


def self_test():
    doc = {"asset": {"version": "2.0"}, "buffers": [{"byteLength": 36}],
           "bufferViews": [{"buffer": 0, "byteLength": 36}],
           "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3"}],
           "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}]}
    def pack(value):
        text = json.dumps(value, separators=(",", ":")).encode()
        text += b" " * (-len(text) % 4)
        data = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)
        chunks = struct.pack("<II", len(text), 0x4E4F534A) + text + struct.pack("<II", len(data), 0x004E4942) + data
        return struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks
    valid = pack(doc)
    assert validate_glb(valid)["triangles"] == 1
    bad = [b"", valid[:-1], b"BAD!" + valid[4:]]
    edits = [lambda d: d["meshes"][0]["primitives"][0]["attributes"].update(POSITION=9),
             lambda d: d["bufferViews"][0].update(byteLength=40),
             lambda d: d["accessors"][0].update(count=4),
             lambda d: d.update(nodes=[{"mesh": 4}]),
             lambda d: d.update(materials=[{"normalTexture": {"index": 0}}]),
             lambda d: d.update(skins=[{"joints": [99]}]),
             lambda d: d.update(nodes=[{"children": [1]}, {"children": [0]}]),
             lambda d: d.update(animations=[{"samplers": [{"input": 0, "output": 99}], "channels": [{"sampler": 0, "target": {"node": 0, "path": "translation"}}]}])]
    for edit in edits:
        value = copy.deepcopy(doc)
        edit(value)
        bad.append(pack(value))
    for value in bad:
        try:
            validate_glb(value)
        except (ValueError, KeyError, TypeError, UnicodeError, struct.error):
            continue
        raise AssertionError("Malformed fixture unexpectedly accepted")
    return {"self_test": "passed", "valid_cases": 1, "rejected_cases": len(bad)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("glb", nargs="?")
    parser.add_argument("--self-test", action="store_true")
    for name in ("triangles", "materials", "textures", "bones", "bytes"):
        parser.add_argument(f"--max-{name}", type=int)
    args = parser.parse_args()
    if args.self_test:
        print(json.dumps(self_test()))
        return
    if not args.glb:
        parser.error("Provide a GLB or --self-test")
    try:
        summary = validate_glb(Path(args.glb).read_bytes())
        for name in ("triangles", "materials", "textures", "bones", "bytes"):
            ceiling = getattr(args, f"max_{name}")
            if ceiling is not None:
                require(ceiling >= 0 and summary[name] <= ceiling, f"{name} budget exceeded: {summary[name]} > {ceiling}")
        print(json.dumps(summary, allow_nan=False))
    except (OSError, ValueError, KeyError, TypeError, AttributeError, IndexError, UnicodeError, struct.error) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
