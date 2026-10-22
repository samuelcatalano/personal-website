# Original stylised modern double-decker bus master. Run: blender -b --factory-startup -P build_bus.py -- out.glb
# Blender axes: nose +X, up +Z, right side = -Y  (glTF export_yup -> three.js: forward +X, up +Y, right +Z). Origin on ground, centred.
# Paint lives on semantic materials (BusBody / BusAccent) so the runtime can repaint (London red / Glasgow purple).
import bpy, bmesh, math, sys
from mathutils import Vector

# ---------------- data / profile constants ----------------
W = 1.275                       # half width (width 2.55)
XF, XR = 4.3, -4.6              # where the straight sides end (front / rear plan arcs start)
LF, LR, NF, NR = 1.3, 1.0, 2.4, 2.2   # arc lengths and superellipse exponents -> total length 11.2
ZB = 0.30                       # ground clearance
WHEELS = (3.4, -3.0); WR, WY, WARCH, WINSET = 0.47, 1.11, 0.56, 0.34
NODES = [1.05, 2.10, 2.85, 3.80]                      # wall rows (lean nodes)
FRONT_T = [(0, 5.6), (1.05, 5.6), (2.10, 5.5), (2.85, 5.35), (3.80, 5.12), (4.4, 4.90)]   # raked windscreen
REAR_T = [(0, -5.6), (1.05, -5.6), (3.80, -5.45), (4.4, -5.25)]
ROOF_RISE = 0.50                # roof arc above z=3.8 -> top 4.30 (pods bring it to ~4.4)
LOW = (1.12, 2.00); UP = (2.92, 3.74)                 # glazing z ranges, lower / upper deck
M_, OFF_B, OFF_G = 0.04, 0.010, 0.026                 # trim surround, backing offset, glass offset
dxR = lambda z: 1.10 + (3.80 - z) * 2.40 / 2.75       # right-side front staircase band (rear edge, x vs z)
dxL = lambda z: -2.20 - (3.80 - z) * 1.30 / 2.75      # left-side rear staircase band
BAND = 0.95

bpy.ops.wm.read_factory_settings(use_empty=True)
def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)
def mat(name, hexcol, rough=0.45, metal=0.0, alpha=1.0, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*lin(hexcol), 1)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(hexcol), 1); b.inputs['Emission Strength'].default_value = emit
    return m
BODY, ACCENT, TRIM = mat('BusBody', '#c9252b', 0.38), mat('BusAccent', '#8e1a1f', 0.4), mat('BusTrim', '#0d0e10', 0.35)
GLASS, METAL = mat('BusGlass', '#2a4558', 0.05, 0.0, 0.6), mat('BusMetal', '#d4d7da', 0.4, 0.4)
HEAD, TAIL, DISP = mat('BusHeadlight', '#fff3d6', 0.2, 0, 1, 2.0), mat('BusTaillight', '#c01414', 0.3, 0, 1, 1.0), mat('BusDisplay', '#3a2a08', 0.3, 0, 1, 1.2)
B_BODY, B_ACC, B_TRIM, B_MET = 0, 1, 2, 3             # Body mesh material slots

def interp(t, z):
    for (za, a), (zb, b) in zip(t, t[1:]):
        if z <= zb: return a + (b - a) * max(0.0, (z - za)) / (zb - za)
    return t[-1][1]
def xmap(x0, z):                                      # nominal station x0 -> real x at height z (rake of nose and tail)
    f, r = interp(FRONT_T, z), interp(REAR_T, z); return r + (x0 + 5.6) / 11.2 * (f - r)
def new_obj(name, bm, mats):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    for m in mats: me.materials.append(m)
    return ob

# ---------------- plan outline paths: s -> (x0, yRight, nx, ny) ----------------
def arc(a, x_start, L, n, sgn_x):                      # pebble end: superellipse, a in [-1,1], a=0 centre
    ph = math.pi / 2 * (1 - min(1.0, abs(a))); u = math.sin(ph) ** (2 / n); y = (1 if a >= 0 else -1) * W * max(0.0, math.cos(ph)) ** (2 / n)
    return x_start + sgn_x * L * u, y
def end_path(x_start, L, n, sgn_x):
    def p(a):
        x, y = arc(a, x_start, L, n, sgn_x); xa, ya = arc(a + 0.01, x_start, L, n, sgn_x); xb, yb = arc(a - 0.01, x_start, L, n, sgn_x)
        tx, ty = xa - xb, ya - yb; l = math.hypot(tx, ty) or 1; nx, ny = ty / l, -tx / l
        if nx * (x - x_start) + ny * y < 0 or (abs(a) < 1e-6 and nx * sgn_x < 0): nx, ny = -nx, -ny
        return x, y, nx, ny
    return p
