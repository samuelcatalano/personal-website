"""Keep geometry and normal pixels exact; compress 2K albedo as high-quality WebP."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image


def compress(source, output, lab):
    sys.path.insert(0, str(lab))
    from image_to_3dlab.glb_turn import parse_glb, build_glb
    raw = source.read_bytes()
    document, binary = parse_glb(raw)
    images = document.get('images', [])
    def image_index(texture):
        entry = document['textures'][texture]
        return entry.get('extensions', {}).get('EXT_texture_webp', {}).get('source', entry.get('source'))
    data_images = set()
    for material in document.get('materials', []):
        for slot in ('normalTexture', 'occlusionTexture'):
            if slot in material:
                data_images.add(image_index(material[slot]['index']))
        pbr = material.get('pbrMetallicRoughness', {})
        if 'metallicRoughnessTexture' in pbr:
            data_images.add(image_index(pbr['metallicRoughnessTexture']['index']))
    replacements, records = {}, []
    for index, image in enumerate(images):
        view_index = image['bufferView']
        view = document['bufferViews'][view_index]
        start = view.get('byteOffset', 0)
        payload = binary[start:start + view['byteLength']]
        pixels = Image.open(io.BytesIO(payload))
        pixels.load()
        encoded = io.BytesIO()
        lossless = index in data_images
        pixels.save(encoded, 'WEBP', quality=100 if lossless else 92,
                    lossless=lossless, exact=True, method=6)
        blob = encoded.getvalue()
        decoded = Image.open(io.BytesIO(blob)).convert('RGBA')
        before = np.asarray(pixels.convert('RGBA'))
        after = np.asarray(decoded)
        if lossless:
            assert np.array_equal(before, after), 'Normal/data map pixels changed'
        assert pixels.size == decoded.size
        replacements[view_index] = blob
        image['mimeType'] = 'image/webp'
        records.append({'image': index, 'lossless': lossless, 'size': list(pixels.size),
                        'before': len(payload), 'after': len(blob),
                        'rgb_rmse': float(np.sqrt(np.mean((before[:, :, :3].astype(float) - after[:, :, :3]) ** 2)))})
    rebuilt = bytearray()
    for index, view in enumerate(document['bufferViews']):
        start = view.get('byteOffset', 0)
        old = binary[start:start + view['byteLength']]
        payload = replacements.get(index, old)
        rebuilt += b'\0' * (-len(rebuilt) % 4)
        view['byteOffset'], view['byteLength'] = len(rebuilt), len(payload)
        rebuilt += payload
        if index not in replacements:
            assert hashlib.sha256(payload).digest() == hashlib.sha256(old).digest()
    document['buffers'] = [{'byteLength': len(rebuilt)}]
    for texture in document.get('textures', []):
        source_index = texture.get('extensions', {}).get('EXT_texture_webp', {}).get('source', texture.get('source'))
        texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': source_index}
        texture.pop('source', None)
    for key in ('extensionsUsed', 'extensionsRequired'):
        if 'EXT_texture_webp' not in document.setdefault(key, []):
            document[key].append('EXT_texture_webp')
    output.parent.mkdir(parents=True, exist_ok=True)
    result = build_glb(document, bytes(rebuilt))
    output.write_bytes(result)
    report = {'input': str(source), 'output': str(output), 'before_bytes': len(raw),
              'after_bytes': len(result), 'geometry_buffers': 'byte-identical', 'images': records}
    output.with_suffix('.compression.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--lab', type=Path, default=Path.home() / 'image-to-3dlab')
    args = parser.parse_args()
    compress(args.source, args.output, args.lab)
