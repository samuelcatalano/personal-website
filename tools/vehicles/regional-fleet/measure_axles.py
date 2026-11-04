"""Measure each fleet car's axles from its tyre geometry (stdlib only).

js/world/vehicle-assets.js spins an ambient car's wheels by sending each triangle of the wheel materials to the axle whose centre lies within
one tyre radius of it, so the catalog axles must match the GLB to a few millimetres. A tyre is a connected piece of wheel-material triangles
(welded at equal positions, as at runtime) whose bounding box is round in x-y and narrow in z. The axle is the cluster of such pieces sharing an
x position; tyres touch the road, so the rolling radius equals the centre height.

usage: python3 -I measure_axles.py [--json | --write]
  --json   print the measured axles (tests/fleet-axles.test.mjs and tests/vehicles-wheels.browser.py read them)
  --write  store them in each tools/vehicles/<id>/record.json; then run catalog.py to refresh models.json
"""
import json, pathlib, struct, sys
from array import array

ROOT = pathlib.Path(__file__).resolve().parents[3]
CODES = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
PARTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
MIN_WHEEL_D, MIN_TRIS, AXLE_GAP = 0.3, 40, 0.3  # wheel-sized piece (m), tiny-piece floor, pieces closer than this share an axle


def read_glb(path):
    data = path.read_bytes()
    off, doc, binary = 12, None, b''
    while off < len(data):
        length, kind = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + length]
        off += 8 + length
        if kind == 0x4E4F534A:
            doc = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
    if doc is None or set(doc.get('extensionsUsed', [])) & {'EXT_meshopt_compression', 'KHR_draco_mesh_compression'}:
        raise ValueError(f'{path.name}: needs an uncompressed GLB')
    return doc, binary


def accessor(doc, binary, index):
    acc = doc['accessors'][index]
    view = doc['bufferViews'][acc['bufferView']]
    code, parts = CODES[acc['componentType']], PARTS[acc['type']]
    size = array(code).itemsize
    stride = view.get('byteStride') or size * parts
    base = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    out = array(code)
    if stride == size * parts:
        out.frombytes(binary[base: base + acc['count'] * size * parts])
    else:
        for i in range(acc['count']):
            out.frombytes(binary[base + i * stride: base + i * stride + size * parts])
    return out


def pieces(pos, index):
    """Connected triangle sets (weld by rounded position, then union-find over triangles) -> [(tris, lo, hi)]."""
    parent = list(range(len(pos) // 3)), {}
    parent, first = parent
    for i in range(len(parent)):
        key = (round(pos[3 * i] * 1e5), round(pos[3 * i + 1] * 1e5), round(pos[3 * i + 2] * 1e5))
        if key in first:
            parent[i] = first[key]
        else:
            first[key] = i

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for t in range(0, len(index), 3):
        a = find(index[t])
        for k in (1, 2):
            b = find(index[t + k])
            if b != a:
                parent[b] = a
    tris, box = {}, {}
    for t in range(0, len(index), 3):
        r = find(index[t])
        tris[r] = tris.get(r, 0) + 1
        for k in range(3):
            v = index[t + k]
            p = (pos[3 * v], pos[3 * v + 1], pos[3 * v + 2])
            b = box.get(r)
            if b is None:
                box[r] = [*p, *p]
            else:
                for i in range(3):
                    b[i] = min(b[i], p[i])
                    b[i + 3] = max(b[i + 3], p[i])
    return [(tris[r], box[r][:3], box[r][3:]) for r in box]


def measure(path, wanted):
    doc, binary = read_glb(path)
    cands, low = [], []  # tyre-like pieces; (x, lo_y, centre z) of every wheel-sized piece for the contact check
    for node in doc['nodes']:
        if 'mesh' not in node:
            continue
        for prim in doc['meshes'][node['mesh']]['primitives']:
            name = doc['materials'][prim['material']].get('name', '') if 'material' in prim else ''
            if name not in wanted:
                continue
            pos = accessor(doc, binary, prim['attributes']['POSITION'])
            index = accessor(doc, binary, prim['indices']) if 'indices' in prim else array('I', range(len(pos) // 3))
            for tris, lo, hi in pieces(pos, index):
                ex, ey, ez = hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]
                cx, cy, cz = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2
                if abs(cz) < 0.3:
                    continue
                low.append((cx, lo[1]))  # every piece on a side, fragments included: the lowest tyre point is the contact
                if MIN_WHEEL_D <= ey <= 1.2 and abs(ex - ey) <= 0.25 * max(ex, ey) and ez <= 0.6 * ey and tris >= MIN_TRIS:
                    cands.append({'x': cx, 'y': cy, 'z': cz, 'ey': ey})
    cands.sort(key=lambda c: -c['x'])
    clusters = []
    for c in cands:
        for k in clusters:
            if abs(k[0]['x'] - c['x']) < AXLE_GAP:
                k.append(c)
                break
        else:
            clusters.append([c])
    if len(clusters) != 2:
        raise ValueError(f'{path.name}: expected 2 axles, found {len(clusters)}')
    axles = []
    for k in clusters:
        big = max(c['ey'] for c in k)
        sel = [c for c in k if c['ey'] >= 0.6 * big]  # the tyre-sized pieces; small hubs and lug nuts sit off the centre
        x = sum(c['x'] for c in sel) / len(sel)
        y = sum(c['y'] for c in sel) / len(sel)
        contact = min(lo for px, lo in low if abs(px - x) < 0.5)
        axles.append({'x': x, 'y': y, 'z': sum(abs(c['z']) for c in sel) / len(sel), 'pieces': len(sel), 'contact': contact})
    front, rear = axles
    radius = (front['y'] + rear['y']) / 2  # tyres sit on the road: rolling radius = centre height
    return {'front': front['x'], 'rear': rear['x'], 'height': radius, 'wheelRadius': radius,
            'halfTrack': (front['z'] + rear['z']) / 2, 'contact': max(abs(front['contact']), abs(rear['contact'])),
            'axles': axles}


def fleet():
    return json.loads((ROOT / 'tools/vehicles/regional-fleet/models.json').read_text())['models']


if __name__ == '__main__':
    results = {}
    for m in fleet():
        results[m['id']] = measure(ROOT / m['path'], set(m['axles']['wheelMaterials']))
        results[m['id']]['wheelMaterials'] = m['axles']['wheelMaterials']
    if '--write' in sys.argv:
        for m in fleet():
            rec_path = ROOT / 'tools' / 'vehicles' / m['id'] / 'record.json'
            text = rec_path.read_text()
            indent = len(text.splitlines()[1]) - len(text.splitlines()[1].lstrip())  # keep the file's own layout
            rec = json.loads(text)
            g = results[m['id']]
            rec['axles'].update({k: round(g[k], 3) for k in ('front', 'rear', 'height', 'wheelRadius', 'halfTrack')})
            rec_path.write_text(json.dumps(rec, indent=indent, ensure_ascii=False) + '\n')
            print('wrote', rec_path.relative_to(ROOT))
    elif '--json' in sys.argv:
        print(json.dumps(results))
    else:
        for mid, g in results.items():
            print(f"{mid}: front={g['front']:.3f} rear={g['rear']:.3f} radius={g['wheelRadius']:.3f} halfTrack={g['halfTrack']:.3f} contact={g['contact']:.4f}")