PF, PR = end_path(XF, LF, NF, 1), end_path(XR, LR, NR, -1)
side = lambda sg: (lambda s: (s, sg * W, 0.0, float(sg)))
def P3(o, z, off=0.0): return Vector((xmap(o[0], z) + o[2] * off, -(o[1] + o[3] * off), z)), Vector((o[2], -o[3], 0))

# ---------------- generic conforming patch (rows follow lean nodes) ----------------
def patch(bm, path, lo, hi, z0, z1, nu, off, mi, sub=1, uv=False):
    f_ = lambda v: v if callable(v) else (lambda z, v=v: v)
    lo, hi = f_(lo), f_(hi)
    zs = sorted(set([z0, z1] + [n for n in NODES if z0 < n < z1])); rows = []
    for za, zb in zip(zs, zs[1:]): rows += [za + (zb - za) * k / sub for k in range(sub)]
    rows.append(zs[-1]); vs = []; nrm = {}; uvs = {}
    for ri, z in enumerate(rows):
        r = []
        for i in range(nu + 1):
            o = path(lo(z) + (hi(z) - lo(z)) * i / nu); p, n = P3(o, z, off); v = bm.verts.new(p); nrm[v] = n; uvs[v] = (i / nu, (z - z0) / (z1 - z0)); r.append(v)
        vs.append(r)
    out = []
    for a, b in zip(vs, vs[1:]):
        for i in range(nu):
            try: f = bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
            except ValueError: continue
            f.normal_update()
            if f.normal.dot(sum((nrm[v] for v in f.verts), Vector())) < 0: f.normal_flip()
            f.material_index = mi; out.append(f)
            if uv:
                l = bm.loops.layers.uv.verify()
                for lp in f.loops: lp[l].uv = uvs[lp.vert]
    return out

# ---------------- hull: lofted sections with pebble ends, wheel arches ----------------
RIGHT = [('c', 0, ZB), ('w', 0.30, ZB), ('w', 0.10, 0.36), ('w', 0, 0.47), ('w', 0, 0.62), ('w', 0, 0.95), ('w', 0, 1.05), ('w', 0, 2.10), ('w', 0, 2.85), ('w', 0, 3.80)] \
        + [('r', math.radians(t), 0) for t in (15, 30, 45, 60, 75, 90)]
def zarch(x0):
    return max([WR + math.sqrt(WARCH ** 2 - (x0 - c) ** 2) for c in WHEELS if abs(x0 - c) < WARCH] or [0])
def ring(x0, w):
    pts = []; flags = []
    for kind, a, z in RIGHT:
        inset = False
        if kind == 'c': y, zz = 0.0, z
        elif kind == 'w':
            inset = z < zarch(x0); y, zz = max(0.0, w - a - (WINSET if inset else 0)), z
        else: y, zz = w * math.cos(a), 3.80 + ROOF_RISE * (0.3 + 0.7 * min(1.0, w / (0.85 * W)) ** 0.6) * math.sin(a)
        pts.append((y, zz)); flags.append(inset)
    full = pts + [(-y, z) for y, z in reversed(pts[1:-1])]; fl = flags + list(reversed(flags[1:-1]))
    return [Vector((xmap(x0, z), -y, z)) for y, z in full], fl
def stations():
    st = []
    for k in range(13):  ph = math.pi / 2 * (1 - k / 12); st.append((XR - LR * math.sin(ph) ** (2 / NR), W * max(0.0, math.cos(ph)) ** (2 / NR), 'r'))
    xs = {round(XR + 0.6 * k, 3) for k in range(1, 15) if XR + 0.6 * k < XF - 0.3}
    for c in WHEELS: xs |= {round(c + d, 3) for d in (-0.56, -0.42, -0.28, -0.14, 0, 0.14, 0.28, 0.42, 0.56)}
    xs = sorted(x for x in xs if XR < x < XF)
    st += [(x, W, 'c') for x in xs]
    for k in range(15): ph = math.pi / 2 * (k / 14); st.append((XF + LF * math.sin(ph) ** (2 / NF), W * max(0.0, math.cos(ph)) ** (2 / NF), 'f'))
    return st
