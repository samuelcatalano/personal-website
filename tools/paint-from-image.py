"""Paint an untextured GLB with vertex colours projected from its reference image.

Dev-only tool, not part of the site. Deps: pip install numpy trimesh pillow "rembg[cpu]"
Usage: python3 tools/paint-from-image.py mesh.glb ref.png out.glb [--sym x,z] [--trim-floor 0.02]

1. rembg cuts the object out of the reference image (mask).
2. A yaw/pitch search finds the orthographic view whose mesh silhouette best matches the mask.
3. Each vertex takes the colour under its projection. Vertices facing away take the colour of
   their mirror image (--sym), which suits buildings and vehicles.
ponytail: normal-facing test only, no depth test; parts hidden behind others in the photo
get the occluder's colour. Upgrade path: rasterise a depth buffer per view.
"""
import argparse
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFilter
from rembg import remove

ap = argparse.ArgumentParser()
ap.add_argument('mesh'); ap.add_argument('ref'); ap.add_argument('out')
ap.add_argument('--sym', default='x', help='mirror axes for back faces, e.g. "x" or "x,z"')
# reference images show the object's front three-quarters, so only front-facing yaws are searched
ap.add_argument('--trim-floor', type=float, default=0, help='drop faces in the bottom fraction of the height (ground slabs)')
a = ap.parse_args()

mesh = trimesh.load(a.mesh, force='mesh')
if a.trim_floor:
    y0, h = mesh.bounds[0][1], mesh.extents[1]
    keep = mesh.triangles_center[:, 1] > y0 + a.trim_floor * h
    mesh.update_faces(keep); mesh.remove_unreferenced_vertices()
    # the slab is often wider than the object: keep the largest connected piece
    parts = mesh.split(only_watertight=False)
    mesh = max(parts, key=lambda m: len(m.faces))
V = mesh.vertices - mesh.bounds.mean(axis=0)
N = mesh.vertex_normals

ref = Image.open(a.ref).convert('RGB')
cut = remove(ref)  # RGBA
mask = np.array(cut)[:, :, 3] > 128
ys, xs = np.nonzero(mask)
mb = np.array([xs.min(), ys.min(), xs.max(), ys.max()], float)
H, W = mask.shape

# Fill background with the nearest object colour so edge samples are never grey sky.
rgb = np.array(ref, float)
fill = Image.fromarray(np.where(mask[..., None], rgb, 0).astype(np.uint8))
known = Image.fromarray((mask * 255).astype(np.uint8))
for _ in range(40):
    grown = fill.filter(ImageFilter.MaxFilter(3))
    kg = known.filter(ImageFilter.MaxFilter(3))
    f, g, k = np.array(fill), np.array(grown), np.array(known)[..., None] > 0
    fill = Image.fromarray(np.where(k, f, g)); known = kg
tex = np.array(fill.filter(ImageFilter.GaussianBlur(0.7)), float)

def rot(yaw, pitch):
    cy, sy, cp, sp = np.cos(yaw), np.sin(yaw), np.cos(pitch), np.sin(pitch)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
    return Rx @ Ry

def screen(P, R):
    Q = P @ R.T
    s = np.c_[Q[:, 0], -Q[:, 1]]
    return s, Q

faces = mesh.faces[np.random.default_rng(0).choice(len(mesh.faces), min(25000, len(mesh.faces)), replace=False)]
def fit(R):
    s, _ = screen(V, R)
    lo, hi = s.min(0), s.max(0)
    k = min((mb[2] - mb[0]) / (hi - lo)[0], (mb[3] - mb[1]) / (hi - lo)[1])
    off = (mb[:2] + mb[2:]) / 2 - k * (lo + hi) / 2
    return k, off

def iou(R):
    k, off = fit(R)
    s = screen(V, R)[0] * k + off
    im = Image.new('1', (W, H)); d = ImageDraw.Draw(im)
    for f in faces: d.polygon([tuple(p) for p in s[f]], fill=1)
    m = np.array(im)
    return (m & mask).sum() / (m | mask).sum()

best = max(((iou(rot(np.radians(y), np.radians(p))), y, p) for y in range(-84, 85, 6) for p in (0, 8, 16, 24, 32)))
_, by, bp = best
best = max(((iou(rot(np.radians(y), np.radians(p))), y, p) for y in range(by - 6, by + 7, 2) for p in range(max(0, bp - 6), bp + 7, 2)))
score, by, bp = best
R = rot(np.radians(by), np.radians(bp))
k, off = fit(R)
print(f'view yaw={by} pitch={bp} iou={score:.3f}')

mirrors = [np.ones(3)] + [np.array([-1 if ax == c else 1 for c in 'xyz'], float) for ax in a.sym.split(',') if ax]
if len(mirrors) == 3: mirrors.append(mirrors[1] * mirrors[2])
facing = np.stack([(N * m) @ R.T for m in mirrors])[:, :, 2]  # view z of each mirrored normal
pick = facing.argmax(0)
P = V * np.stack(mirrors)[pick]
s = screen(P, R)[0] * k + off
xi = np.clip(s[:, 0].round().astype(int), 0, W - 1); yi = np.clip(s[:, 1].round().astype(int), 0, H - 1)
col = 255 * (tex[yi, xi] / 255) ** 2.2  # glTF vertex colours are linear
mesh.visual = trimesh.visual.ColorVisuals(mesh, vertex_colors=np.c_[col, np.full(len(col), 255)].astype(np.uint8))
glb = mesh.export(file_type='glb')
# trimesh writes no material and glTF then defaults to fully metallic (renders near black): add a matte one
import json, struct
n = struct.unpack('<I', glb[12:16])[0]
j = json.loads(glb[20:20 + n])
j['materials'] = [{'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 0.85}}]
for m in j['meshes']:
    for pr in m['primitives']: pr['material'] = 0
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
rest = glb[20 + n:]
open(a.out, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + len(rest)) + struct.pack('<II', len(js), 0x4E4F534A) + js + rest)
print(f'wrote {a.out}: {len(mesh.faces)} faces')
