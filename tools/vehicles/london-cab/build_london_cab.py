"""Original procedural LEVC TX study. Blender +X nose, +Z up, UK right=-Y.
Run: blender -b --factory-startup -P build_london_cab.py -- output.glb
Six static, single-material semantic meshes; dimensions in metres, ground origin.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
NAMES = ('CabBody', 'CabGlass', 'CabRubber', 'CabTrim', 'CabInterior', 'CabLights')
PARTS = {n: [] for n in NAMES}
MATERIALS = {}
for name, color, rough, metal in (
    ('CabBody', (.008, .009, .011, 1), .29, .12),
    ('CabGlass', (.055, .085, .10, 1), .12, .05),
    ('CabRubber', (.015, .018, .021, 1), .8, 0),
    ('CabTrim', (.53, .57, .61, 1), .23, .8),
    ('CabInterior', (.075, .081, .088, 1), .85, 0),
    ('CabLights', (1, 1, 1, 1), .22, 0)):
    m = bpy.data.materials.new(name); m.use_nodes = True; m.use_backface_culling = True
    p = m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value = color
    p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metal
    if name == 'CabGlass':
        p.inputs['Alpha'].default_value = .32
        m.surface_render_method = 'DITHERED'
    if name == 'CabLights':
        a = m.node_tree.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Color'
        m.node_tree.links.new(a.outputs['Color'], p.inputs['Base Color'])
        p.inputs['Emission Strength'].default_value = 0
    MATERIALS[name] = m


def activate(ob):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply(ob, mod):
    activate(ob); bpy.ops.object.modifier_apply(modifier=mod.name)


def part(ob, name, color=(1, 1, 1, 1), smooth=False):
    ob.data.materials.clear(); ob.data.materials.append(MATERIALS[name])
    c = ob.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for v in c.data: v.color = color
    for p in ob.data.polygons: p.use_smooth = smooth
    PARTS[name].append(ob)
    return ob


def mesh(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(me); bm.free()
    return ob


def box(name, c, s, bevel=0, color=(1, 1, 1, 1)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c); ob = bpy.context.object; ob.scale = s
    activate(ob); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        m = ob.modifiers.new('rounded edges', 'BEVEL'); m.width = bevel; m.segments = 1
        apply(ob, m)
    return part(ob, name, color)


def cyl(name, c, r, depth, axis=(0, 1, 0), seg=24, color=(1, 1, 1, 1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, end_fill_type='NGON', location=c)
    ob = bpy.context.object; ob.rotation_euler = Vector(axis).to_track_quat('Z', 'Y').to_euler()
    activate(ob); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return part(ob, name, color, True) if name else ob


def torus(name, c, major, minor, axis=(0, 1, 0), seg=24, sides=5):
    bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=sides, location=c, major_radius=major, minor_radius=minor)
    ob = bpy.context.object; ob.rotation_euler = Vector(axis).to_track_quat('Z', 'Y').to_euler()
    activate(ob); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return part(ob, name, smooth=True)


def difference(ob, cutter):
    m = ob.modifiers.new('real opening', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.solver = 'EXACT'; m.object = cutter
    apply(ob, m); bpy.data.objects.remove(cutter, do_unlink=True)


def rounded(poly, radius=.035, steps=2):
    """Convex polygon corners, identical vertices for opening and recessed pane."""
    out = []
    for i, v in enumerate(poly):
        p, q, r = Vector(poly[i-1]), Vector(v), Vector(poly[(i+1) % len(poly)])
        a = q + (p-q).normalized() * min(radius, (p-q).length/3)
        b = q + (r-q).normalized() * min(radius, (r-q).length/3)
        for j in range(steps+1):
            t = j/steps; out.append(tuple((1-t)**2*a+2*(1-t)*t*q+t*t*b))
    return out


def prism(poly, mapping, depth=.025):
    verts = [mapping(a, b, d) for d in (-depth/2, depth/2) for a, b in poly]; n = len(poly)
    faces = [tuple(range(n-1,-1,-1)), tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh('pane or opening', verts, faces)


def strip(name, pts, width=.009):
    """Closed four-sided tube; shared rings keep narrow chrome/seams inexpensive."""
    points=[Vector(p) for p in pts]; closed=(points[0]-points[-1]).length<1e-7
    if closed: points.pop()
    verts=[]; n=len(points)
    for i,p in enumerate(points):
        tangent=(points[(i+1)%n]-points[(i-1)%n]) if closed else (points[min(i+1,n-1)]-points[max(0,i-1)])
        tangent.normalize(); u=tangent.cross(Vector((0,0,1)))
        if u.length<.01: u=tangent.cross(Vector((0,1,0)))
        u.normalize(); v=tangent.cross(u).normalized()
        for k in range(4):
            a=math.pi/4+k*math.pi/2; verts.append(p+width*(u*math.cos(a)+v*math.sin(a)))
    faces=[]
    for i in range(n if closed else n-1):
        j=(i+1)%n
        for k in range(4): faces.append((i*4+k,i*4+(k+1)%4,j*4+(k+1)%4,j*4+k))
    if not closed: faces.extend([(3,2,1,0),tuple((n-1)*4+k for k in range(4))])
    part(mesh('continuous trim',verts,faces),name)


# Lower body: loft with a rounded rectangular cross-section. The arches are actual
# side recesses, boolean-cut to an inner wall; no dark discs pasted on a box.
ST = [(-2.4285,.66,.88),(-2.39,.81,1.02),(-2.25,.91,1.07),(-2.05,.937,1.09),
      (-1.7,.937,1.10),(-1.2,.937,1.10),(-.5,.937,1.10),(0,.937,1.10),
      (.7,.937,1.10),(1.02,.937,1.10),(1.3,.937,1.08),(1.65,.927,1.04),
      (1.98,.90,1.00),(2.25,.86,.96),(2.40,.79,.90),(2.4285,.69,.83)]
verts=[]; nr=16
for x,w,t in ST:
    # bottom, round lower corners, broad upright walls, rounded shoulders, crown
    yz=[(0,.17),(.75*w,.17),(.94*w,.23),(w,.36),(w,t-.12),(.98*w,t-.045),(.88*w,t-.006),(.55*w,t+.015),(0,t+.025)]
    yz += [(-y,z) for y,z in yz[-2:0:-1]]
    verts.extend((x,y,z) for y,z in yz)
faces=[]
for i in range(len(ST)-1):
    for j in range(nr): faces.append((i*nr+j,i*nr+(j+1)%nr,(i+1)*nr+(j+1)%nr,(i+1)*nr+j))
faces += [tuple(range(nr-1,-1,-1)), tuple((len(ST)-1)*nr+j for j in range(nr))]
body=mesh('lower closed body with wheel recesses',verts,faces)
for x in (-1.493,1.493):
    for side in (-1,1):
        difference(body,cyl(None,(x,side*.93,.35),.395,.62,seg=24))
# Cabin is hollow through its top opening into the belt. Boolean windows expose
# a separate closed interior wall, rather than relying on double-sided material.
cutter=box('CabInterior',(-.66,0,1.12),(3.18,1.50,.48))
PARTS['CabInterior'].remove(cutter); difference(body,cutter)
part(body,'CabBody',smooth=True)


def cabin_ring(z,xr,xf,w,r=.13):
    pts=[]
    for cx,cy,a0 in ((xf-r,w-r,0),(xr+r,w-r,90),(xr+r,-w+r,180),(xf-r,-w+r,270)):
        for k in range(4):
            a=math.radians(a0+90*k/3); pts.append((cx+r*math.cos(a),cy+r*math.sin(a),z))
    return pts


def cabin_loft(rows):
    v=[p for row in rows for p in cabin_ring(*row)]; n=16
    f=[tuple(range(n-1,-1,-1)),tuple((len(rows)-1)*n+j for j in range(n))]
    for i in range(len(rows)-1):
        f.extend((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j) for j in range(n))
    return mesh('rounded tall cabin',v,f)

ROWS=[(1.015,-2.23,1.04,.88),(1.12,-2.22,.98,.882),(1.59,-2.00,.61,.803),
      (1.70,-1.87,.47,.76),(1.77,-1.68,.34,.66),(1.80,-1.48,.17,.48)]
cabin=cabin_loft(ROWS)
inner=cabin_loft([(.98,-2.18,.97,.82),(1.13,-2.15,.90,.82),(1.58,-1.92,.53,.743),(1.69,-1.78,.38,.69),(1.72,-1.60,.24,.59)])
difference(cabin,inner)
side_y=lambda z: .882-(z-1.12)*.168
WINDOWS=[rounded([(-2.10,1.15),(-1.40,1.15),(-1.40,1.61),(-1.85,1.61),(-2.03,1.45)],.06),
         rounded([(-1.29,1.15),(-.28,1.15),(-.28,1.64),(-1.29,1.64)],.045),
         rounded([(-.16,1.15),(.82,1.15),(.48,1.61),(-.16,1.64)],.05)]
for poly in WINDOWS:
    difference(cabin,prism(poly,lambda x,z,d:(x,d,z),2.4))
    for side in (-1,1):
        pane=prism(poly,lambda x,z,d,side=side:(x,side*(side_y(z)-.012)+d,z),.018)
        part(pane,'CabGlass')
        # Thin chrome window surround below the body pillars.
        strip('CabTrim',[(x,side*(side_y(z)+.002),z) for x,z in poly+[poly[0]]],.009)
# Windscreen is one broad opening with generous body-colored A-pillars.
front_x=lambda z: .98-(z-1.12)*(.37/.47)
rear_x=lambda z: -2.22+(z-1.12)*(.22/.47)
for func,sg,zmax in ((front_x,1,1.61),(rear_x,-1,1.57)):
    poly=rounded([(-.71,1.16),(.71,1.16),(.64,zmax),(-.64,zmax)],.045)
    center=1.0 if sg==1 else -2.12
    difference(cabin,prism(poly,lambda y,z,d:(center+d,y,z),.95))
    part(prism(poly,lambda y,z,d:(func(z)-sg*.015+d,y,z),.018),'CabGlass')
    strip('CabRubber',[(func(z)+sg*.003,y,z) for y,z in poly+[poly[0]]],.012)
part(cabin,'CabBody',smooth=True)

# Solid wheel cross-sections and hubcaps, merged by semantic material; no wheel nodes.
for x in (-1.493,1.493):
    for side in (-1,1):
        # Torus is closed and provides a rounded shoulder around the thin barrel.
        cyl('CabRubber',(x,side*.81,.35),.325,.226,seg=20)
        torus('CabRubber',(x,side*.81,.35),.30,.05,seg=20,sides=4)
        cyl('CabTrim',(x,side*.933,.35),.239,.017,seg=16)
        torus('CabRubber',(x,side*.944,.35),.207,.012,seg=16,sides=3)
        cyl('CabTrim',(x,side*.949,.35),.182,.022,seg=16)
        cyl('CabRubber',(x,side*.966,.35),.071,.01,seg=16)
        for k in range(6):
            a=2*math.pi*k/6
            cyl('CabRubber',(x+.215*math.cos(a),side*.945,.35+.215*math.sin(a)),.017,.008,seg=6)
        # Arch lips are shallow segmented closed rods around the actual recess.
        pts=[(x+.408*math.cos(math.pi*k/16),side*.919,.35+.408*math.sin(math.pi*k/16)) for k in range(17)]
        strip('CabBody',pts,.018)

# Opposing coach-door handles meet around the central pillar, on BOTH sides.
for side in (-1,1):
    for x in (-.39,-.08):
        box('CabRubber',(x,side*.939,.94),(.24,.018,.064),.02)
        box('CabTrim',(x,side*.958,.951),(.25,.027,.026),.01)
    for x in (-1.35,-.22,.91):
        strip('CabRubber',[(x,side*.939,.33),(x,side*.943,1.07)],.004)
    box('CabTrim',(-.20,side*.941,.28),(2.40,.018,.034),.009)
    box('CabBody',(.88,side*.981,1.16),(.25,.074,.14),.035)
    box('CabGlass',(.83,side*1.0135,1.16),(.17,.009,.09),.018)
    box('CabBody',(.88,side*.88,1.09),(.08,.19,.04),.01)
    # Side amber repeater and upright rear red light tower.
    box('CabLights',(1.10,side*.944,.91),(.075,.012,.035),.014,(1,.32,.025,1))
    # One continuous closed wraparound rear lamp, never two parallel red bars.
    housing=[(-2.427,.795),(-2.427,.855),(-2.38,.925),(-2.245,.925),(-2.245,.880),(-2.36,.880),(-2.390,.835),(-2.390,.795)]
    lens=[(-2.438,.805),(-2.438,.850),(-2.384,.936),(-2.255,.936),(-2.255,.902),(-2.365,.902),(-2.409,.835),(-2.409,.805)]
    part(prism(housing,lambda x,y,d,side=side:(x,side*y,.94+d),.34),'CabTrim')
    part(prism(lens,lambda x,y,d,side=side:(x,side*y,.94+d),.285),'CabLights',(.75,.015,.012,1))
# Reference-visible left rear-quarter fuel hatch only.
hatch=rounded([(-2.115,.90),(-1.955,.90),(-1.955,1.04),(-2.115,1.04)],.024)
strip('CabRubber',[(x,.942,z) for x,z in hatch+[hatch[0]]],.004)
# Upright radiator grille: chrome border and real repeated vertical slats.
box('CabRubber',(2.417,0,.644),(.035,.79,.66),.06)
for y in (-.40,.40): box('CabTrim',(2.443,y,.65),(.026,.035,.65),.014)
for z in (.327,.969): box('CabTrim',(2.441,0,z),(.027,.80,.035),.014)
for k in range(15): box('CabTrim',(2.440,-.351+k*.0501,.65),(.019,.011,.59))
for side in (-1,1):
    y=side*.656
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,location=(2.35,y,.868))
    pod=bpy.context.object; pod.scale=(.15,.195,.195)
    activate(pod); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); part(pod,'CabBody',smooth=True)
    cyl('CabTrim',(2.454,y,.873),.141,.045,(1,0,0),20)
    cyl('CabLights',(2.479,y,.873),.116,.014,(1,0,0),20,(1,.94,.79,1))
    cyl('CabRubber',(2.490,y,.873),.078,.012,(1,0,0),24)
    cyl('CabLights',(2.499,y,.873),.052,.009,(1,0,0),20,(.77,.86,1,1))
    cyl('CabRubber',(2.492,side*.67,.44),.079,.035,(1,0,0),20)
    cyl('CabLights',(2.516,side*.67,.44),.056,.012,(1,0,0),20,(1,.27,.015,1))
    box('CabTrim',(2.488,side*.655,.654),(.045,.37,.028),.01)
box('CabRubber',(2.394,0,.225),(.069,1.38,.10),.03)
box('CabInterior',(2.445,0,.253),(.015,.43,.085),.009)
# Rear hatch and plate, clearly independent of the front facade.
box('CabBody',(-2.441,0,.717),(.028,1.28,.57),.045)
box('CabTrim',(-2.468,0,.91),(.021,.85,.026),.01)
box('CabTrim',(-2.468,0,.706),(.021,.24,.033),.01)
box('CabLights',(-2.469,0,.531),(.012,.42,.11),.008,(1,.69,.09,1))
box('CabRubber',(-2.430,0,.279),(.051,1.54,.11),.03)
box('CabLights',(-2.111,0,1.562),(.018,.32,.022),.006,(.8,.008,.006,1))
# Roof lamp housing reaches precisely the stated total height including sign.
sign=rounded([(-.255,1.748),(.255,1.748),(.255,1.888),(-.255,1.888)],.065,5)
part(prism(sign,lambda y,z,d:(.27+d,y,z),.25),'CabBody')
sign_face=rounded([(-.204,1.7905),(.204,1.7905),(.204,1.8855),(-.204,1.8855)],.044,5)
part(prism(sign_face,lambda y,z,d:(.397+d,y,z),.018),'CabLights',(1,.43,.025,1))
# TAXI is geometry, not a raster texture or a font resource in the export.
bpy.ops.object.text_add(location=(.410,0,1.826)); tx=bpy.context.object
# Text local X -> -Y, local Y -> +Z, normal -> +X.
tx.rotation_euler=(math.pi/2,0,math.pi/2); tx.data.body='TAXI'; tx.data.align_x='CENTER'; tx.data.size=.076; tx.data.extrude=.001
activate(tx); bpy.ops.object.convert(target='MESH'); part(bpy.context.object,'CabRubber')
# UK-right steering and visible simple seats, passenger handrails.
box('CabInterior',(-.70,0,.50),(3.0,1.43,.10),.03)
box('CabInterior',(.60,0,1.065),(.48,1.40,.17),.035)
for x,y in ((.03,-.43),(.03,.43),(-1.64,-.43),(-1.64,0),(-1.64,.43)):
    box('CabInterior',(x,y,.69),(.43,.39,.14))
    box('CabInterior',(x-.19,y,1.03),(.12,.39,.61))
    box('CabInterior',(x-.19,y,1.39),(.11,.23,.17))
torus('CabInterior',(.45,-.43,1.155),.145,.016,(-.8,0,.6),16,4)
box('CabInterior',(.52,-.43,1.11),(.22,.05,.045),.01)
# Front and rear wipers are closed slim rods, not transparent planes.
for ya,yb in ((-.62,-.08),(.08,.62)):
    strip('CabRubber',[(front_x(1.19)+.025,ya,1.19),(front_x(1.225)+.025,yb,1.225)],.009)
strip('CabRubber',[(rear_x(1.20)-.025,.43,1.20),(rear_x(1.235)-.025,-.09,1.235)],.009)

# Collapse all detail into the six semantic draw-call buckets. Joining preserves
# per-corner lamp colors while white body colors allow runtime paint recoloring.
for name in NAMES:
    objects=PARTS[name]; bpy.ops.object.select_all(action='DESELECT')
    for ob in objects: ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); ob=bpy.context.object; ob.name=name; ob.data.name=name
    ob.data.materials.clear(); ob.data.materials.append(MATERIALS[name])
    for p in ob.data.polygons: p.material_index=0
    bm=bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bmesh.ops.dissolve_degenerate(bm,dist=.000001,edges=list(bm.edges))
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(ob.data); bm.free()
    activate(ob); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # Normal splits preserve crisp door, grille and window edges on the rounded body.
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
xmin=min(v.co.x for o in meshes for v in o.data.vertices); xmax=max(v.co.x for o in meshes for v in o.data.vertices)
for ob in meshes:
    for v in ob.data.vertices:
        if v.co.x>2: v.co.x=2+(v.co.x-2)*.4285/(xmax-2)
        elif v.co.x< -2: v.co.x=-2+(v.co.x+2)*.4285/(-xmin-2)
for mat in list(bpy.data.materials):
    if mat.name not in NAMES: bpy.data.materials.remove(mat)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
out=os.path.abspath(args[0] if args else os.path.join(os.path.dirname(__file__),'london-cab-original-poc.glb'))
os.makedirs(os.path.dirname(out),exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.splitext(out)[0]+'.blend')
options=dict(filepath=out,export_format='GLB',export_apply=True,export_yup=True,export_normals=True,export_texcoords=False,export_animations=False)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
if 'export_vertex_color' in props: options['export_vertex_color']='ACTIVE'
if 'export_all_vertex_colors' in props: options['export_all_vertex_colors']=True
if 'export_active_vertex_color_when_no_material' in props: options['export_active_vertex_color_when_no_material']=True
bpy.ops.export_scene.gltf(**options)
print('CAB BUILD',sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH'),'triangles')