ST = stations(); N = 2 * len(RIGHT) - 2
bm = bmesh.new(); V = []; F = []
for x0, w, k in ST:
    pts, fl = ring(x0, w); V.append([bm.verts.new(p) for p in pts]); F.append(fl)
hull_faces = []
for i in range(len(ST) - 1):
    for j in range(N):
        j2 = (j + 1) % N; seg = j if j < len(RIGHT) - 1 else N - 1 - j
        try: f = bm.faces.new((V[i][j], V[i + 1][j], V[i + 1][j2], V[i][j2]))
        except ValueError: continue
        front = ST[i][2] == 'f' or (ST[i][0] >= XF - 1e-6)
        m = B_BODY
        if seg <= 2: m = B_TRIM
        elif seg == 3: m = B_ACC
        elif front and ((seg == 4 and (ST[i][1] + ST[i + 1][1]) / 2 < 0.78 * W) or seg == 7): m = B_TRIM        # black front mask + bumper band
        if any(F[i][a] or F[i + 1][a] or F[i][b] or F[i + 1][b] for a, b in ((j, j2),)) and seg <= 5: m = B_TRIM   # wheel arch interior
        f.material_index = m; hull_faces.append(f)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
HULL_NONMANIFOLD = sum(1 for e in bm.edges if not e.is_manifold)

bg, bd = bmesh.new(), bmesh.new()    # glass, display
bli = bmesh.new()
def window(path, lo, hi, z0, z1, nu=1, sub=1, m=M_):
    f_ = lambda v: v if callable(v) else (lambda z, v=v: v)
    l, h = f_(lo), f_(hi)
    patch(bm, path, lambda z: l(z) - m, lambda z: h(z) + m, z0 - m, z1 + m, nu, OFF_B, B_TRIM, sub)
    patch(bg, path, l, h, z0, z1, nu, OFF_G, 0, sub)
def bays(path, x_from, x_to, pitch, gap, zr, lmin=-9.0, lmax=9.0, skip=()):
    fl = lambda v: v if callable(v) else (lambda z, v=v: v); lmin, lmax = fl(lmin), fl(lmax)
    xa = x_from
    while xa + pitch - gap <= x_to + 1e-6:
        xb = xa + pitch - gap
        if not any(xa < s1 and xb > s0 for s0, s1 in skip):
            lo = lambda z, xa=xa: max(xa, lmin(z)); hi = lambda z, xb=xb, lo=lo: max(lo(z) + 0.01, min(xb, lmax(z)))
            ws = [hi(z) - lo(z) for z in zr]; clipped = lo(zr[0]) != xa or lo(zr[1]) != xa or hi(zr[0]) != xb or hi(zr[1]) != xb
            if max(ws) > (0.3 if clipped else 0.1): window(path, lo, hi, zr[0], zr[1], 1, 6 if clipped else 1)
        xa += pitch
SR, SL = side(1), side(-1)
# ---- explicit window layout constants (both sides use the same function) ----
UPPER_Z = (3.07, 3.77); LOWER_Z = (1.20, 2.00)
UP_X = (-4.55, 4.25)                       # upper ribbon: rear window -> red diagonal band
LOW_X = (-3.35, 4.25)                      # lower ribbon: behind engine panel -> front door
GRID0, PITCH, PILLAR_W = -3.30, 1.15, 0.08  # shared pillar grid (aligned deck to deck)
STAIR_TOP, STAIR_SLOPE, STAIR_W = (3.14, 3.77), 0.9, 0.70   # RED diagonal body band: rear edge passes (x, z)=STAIR_TOP, rises FORWARD at ~42 deg, 0.7 m wide horizontally
rear_edge = lambda z: STAIR_TOP[0] - (STAIR_TOP[1] - z) / STAIR_SLOPE
front_edge = lambda z: rear_edge(z) + STAIR_W
DOOR_X = (3.75, 4.15)                      # passenger door pillars, kerb (left) side only
def pillars(path, l, h, zr, xs, w=PILLAR_W / 2):
    for x in xs:
        if all(l(z) + 0.12 < x < h(z) - 0.12 for z in zr): patch(bm, path, x - w, x + w, zr[0], zr[1], 1, OFF_G + 0.01, B_TRIM, 1)
def glaze(path, lo, hi, zr, sub=1, m=0.03, grid=True):
    f_ = lambda v: v if callable(v) else (lambda z, v=v: v)
    l, h = f_(lo), f_(hi)
    if max(h(z) - l(z) for z in zr) < 0.3: return
    window(path, l, h, zr[0], zr[1], 1, sub, m)
    if grid: pillars(path, l, h, zr, [GRID0 + PITCH * k for k in range(-1, 8)])
