# python3 -I validate_vw_t_cross.py : serialized GLB contract check (6 meshes, 1 prim each, POSITION/NORMAL/COLOR_0, unit normals, bounds, colours)
import json, struct, math, hashlib, sys
from pathlib import Path
p = Path(__file__).resolve().parents[3] / 'assets/vehicles/vw-t-cross.glb'; raw = p.read_bytes()
n = struct.unpack_from('<I', raw, 12)[0]; g = json.loads(raw[20:20 + n]); binary = raw[28 + n:]
def values(i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]; comp = {'VEC3': 3, 'VEC4': 4, 'SCALAR': 1}[a['type']]
    code, size = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2), 5121: ('B', 1)}[a['componentType']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0); stride = v.get('byteStride', comp * size)
    return [struct.unpack_from('<' + code * comp, binary, off + j * stride) for j in range(a['count'])]
assert len(g['meshes']) == 6 and sorted(m['name'] for m in g['materials']) == sorted(['FleetBody', 'FleetGlass', 'FleetTrim', 'FleetRubber', 'FleetLights', 'FleetInterior'])
assert not any(m.get('doubleSided') for m in g['materials'])
pts_all = []; tris = 0; verts = 0
for m in g['meshes']:
    assert len(m['primitives']) == 1; a = m['primitives'][0]['attributes']; assert all(k in a for k in ('POSITION', 'NORMAL', 'COLOR_0'))
    P = values(a['POSITION']); N = values(a['NORMAL']); C = values(a['COLOR_0']); I = values(m['primitives'][0]['indices'])
    assert all(abs(sum(c * c for c in nn) - 1) < 1e-3 for nn in N); pts_all += P; tris += len(I) // 3; verts += len(P)
    cs = sorted({tuple(round(x, 2) for x in c[:3]) for c in C}); print(m['name'], 'tris', len(I) // 3, 'verts', len(P), 'colours', cs[:8], '...' if len(cs) > 8 else '')
lo = [min(p_[i] for p_ in pts_all) for i in range(3)]; hi = [max(p_[i] for p_ in pts_all) for i in range(3)]
print('bounds', [round(x, 3) for x in lo], [round(x, 3) for x in hi], 'tris', tris, 'verts', verts, 'bytes', len(raw))
