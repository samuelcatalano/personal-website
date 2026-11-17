"""Restore denim in the shipped NPC pack. Usage: python repair_suit_atlas.py PACK.glb MH_ASSETS OUTPUT.glb."""
import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# The lower left UV islands are trousers. Suit 02 also has a sleeve at bottom right.
DENIM_ISLANDS = {
    'male_casualsuit02': (.740, .411),
    'male_casualsuit04': (.725, .409),
    'male_casualsuit06': (.760, .425),
}


def denim_mask(size, suit):
    width, height = size
    right, top = DENIM_ISLANDS[suit]
    mask = Image.new('L', size)
    ImageDraw.Draw(mask).rectangle((0, round(top * height), round(right * width), height), fill=255)
    return mask


def repair(pack, assets, out):
    raw = pack.read_bytes()
    magic, version, length, json_size, chunk = struct.unpack_from('<5I', raw)
    assert (magic, version, length, chunk) == (0x46546C67, 2, len(raw), 0x4E4F534A)
    data = json.loads(raw[20:20 + json_size])
    bin_size, bin_type = struct.unpack_from('<2I', raw, 20 + json_size)
    assert bin_type == 0x004E4942 and len(raw) == 28 + json_size + bin_size
    binary = raw[28 + json_size:]
    replacements = {}
    for material in data['materials']:
        name = material['name']
        if not name.endswith('_plain'):
            continue
        suit = name.removeprefix('mh_clothes_').removesuffix('_plain')
        texture = data['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]
        image = data['images'][texture['extensions']['EXT_texture_webp']['source']]
        index = image['bufferView']
        view = data['bufferViews'][index]
        offset = view.get('byteOffset', 0)
        baked = Image.open(io.BytesIO(binary[offset:offset + view['byteLength']])).convert('RGB')
        source = Image.open(assets / 'clothes' / suit / f'{suit}_diffuse.png').convert('RGB')
        source = source.resize(baked.size, Image.Resampling.LANCZOS)
        mask = denim_mask(baked.size, suit)
        fixed = Image.composite(source, baked, mask)
        # Keep alpha high so image/canvas decoding retains denim RGB. The opaque shader treats it as a tint mask.
        fixed.putalpha(mask.point(lambda value: 255 if value == 0 else 224))
        payload = io.BytesIO()
        fixed.save(payload, format='WEBP', quality=95, method=6)
        replacements[index] = payload.getvalue()
    assert len(replacements) == len(DENIM_ISLANDS)
    buf = bytearray()
    for i, view in enumerate(data['bufferViews']):
        offset = view.get('byteOffset', 0)
        payload = replacements.get(i, binary[offset:offset + view['byteLength']])
        view['byteOffset'] = len(buf)
        view['byteLength'] = len(payload)
        buf.extend(payload)
        buf.extend(b'\0' * (-len(buf) % 4))
    data['buffers'][0]['byteLength'] = len(buf)
    metadata = json.dumps(data, separators=(',', ':'), ensure_ascii=False).encode()
    metadata += b' ' * (-len(metadata) % 4)
    out.write_bytes(struct.pack('<5I', magic, version, 28 + len(metadata) + len(buf), len(metadata), chunk)
                    + metadata + struct.pack('<2I', len(buf), bin_type) + buf)


if __name__ == '__main__':
    repair(*(Path(arg) for arg in sys.argv[1:]))