def side_layout(path, sg):                 # sg = +1 right / -1 left(kerb); everything except the door is symmetric
    glaze(path, UP_X[0], rear_edge, UPPER_Z, 6)                                       # upper ribbon, front end cut by the red band's rear edge
    glaze(path, LOW_X[0], LOW_X[1], LOWER_Z)                                          # lower ribbon
    glaze(path, front_edge, 4.25, (LOWER_Z[1], UPPER_Z[1]), 8, 0.0, False)           # stair glass: only FORWARD of the red diagonal
    for off in (0.75, 1.50):                                                          # slanted thin pillars parallel to the band
        patch(bm, path, lambda z, o=off: min(front_edge(z) + o, 4.15), lambda z, o=off: min(front_edge(z) + o, 4.15) + 0.07, LOWER_Z[1] + 0.03, UPPER_Z[1] - 0.03, 1, OFF_G + 0.01, B_TRIM, 4)
    if sg < 0:
        for x in DOOR_X: patch(bm, path, x - 0.05, x + 0.05, LOWER_Z[0], LOWER_Z[1], 1, OFF_G + 0.01, B_TRIM, 1)
    patch(bm, path, -4.40, -3.45, 0.72, 2.02, 1, 0.010, B_TRIM, 1)                  # rear engine louvre recess
    for k in range(7): patch(bm, path, -4.34, -3.51, 0.80 + 0.17 * k, 0.88 + 0.17 * k, 1, 0.018, B_ACC, 1)
    patch(bd, path, 0.05, 1.15, 2.20, 2.60, 1, 0.014, 0, 1, uv=True); patch(bm, path, 0.00, 1.20, 2.16, 2.64, 1, 0.008, B_TRIM, 1)
for sg, sp in ((1, SR), (-1, SL)): side_layout(sp, sg)
# front: deep curved lower + upper screens (wrap into the sides) in a black frame; display band proud in the mask
for zr in ((1.12, 2.05), (2.92, 3.78)):
    patch(bm, PF, -0.97, 0.97, zr[0] - 0.05, zr[1] + 0.03, 16, 0.012, B_TRIM, 3)
    patch(bg, PF, -0.93, 0.93, zr[0], zr[1], 16, 0.030, 0, 3)
patch(bd, PF, -0.72, 0.72, 2.20, 2.72, 10, 0.035, 0, 1, uv=True); patch(bm, PF, -0.76, 0.76, 2.16, 2.76, 10, 0.014, B_TRIM, 1)
# rear: wrap-around upper window, big lower louvre grille, number-plate recess
patch(bg, PR, -0.95, 0.95, 2.90, 3.72, 16, 0.030, 0, 2); patch(bm, PR, -0.98, 0.98, 2.86, 3.76, 16, 0.014, B_TRIM, 2)
patch(bm, PR, -0.68, 0.68, 0.72, 2.05, 12, 0.012, B_TRIM, 2)
for k in range(8): patch(bm, PR, -0.62, 0.62, 0.80 + 0.16 * k, 0.88 + 0.16 * k, 12, 0.020, B_ACC, 1)
patch(bm, PR, -0.20, 0.20, 0.50, 0.66, 4, 0.012, B_MET, 1)

# lights: headlamp discs with trim bezels (front), tail lamp strips (rear)
def disc(bmL, path, a, z, r, off, mi, segs=16, dome=0.03):
    o = path(a); c, n = P3(o, z, off); t = (P3(path(a + 0.02), z)[0] - P3(path(a - 0.02), z)[0]).normalized(); up = Vector((0, 0, 1))
    ctr = bmL.verts.new(c + n * dome); ring_ = [bmL.verts.new(c + (t * math.cos(2 * math.pi * k / segs) + up * math.sin(2 * math.pi * k / segs)) * r) for k in range(segs)]
    for k in range(segs):
        f = bmL.faces.new((ctr, ring_[k], ring_[(k + 1) % segs]))
        f.normal_update()
        if f.normal.dot(n) < 0: f.normal_flip()
        f.material_index = mi
for a in (-0.62, 0.62):
    bez = []
    disc(bli, PF, a, 0.82, 0.14, 0.014, 0)
    disc(bm, PF, a, 0.82, 0.18, 0.008, B_TRIM, dome=0.0)
