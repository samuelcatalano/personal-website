"""Merge Blender-exported walk animations into the textured NPC GLB."""
import copy
import json
import os
import struct
import sys
from pathlib import Path

MAGIC, JSON_CHUNK, BIN_CHUNK = 0x46546C67, 0x4E4F534A, 0x004E4942


def read_glb(path):
    data = Path(path).read_bytes()
    magic, version, length = struct.unpack_from("<III", data)
    assert magic == MAGIC and version == 2 and length == len(data), path
    doc = binary = None
    offset = 12
    while offset < len(data):
        size, kind = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8:offset + 8 + size]
        if kind == JSON_CHUNK:
            doc = json.loads(chunk)
        elif kind == BIN_CHUNK:
            binary = chunk
        offset += 8 + size
    assert doc is not None and binary is not None, path
    return doc, binary


def node_paths(doc):
    parents = {child: index for index, node in enumerate(doc["nodes"]) for child in node.get("children", [])}

    def path(index):
        names = []
        while index is not None:
            names.append(doc["nodes"][index].get("name", ""))
            index = parents.get(index)
        return tuple(reversed(names))

    return path


def encode_glb(doc, binary):
    raw = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    raw += b" " * (-len(raw) % 4)
    binary += b"\0" * (-len(binary) % 4)
    length = 12 + 8 + len(raw) + 8 + len(binary)
    return (struct.pack("<III", MAGIC, 2, length) + struct.pack("<II", len(raw), JSON_CHUNK) + raw
            + struct.pack("<II", len(binary), BIN_CHUNK) + binary)


def merge(base_path, animation_path, output_path):
    base_path, animation_path, output_path = map(Path, (base_path, animation_path, output_path))
    assert output_path.resolve() not in (base_path.resolve(), animation_path.resolve()), "output must be a new file"
    base, base_binary = read_glb(base_path)
    candidate, candidate_binary = read_glb(animation_path)
    assert len(base.get("buffers", [])) == len(candidate.get("buffers", [])) == 1
    expected = {animation["name"] for animation in base["animations"]}
    assert expected == {animation["name"] for animation in candidate["animations"]}
    original = copy.deepcopy(base)

    base_path_of, candidate_path_of = node_paths(base), node_paths(candidate)
    node_map = {}
    for animation in candidate["animations"]:
        for channel in animation["channels"]:
            source = channel["target"]["node"]
            path = candidate_path_of(source)
            targets = [i for i in range(len(base["nodes"])) if base_path_of(i) == path]
            assert len(targets) == 1, (animation["name"], path, targets)
            node_map[source] = targets[0]

    binary, view_map, accessor_map = base_binary, {}, {}
    for animation in candidate["animations"]:
        for sampler in animation["samplers"]:
            for key in ("input", "output"):
                source = sampler[key]
                if source in accessor_map:
                    continue
                accessor = copy.deepcopy(candidate["accessors"][source])
                assert "sparse" not in accessor, (animation["name"], source)
                if "bufferView" in accessor:
                    old_view = accessor["bufferView"]
                    if old_view not in view_map:
                        view = copy.deepcopy(candidate["bufferViews"][old_view])
                        start, size = view.get("byteOffset", 0), view["byteLength"]
                        payload = candidate_binary[start:start + size]
                        assert len(payload) == size, (animation["name"], old_view)
                        binary += b"\0" * (-len(binary) % 4)
                        view["buffer"] = 0
                        view["byteOffset"] = len(binary)
                        view.pop("name", None)
                        view_map[old_view] = len(base["bufferViews"])
                        base["bufferViews"].append(view)
                        binary += payload
                    accessor["bufferView"] = view_map[old_view]
                accessor.pop("name", None)
                accessor_map[source] = len(base["accessors"])
                base["accessors"].append(accessor)

    base["animations"] = copy.deepcopy(candidate["animations"])
    for animation in base["animations"]:
        for sampler in animation["samplers"]:
            sampler["input"] = accessor_map[sampler["input"]]
            sampler["output"] = accessor_map[sampler["output"]]
        for channel in animation["channels"]:
            channel["target"]["node"] = node_map[channel["target"]["node"]]
    base["buffers"][0]["byteLength"] = len(binary)

    for key in ("nodes", "meshes", "skins", "materials", "textures", "images"):
        assert base[key] == original[key], key
    assert binary.startswith(base_binary), "the original mesh and texture data must remain byte-identical"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_suffix(output_path.suffix + ".tmp")
    temporary.write_bytes(encode_glb(base, binary))
    os.replace(temporary, output_path)

    check, check_binary = read_glb(output_path)
    assert {animation["name"] for animation in check["animations"]} == expected
    assert all(channel["target"]["node"] < len(check["nodes"])
               for animation in check["animations"] for channel in animation["channels"])
    assert all(view.get("byteOffset", 0) + view["byteLength"] <= len(check_binary) for view in check["bufferViews"])
    print("PATCHED", output_path, output_path.stat().st_size, "animations", len(check["animations"]),
          "views", len(view_map), "accessors", len(accessor_map), "images", len(check["images"]))


if __name__ == "__main__":
    assert len(sys.argv) == 4, "usage: pack_animations.py base.glb animation-export.glb output.glb"
    merge(*sys.argv[1:])