for a0, a1 in ((0.70, 0.90), (-0.90, -0.70)):
    patch(bli, PR, a0, a1, 0.90, 1.60, 2, 0.012, 1, 1)
    patch(bm, PR, a0 - 0.03, a1 + 0.03, 0.85, 1.65, 2, 0.006, B_TRIM, 1)

# boxes: roof AC pods, mirrors, interior
def box(b, c, s, mi, bev=0.0):
    before = set(b.faces); r = bmesh.ops.create_cube(b, size=1.0); vs = r['verts']
    for v in vs: v.co = Vector((c[0] + v.co.x * s[0], c[1] + v.co.y * s[1], c[2] + v.co.z * s[2]))
    fs = list({f for v in vs for f in v.link_faces})
    if bev:
        res = bmesh.ops.bevel(b, geom=list({e for f in fs for e in f.edges}), offset=bev, segments=2, affect='EDGES')
        fs = [f for f in b.faces if f not in before]
    for f in fs: f.material_index = mi
for cx in (-2.35, 1.15): box(bm, (cx, 0, 4.30), (1.5, 0.95, 0.20), B_MET, 0.06)
for sg in (1, -1):
    box(bm, (4.50, sg * 1.42, 2.40), (0.05, 0.34, 0.05), B_MET); box(bm, (4.50, sg * 1.58, 2.42), (0.09, 0.05, 0.40), B_TRIM, 0.015)

# wheels: shared tyre+hub, axis along Y, hub faces +Y
bw = bmesh.new()
PROF = [(0, -0.15), (0.30, -0.15), (0.43, -0.145), (0.47, -0.09), (0.47, 0.09), (0.43, 0.145), (0.30, 0.15), (0.28, 0.16), (0.13, 0.165), (0.11, 0.19), (0, 0.195)]
SEG = 24; rs = [[bw.verts.new((r * math.cos(2 * math.pi * k / SEG), y, r * math.sin(2 * math.pi * k / SEG))) for k in range(SEG)] for r, y in PROF]
for pi_, (a, b) in enumerate(zip(rs, rs[1:])):
    for k in range(SEG):
        try: f = bw.faces.new((a[k], a[(k + 1) % SEG], b[(k + 1) % SEG], b[k]))
        except ValueError: continue
        f.material_index = 1 if pi_ == 6 else 0
bmesh.ops.remove_doubles(bw, verts=list(bw.verts), dist=1e-5); bmesh.ops.recalc_face_normals(bw, faces=list(bw.faces))
wheel_me = bpy.data.meshes.new('Wheel'); bw.to_mesh(wheel_me); bw.free(); wheel_me.materials.append(TRIM); wheel_me.materials.append(METAL)

# ---------------- assemble ----------------
body = new_obj('Body', bm, [BODY, ACCENT, TRIM, METAL]); glass = new_obj('Glass', bg, [GLASS]);
lights = new_obj('Lights', bli, [HEAD, TAIL]); disp = new_obj('Display', bd, [DISP])
for ob in (body, glass, lights, disp):
    bpy.context.view_layer.objects.active = ob; ob.select_set(True); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40)); ob.select_set(False)
root = bpy.data.objects.new('BusRoot', None); bpy.context.collection.objects.link(root)
wh = bpy.data.objects.new('Wheels', None); bpy.context.collection.objects.link(wh); wh.parent = root
for ob in (body, glass, lights, disp): ob.parent = root
for name, x, sg in (('FL', WHEELS[0], 1), ('FR', WHEELS[0], -1), ('RL', WHEELS[1], 1), ('RR', WHEELS[1], -1)):
    w = bpy.data.objects.new(name, wheel_me); bpy.context.collection.objects.link(w); w.parent = wh
    w.location = (x, sg * WY, WR); w.rotation_euler = (0, 0, 0 if sg > 0 else math.pi)

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'bus-original-poc.glb'
bpy.ops.wm.save_as_mainfile(filepath=out.replace('.glb', '.blend'))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True)
ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
tri = lambda me: sum(len(p.vertices) - 2 for p in me.polygons)
uniq = {o.data.name: o.data for o in ms}
print('HULL non-manifold edges', HULL_NONMANIFOLD)
print('BUILD tris(unique)', sum(tri(m) for m in uniq.values()), 'tris(instanced)', sum(tri(o.data) for o in ms), 'verts(unique)', sum(len(m.vertices) for m in uniq.values()), 'meshes', len(uniq), 'materials', len(bpy.data.materials))
for o in ms: print(' ', o.name, o.data.name, tri(o.data))
