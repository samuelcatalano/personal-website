"""Original botanical meshes, procedural maps, neutral diagnostics and albedo impostors.

Run: blender --background --python tools/vegetation/build_botanical_trees.py
No downloaded assets, add-ons, .blend file or Python packages outside Blender.
"""
import bpy
import json
import math
import os
import random
import struct
from pathlib import Path

import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/processed/vegetation'
EVIDENCE = Path(os.environ.get('BOTANICAL_EVIDENCE', '/tmp/vegetation-realism/authoring'))
FAMILIES = ('oak', 'plane', 'birch', 'spruce', 'ipe')
CUTOFF = 0.42
# Gameplay-scale overlap: preserve every attachment/branch while filling the airy crowns.
LEAF_SCALE = {'oak':1.45, 'plane':1.40, 'birch':1.20, 'spruce':1.60, 'ipe':1.55}
TILE = 512
TAU = math.tau
UP = Vector((0, 0, 1))
OUT.mkdir(parents=True, exist_ok=True)
EVIDENCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def image_from_pixels(name, pixels, color=True):
    image = bpy.data.images.new(name, width=pixels.shape[1], height=pixels.shape[0], alpha=True)
    image.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    image.pixels.foreach_set(pixels.astype(np.float32).ravel())
    image.filepath_raw = str(EVIDENCE / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def original_maps():
    """Six original leaf/flower silhouettes; fissured, mottled and birch bark strips."""
    size = 1024
    leaves = np.zeros((size, size, 4), np.float32)
    palette = [(0.26, .40, .105), (.31, .43, .14), (.29, .43, .13),
               (.18, .31, .18), (.25, .39, .10), (.94, .66, .10)]
    for cell, base in enumerate(palette):
        col, row = cell % 3, cell // 3
        x0, x1 = col * size // 3, (col + 1) * size // 3
        y0, y1 = row * size // 2, (row + 1) * size // 2
        v, u = np.mgrid[0:1:complex(y1-y0), -1:1:complex(x1-x0)]
        t = np.clip((v - .035) / .93, 0, 1)
        envelope = np.sin(np.pi*t)
        if cell == 0:
            width = envelope**.60 * (.62 + .18*np.cos(t*12*np.pi))
        elif cell == 1:
            a = np.arctan2(t-.46, u*.64)
            radial = np.hypot(u*.64, t-.46)
            width = np.zeros_like(t)
            mask = radial < (.36 + .11*np.cos(5*a+np.pi/2))
            mask &= t > .11
        elif cell == 2:
            width = envelope**.83 * (.68 + .035*np.sin(100*t))
        elif cell == 3:
            # A 20 cm twig spray with individually separated needles, not an opaque card.
            mask = (abs(u) < .016) & (v > .025) & (v < .97)
            for j in range(13):
                h = .13 + j*.057
                for side in (-1, 1):
                    a = (u*side)/(.64*(1-.55*h))
                    d = abs(t - (h + .12*a))
                    # Needles remain separate at source resolution and retain mid-view MASK coverage.
                    mask |= (a > 0) & (a < 1) & (d < .025*(1-.25*a))
        elif cell == 4:
            width = envelope**.85 * .66
        else:
            a = np.arctan2(t-.50, u*.5)
            radial = np.hypot(u*.5, t-.50)
            mask = radial < (.29 + .065*np.cos(5*a))
        if cell not in (1, 3, 5):
            mask = (abs(u) < width) & (v > .04) & (v < .966)
        if cell in (0,1,2,4):
            mask |= (abs(u)<.018) & (v>.025) & (v<.20)
        midrib = np.exp(-abs(u)*160)
        vein_phase = abs(u)*.40 - t*7
        veins = np.exp(-np.sin(vein_phase*np.pi)**2*160) * (.5+.5*envelope)
        grain = np.sin(u*321+t*271)*np.sin(u*137-t*331)
        relief = .90 + .12*envelope + .10*midrib + .045*veins + .035*grain
        for c in range(3):
            leaves[y0:y1, x0:x1, c] = np.clip(base[c]*relief, 0, 1)
        if cell == 5:
            throat = np.exp(-((u*.5)**2+(t-.5)**2)/.007)
            leaves[y0:y1, x0:x1, 0] *= 1-.22*throat
            leaves[y0:y1, x0:x1, 1] *= 1-.5*throat
        leaves[y0:y1, x0:x1, 3] = mask.astype(float)
    leaf_image = image_from_pixels('botanical-leaf-albedo', leaves)

    h, w = 1024, 1024
    v, u = np.mgrid[0:1:complex(h), 0:1:complex(w)]
    bark = np.ones((h, w, 4), np.float32)
    height = np.zeros((h, w), np.float32)
    for i in range(5):
        x0, x1 = i*w//5, (i+1)*w//5
        x, y = u[:, x0:x1]*5-i, v[:, x0:x1]
        warp = x + .025*np.sin(y*27+x*11) + .012*np.sin(y*95+x*30)
        furrow = (np.sin(warp*TAU*14)+.35*np.sin(warp*TAU*31+y*5))
        coarse = np.sin(x*34+y*18)*np.sin(x*17-y*29)
        fine = np.sin(x*641+y*379)*np.sin(x*317-y*491)
        if i == 2:
            fleck = np.sin(x*57+y*137)+np.sin(x*27-y*211)
            dark = (fleck > 1.20) * (.35+.65*np.sin(y*117)**2)
            rgb = np.stack([.77-.51*dark, .765-.53*dark, .70-.49*dark], -1)
            value = .015*fine-.04*dark
        elif i == 1:
            patch = np.sin(x*18+y*11)+np.sin(x*31-y*19)+.4*coarse
            rgb = np.stack([.42+.085*patch, .40+.08*patch, .31+.055*patch], -1)
            value = .025*furrow+.018*fine
        else:
            base = [(0.30, .255, .19), None, None, (.31, .25, .19), (.35, .285, .20)][i]
            fissure = np.clip(-furrow-.28, 0, 1)
            value = .035*coarse+.025*fine-.12*fissure
            rgb = np.zeros((h, x1-x0, 3))+base
        bark[:, x0:x1, :3] = np.clip(rgb+value[:, :, None], .035, .94)
        height[:, x0:x1] = value
    bark_image = image_from_pixels('botanical-bark-albedo', bark)
    # Half-resolution normal detail is sufficient on centimetric fissures.
    dy, dx = np.gradient(height[::2, ::2])
    normal = np.stack([-dx*4, -dy*4, np.ones_like(dx)*.1], -1)
    normal /= np.linalg.norm(normal, axis=-1)[:, :, None]
    normals = np.ones((h//2,w//2,4),np.float32)
    normals[:, :, :3] = normal*.5+.5
    return leaf_image, bark_image, image_from_pixels('botanical-bark-normal', normals, False)


def material(name, image, normal=None, leaves=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (.28, .40, .13, 1) if leaves else (.32, .28, .21, 1)
    mat.use_backface_culling = False
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .87 if leaves else .94
    bsdf.inputs['Metallic'].default_value = 0
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = image
    mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    # glTF multiplies COLOR_0 with the base map without an extra material node.
    if leaves:
        mat.surface_render_method = 'DITHERED'
        mat.node_tree.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        mat.alpha_threshold = CUTOFF
    if normal:
        node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = normal
        bump = mat.node_tree.nodes.new('ShaderNodeNormalMap')
        bump.inputs['Strength'].default_value = .48
        mat.node_tree.links.new(node.outputs['Color'], bump.inputs['Color'])
        mat.node_tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


class Geometry:
    def __init__(self):
        self.vertices, self.faces, self.uvs, self.colors, self.mats = [], [], [], [], []

    def add(self, points, faces, uv, color, mat):
        offset = len(self.vertices)
        self.vertices.extend(points)
        self.faces.extend(tuple(offset+i for i in face) for face in faces)
        self.uvs.extend(uv)
        self.colors.extend([color]*len(points))
        self.mats.extend([mat]*len(faces))

    def branch(self, points, radius, family, lod, rng):
        sides = (9 if radius > .018 else 6 if radius > .004 else 3 if radius < .0012 else 4) if lod == 0 else (6 if radius > .018 else 4 if radius > .004 else 3)
        if lod==1 and radius<.003 and len(points)>3:
            points=[points[0],sample(points,.5),points[-1]]
        vertices, uv = [], []
        for j, point in enumerate(points):
            t = j/(len(points)-1)
            tangent = (points[min(j+1, len(points)-1)]-points[max(0, j-1)]).normalized()
            axis = tangent.cross(Vector((0, 1, .05))).normalized()
            other = tangent.cross(axis).normalized()
            rad = radius*(1-.91*t)**.9
            if point.z < .035:
                rad *= 1+.36*(1-point.z/.035)
            for k in range(sides):
                theta = TAU*k/sides
                ridge = 1+.105*math.sin(theta*5+j*.7)+.04*math.sin(theta*9-j)
                vertices.append(point+(axis*math.cos(theta)+other*math.sin(theta))*rad*ridge)
                # Birch's fine twigs are dark; its white exfoliating bark is on older wood.
                bark_family=0 if family==2 and radius<.003 else family
                uv.append(((bark_family+(k/sides)*.96+.02)/5, (point.z*4+t*.5)%1))
        faces = []
        for j in range(len(points)-1):
            for k in range(sides):
                a=j*sides+k; b=j*sides+(k+1)%sides
                faces.extend(((a, b, b+sides), (a, b+sides, a+sides)))
        faces.append(tuple(range(sides-1, -1, -1)))
        end=(len(points)-1)*sides
        faces.append(tuple(end+k for k in range(sides)))
        shade = rng.uniform(.64, .90) if radius<.003 else rng.uniform(.78, 1)
        self.add(vertices, faces, uv, (shade, shade*.985, shade*.96, 1), 0)
        if family==2:
            # Basal fissuring/grime grades into pale older bark without a hard painted band.
            self.colors[-len(vertices):]=[(shade*f,shade*.985*f,shade*.96*f,1)
                for p in vertices for f in [min(1,.36+max(0,p.z)*6.4)]]

    def leaf(self, origin, direction, length, cell, rng, lod):
        direction = direction.normalized()
        side = direction.cross(Vector((rng.uniform(-.6,.6), rng.uniform(-.6,.6), 1))).normalized()
        normal = side.cross(direction).normalized()
        width = length*(.46 if cell == 3 else .60 if cell == 2 else .76 if cell == 1 else .57)
        rows = (0, .52, 1) if lod == 0 else (0, 1)
        points, uv = [], []
        for t in rows:
            bend = (math.sin(t*math.pi)*.11-t*t*.13)*length
            for sign in (-1, 1):
                points.append(origin+direction*(t*length)+side*(sign*width*.5)+normal*bend)
                uv.append(((cell%3+(.035 if sign < 0 else .965))/3, (cell//3+.035+t*.93)/2))
        faces = []
        for j in range(len(rows)-1):
            a=j*2
            faces.extend(((a, a+1, a+3), (a, a+3, a+2)))
        radius=math.hypot(origin.x,origin.y)
        exposure=max(min(1,radius/(.33 if cell==0 else .26)), min(1,max(0,(origin.z-.68)/.32)))
        shade = rng.uniform(.86, 1)*(.68+.32*exposure)
        tint = rng.uniform(-.045, .045)
        self.add(points, faces, uv, (min(1,shade*(1+tint)), shade, min(1,shade*(1-tint)), 1), 1)

    def object(self, name, materials):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.clear()
        for mat in materials:
            mesh.materials.append(mat)
        uv = mesh.uv_layers.new(name='UVMap')
        colors = mesh.color_attributes.new(name='Color', type='BYTE_COLOR', domain='POINT')
        colors.data.foreach_set('color', np.array(self.colors, np.float32).ravel())
        for poly, mat in zip(mesh.polygons, self.mats):
            poly.material_index = mat
            poly.use_smooth = True
            for loop in poly.loop_indices:
                uv.data[loop].uv = self.uvs[mesh.loops[loop].vertex_index]
        mesh.update()
        assert len(mesh.vertices) > 1000 and len(mesh.materials) == 2
        assert all(math.isfinite(c) for v in mesh.vertices for c in v.co)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj


def curved(start, end, bow, n=5):
    return [start.lerp(end, i/(n-1))+bow*math.sin(math.pi*i/(n-1)) for i in range(n)]


def sample(points, t):
    t=max(0, min(.999999, t))*(len(points)-1)
    i=int(t)
    return points[i].lerp(points[i+1], t-i)


def author(family, lod, materials):
    """The seed/branch/leaf decisions are identical between LODs; only tessellation differs."""
    idx=FAMILIES.index(family)
    rng=random.Random(20261114+idx*137)
    geom=Geometry()
    branch_records=[]
    leaf_records=[]

    def branch(points, radius):
        branch_records.append((points, radius))

    def leaf(origin, direction, size, cell=idx):
        if cell!=5:
            size*=LEAF_SCALE[family]
        leaf_records.append((origin, direction, size, cell, rng.randrange(2**30)))

    def leafy_twig(start, end, count, size, droop=0):
        points=curved(start, end, Vector((0, 0, .014-droop)), 4)
        branch(points, .00050 if family != 'spruce' else .00085)
        axis=(end-start).normalized()
        across=axis.cross(UP).normalized()
        for j in range(count):
            t=.18+.8*j/count
            origin=sample(points,t)
            sign=1 if j%2 else -1
            out=(axis*.20+across*sign*rng.uniform(.65,1)+UP*rng.uniform(-.50,.72)).normalized()
            leaf(origin,out,size*rng.uniform(.78,1.2))
        if family == 'ipe' and rng.random()<.13:
            for _ in range(rng.randint(3,6)):
                d=Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(.1,1)))
                leaf(end+d*.006,d,.016*rng.uniform(.8,1.2),5)

    trunk=[Vector((.012*math.sin(t*5), .008*math.sin(t*4), t)) for t in (0,.035,.13,.28,.45,.63,.79,.94)]
    trunk_radius=.028 if family in ('oak','plane') else .020 if family=='ipe' else .015
    branch(trunk,trunk_radius)
    for j in range(7):
        a=j*TAU/7+rng.uniform(-.18,.18)
        root=Vector((math.cos(a),math.sin(a),0))
        branch(curved(Vector((0,0,.016)),root*.038,root*.002,4),trunk_radius*.48)

    if family == 'spruce':
        for tier in range(17):
            h=.20+tier*.046+rng.uniform(-.021,.021)
            length=(1-h)**.86*.40
            number=rng.choice((3,4,5)) if tier<13 else 3
            for j in range(number):
                angle=tier*2.399+j*TAU/number+rng.uniform(-.22,.22)
                radial=Vector((math.cos(angle),math.sin(angle),0))
                start=sample(trunk,h/.94)
                end=start+radial*length*rng.uniform(.71,1.15)+UP*rng.uniform(-.045,.04)
                main=curved(start,end,UP*rng.uniform(-.04,.005),5)
                branch(main,.008*(1-h)+.0018)
                lateral=Vector((-radial.y,radial.x,0))
                for k in range(7):
                    t=.23+k*.105
                    for sign in (-1,1):
                        s=sample(main,t)
                        e=s+(radial*.38+lateral*sign*.85)*length*(1-t)*.72+UP*rng.uniform(-.036,.035)
                        leafy_twig(s,e,9,.043*(1-h*.43))
    else:
        major_count={'oak':15,'plane':17,'birch':17,'ipe':14}[family]
        crown_width={'oak':.39,'plane':.31,'birch':.25,'ipe':.34}[family]
        for j in range(major_count):
            fraction=j/(major_count-1)
            h=rng.uniform(.34,.49) if fraction<.72 else rng.uniform(.43,.62)
            angle=j*2.399+rng.uniform(-.29,.29)
            radial=Vector((math.cos(angle),math.sin(angle),0))
            across=Vector((-radial.y,radial.x,0))
            if fraction<.28:
                end_height=rng.uniform(.49,.64)
                width=crown_width*rng.uniform(.88,1.16)
            elif fraction<.72:
                end_height=rng.uniform(.64,.85)
                width=crown_width*rng.uniform(.68,1.03)
            else:
                end_height=rng.uniform(.87,.99)
                width=crown_width*rng.uniform(.16,.50)
            if family=='plane':
                end_height+=.035
            start=sample(trunk,h/.94)
            end=start+radial*width
            end.z=end_height
            # Oak scaffolds rise out of the fork, turn laterally, and sometimes dip at tips.
            rise=end.z-start.z
            bend=across*rng.uniform(-.065,.065)
            main=[start,
                  start+radial*width*.16+UP*(rise*.35+.025),
                  start+radial*width*.39+UP*(rise*.67+.035)+bend*.65,
                  start+radial*width*.64+UP*(rise*.83+.022)+bend,
                  start+radial*width*.83+UP*(rise+.015)+bend*.45,end]
            branch(main,trunk_radius*rng.uniform(.30,.52)*(1-h*.6))
            for k in range(7):
                t=.14+k*.13+rng.uniform(-.025,.025)
                s=sample(main,t)
                sign=1 if k%2 else -1
                d=(radial*.5+across*sign*rng.uniform(.5,.95)+UP*rng.uniform(-.4,.5)).normalized()
                sec_len=rng.uniform(.095,.16)*(1-.3*h)
                sec=curved(s,s+d*sec_len,UP*.017,4)
                branch(sec,.0028*(1-h*.45))
                for m in range(3):
                    s2=sample(sec,.22+m*.36)
                    side=1 if m%2 else -1
                    d2=(d*.56+across*side*.50+UP*rng.uniform(-.35,.45)).normalized()
                    if family=='birch':
                        d2.z-=.5
                    tert=curved(s2,s2+d2*rng.uniform(.06,.095),UP*.011,4)
                    branch(tert,.00085)
                    for n in range(2):
                        s3=sample(tert,.45+n*.48)
                        direction=(d2*.6+across*rng.uniform(-.8,.8)+UP*rng.uniform(-.2,.5)).normalized()
                        if family=='birch':
                            direction.z-=.50
                        end3=s3+direction*rng.uniform(.045,.075)
                        leafy_twig(s3,end3,15 if family != 'birch' else 14,
                                   {'oak':.026,'plane':.031,'birch':.021,'ipe':.028}[family],
                                   .018 if family=='birch' else 0)

    # Identical RNG consumption/topology seeds: LOD1 changes rings and leaf bending only.
    for i,(points,radius) in enumerate(branch_records):
        geom.branch(points,radius,idx,lod,random.Random(i+idx*10000))
    for origin,direction,size,cell,seed in leaf_records:
        geom.leaf(origin,direction,size,cell,random.Random(seed),lod)
    obj=geom.object(f'botanical-{family}-LOD{lod}',materials)
    for vertex in obj.data.vertices:
        vertex.co.z=max(0,vertex.co.z)
    return obj, {'branchPaths':len(branch_records),'leafSurfaces':len(leaf_records)}


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


leaf_image,bark_image,bark_normal=original_maps()
materials=[material('botanical-bark',bark_image,bark_normal),material('botanical-leaves',leaf_image,leaves=True)]
objects={}
rows=[]
for family in FAMILIES:
    pair=[]
    for lod in (0,1):
        obj,counts=author(family,lod,materials)
        pair.append(obj)
    # Both LODs share one exact coordinate normalization.
    coords=np.array([v.co[:] for v in pair[0].data.vertices])
    low,high=coords.min(axis=0),coords.max(axis=0)
    center=Vector(((low[0]+high[0])/2,(low[1]+high[1])/2,low[2]))
    scale=1/(high[2]-low[2])
    for obj in pair:
        for vertex in obj.data.vertices:
            vertex.co=(vertex.co-center)*scale
            # Ground-contact roots use different ring counts but share the exact foot plane.
            if vertex.co.z < .001:
                vertex.co.z = 0
        obj.data.update()
    radius=max(math.hypot(v.co.x,v.co.y) for v in pair[0].data.vertices)
    bounds=[[min(v.co[k] for v in pair[0].data.vertices) for k in range(3)],
            [max(v.co[k] for v in pair[0].data.vertices) for k in range(3)]]
    assert abs(bounds[0][2])<1e-6 and abs(bounds[1][2]-1)<1e-6
    assert radius>.1 and radius<.9
    row={'family':family,'triangles':[triangles(o) for o in pair],
         'vertices':[len(o.data.vertices) for o in pair], 'radius':radius,
         'fit':max(1,2*radius)*1.16,'sourceBoundsZUp':bounds,
         'foliageScale':LEAF_SCALE[family],**counts}
    rows.append(row)
    objects[family]=pair
    print('BOTANICAL_GEOMETRY',json.dumps(row),flush=True)

# Export before replacing render materials with diagnostic/unlit equivalents.
bpy.ops.object.select_all(action='DESELECT')
for pair in objects.values():
    for obj in pair:
        obj.select_set(True)
raw=EVIDENCE/'botanical-trees.raw.glb'
bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,
                          export_yup=True,export_apply=True,export_materials='EXPORT',
                          export_vertex_color='ACTIVE',export_normals=True,export_texcoords=True)

# Blender 5 uses dithered alpha in the editor; the runtime contract is hard MASK.
data=raw.read_bytes()
magic,version,total=struct.unpack_from('<III',data)
assert magic==0x46546c67 and version==2 and total==len(data)
json_size,json_type=struct.unpack_from('<II',data,12)
doc=json.loads(data[20:20+json_size])
for mat in doc['materials']:
    if 'leaves' in mat['name']:
        mat.update(alphaMode='MASK',alphaCutoff=CUTOFF,doubleSided=True)
    assert mat.get('pbrMetallicRoughness',{}).get('metallicFactor',1)==0
json_bytes=json.dumps(doc,separators=(',',':')).encode()
json_bytes+=b' '*((-len(json_bytes))%4)
binary_chunks=data[20+json_size:]
raw.write_bytes(struct.pack('<III',magic,version,20+len(json_bytes)+len(binary_chunks))+
                struct.pack('<II',len(json_bytes),json_type)+json_bytes+binary_chunks)
del data,doc

# Read-back actual glTF POSITION/NORMAL/indices, including mesh-node transforms.
data=raw.read_bytes()
json_size=struct.unpack_from('<I',data,12)[0]
doc=json.loads(data[20:20+json_size])
binary=memoryview(data)[28+json_size:]
readback=[]
for mesh in doc['meshes']:
    count=0
    mesh_positions=[]
    for primitive in mesh['primitives']:
        assert primitive.get('mode',4)==4
        count+=doc['accessors'][primitive['indices']]['count']//3
        for semantic in ('POSITION','NORMAL'):
            accessor=doc['accessors'][primitive['attributes'][semantic]]
            view=doc['bufferViews'][accessor['bufferView']]
            offset=view.get('byteOffset',0)+accessor.get('byteOffset',0)
            array=np.frombuffer(binary,dtype='<f4',count=accessor['count']*3,offset=offset).reshape(-1,3)
            assert np.isfinite(array).all(),(mesh['name'],semantic)
            if semantic=='NORMAL':
                assert np.max(abs(np.linalg.norm(array,axis=1)-1))<.001
            else:
                mesh_positions.append(array)
    positions=np.concatenate(mesh_positions)
    assert abs(positions[:,1].min())<1e-5 and abs(positions[:,1].max()-1)<1e-5
    expected=next(r['triangles'][int(mesh['name'][-1])] for r in rows if r['family'] in mesh['name'])
    assert count==expected,(mesh['name'],count,expected)
    readback.append({'mesh':mesh['name'],'triangles':count,'materials':len(mesh['primitives']),
                     'boundsYUp':[positions.min(axis=0).tolist(),positions.max(axis=0).tolist()],
                     'radius':float(np.hypot(positions[:,0],positions[:,2]).max())})
assert len(readback)==10
(OUT/'botanical-trees.glb').write_bytes(raw.read_bytes())
print('BOTANICAL_READBACK',json.dumps(readback),flush=True)

# Blender source materials do not automatically multiply COLOR_0, while glTF does.
# Make the diagnostics display the very same map × authored vertex colour.
for mat in materials:
    nodes=mat.node_tree.nodes
    bsdf=nodes.get('Principled BSDF')
    tex=next(n for n in nodes if n.type=='TEX_IMAGE' and n.image in (leaf_image,bark_image))
    vertex=nodes.new('ShaderNodeVertexColor')
    vertex.layer_name='Color'
    multiply=nodes.new('ShaderNodeMixRGB')
    multiply.blend_type='MULTIPLY'
    multiply.inputs[0].default_value=1
    mat.node_tree.links.new(tex.outputs['Color'],multiply.inputs[1])
    mat.node_tree.links.new(vertex.outputs['Color'],multiply.inputs[2])
    mat.node_tree.links.new(multiply.outputs[0],bsdf.inputs['Base Color'])
    if 'leaves' in mat.name:
        clip=nodes.new('ShaderNodeMath')
        clip.operation='GREATER_THAN'
        clip.inputs[1].default_value=CUTOFF
        mat.node_tree.links.new(tex.outputs['Alpha'],clip.inputs[0])
        mat.node_tree.links.new(clip.outputs[0],bsdf.inputs['Alpha'])

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=TILE
scene.render.resolution_y=TILE
scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'
scene.world=scene.world or bpy.data.worlds.new('Botanical neutral world')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(1,1,1,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
bpy.ops.object.camera_add()
camera=bpy.context.object
camera.data.type='ORTHO'
scene.camera=camera
bpy.ops.object.light_add(type='SUN', location=(2,-3,4))
sun=bpy.context.object
sun.rotation_euler=(math.radians(25),math.radians(-25),math.radians(-35))
sun.data.energy=1.4
sun.data.angle=math.radians(16)
bpy.ops.object.light_add(type='AREA',location=(-2,-2,2))
fill=bpy.context.object
fill.data.energy=25
fill.data.shape='DISK'
fill.data.size=4
fill.rotation_euler=(Vector((0,0,.5))-fill.location).to_track_quat('-Z','Y').to_euler()


def set_camera(fit,angle,elevation=0):
    center=Vector((0,0,fit/2))
    camera.location=center+Vector((math.sin(angle)*3,-math.cos(angle)*3,elevation))
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=fit


def isolate(obj):
    for pair in objects.values():
        for other in pair:
            other.hide_render=other!=obj


for family,row in zip(FAMILIES,rows):
    for lod in (0,1):
        isolate(objects[family][lod])
        for label,angle in [('front',0),('opposite',math.pi),('threequarter',math.pi*.25),('elevated',math.pi*.25)]:
            if lod==1 and label!='front':
                continue
            set_camera(row['fit'],angle,2.8 if label=='elevated' else .13 if label=='threequarter' else 0)
            scene.render.filepath=str(EVIDENCE/f'{family}-LOD{lod}-{label}.png')
            bpy.ops.render.render(write_still=True)
    isolate(objects[family][0])
    set_camera(.32,math.pi*.25,.08)
    camera.location.z+=.52
    scene.render.filepath=str(EVIDENCE/f'{family}-detail.png')
    bpy.ops.render.render(write_still=True)

# Impostors use base albedo × vertex shade only, no light, specular or AO baked in.
unlit=[]
for old in materials:
    mat=bpy.data.materials.new(old.name+'-unlit-atlas')
    mat.use_nodes=True
    nodes=mat.node_tree.nodes
    nodes.clear()
    output=nodes.new('ShaderNodeOutputMaterial')
    emission=nodes.new('ShaderNodeEmission')
    tex=nodes.new('ShaderNodeTexImage')
    tex.image=leaf_image if 'leaves' in old.name else bark_image
    color=nodes.new('ShaderNodeVertexColor')
    color.layer_name='Color'
    mult=nodes.new('ShaderNodeMixRGB')
    mult.blend_type='MULTIPLY'
    mult.inputs[0].default_value=1
    mat.node_tree.links.new(tex.outputs['Color'],mult.inputs[1])
    mat.node_tree.links.new(color.outputs['Color'],mult.inputs[2])
    mat.node_tree.links.new(mult.outputs[0],emission.inputs['Color'])
    if 'leaves' in old.name:
        clip=nodes.new('ShaderNodeMath')
        clip.operation='GREATER_THAN'
        clip.inputs[1].default_value=CUTOFF
        mat.node_tree.links.new(tex.outputs['Alpha'],clip.inputs[0])
        transparent=nodes.new('ShaderNodeBsdfTransparent')
        mix=nodes.new('ShaderNodeMixShader')
        mat.node_tree.links.new(clip.outputs[0],mix.inputs[0])
        mat.node_tree.links.new(transparent.outputs[0],mix.inputs[1])
        mat.node_tree.links.new(emission.outputs[0],mix.inputs[2])
        mat.node_tree.links.new(mix.outputs[0],output.inputs['Surface'])
        mat.surface_render_method='DITHERED'
    else:
        mat.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
    unlit.append(mat)
for pair in objects.values():
    for obj in pair:
        for i,mat in enumerate(unlit):
            obj.data.materials[i]=mat
atlas=np.zeros((TILE,TILE*5,4),np.float32)
for i,(family,row) in enumerate(zip(FAMILIES,rows)):
    isolate(objects[family][0])
    set_camera(row['fit'],0)
    path=EVIDENCE/f'{family}-albedo.png'
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    tile=bpy.data.images.load(str(path),check_existing=False)
    pixels=np.empty(TILE*TILE*4,np.float32)
    tile.pixels.foreach_get(pixels)
    pixels=pixels.reshape(TILE,TILE,4)
    assert pixels[:,:,3].max()>.99 and (pixels[:,:,3]==0).mean()>.40
    assert not np.any(pixels[:,0,3]>.01) and not np.any(pixels[:,-1,3]>.01)
    atlas[:,i*TILE:(i+1)*TILE]=pixels
image=image_from_pixels('botanical-impostors',atlas)
image.filepath_raw=str(OUT/'botanical-impostors.png')
image.save()


def read_render(path):
    image=bpy.data.images.load(str(path),check_existing=False)
    pixels=np.empty(TILE*TILE*4,np.float32)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)
    return pixels.reshape(TILE,TILE,4)


sheet=np.ones((TILE*2,TILE//2*5,4),np.float32)
comparisons=[]
for i,family in enumerate(FAMILIES):
    front=read_render(EVIDENCE/f'{family}-LOD0-front.png')
    low=read_render(EVIDENCE/f'{family}-LOD1-front.png')
    source_mask=front[:,:,3]>.5
    low_mask=low[:,:,3]>.5
    atlas_mask=atlas[:,i*TILE:(i+1)*TILE,3]>.5
    iou=float((source_mask&low_mask).sum()/(source_mask|low_mask).sum())
    ratio=float(low_mask.sum()/source_mask.sum())
    atlas_iou=float((source_mask&atlas_mask).sum()/(source_mask|atlas_mask).sum())
    assert iou>.65 and .80<ratio<1.20,(family,iou,ratio)
    assert atlas_iou>.97,(family,atlas_iou)
    assert atlas[0,i*TILE:(i+1)*TILE,3].max()>.1,(family,'floating atlas foot')
    comparisons.append({'family':family,'lod0Coverage':float(source_mask.mean()),
                        'lod1CoverageRatio':ratio,'lod1SilhouetteIoU':iou,
                        'atlasSilhouetteIoU':atlas_iou})
    for j,label in enumerate(('LOD0-front','LOD0-opposite','LOD0-threequarter','LOD1-front')):
        pixels=read_render(EVIDENCE/f'{family}-{label}.png')[::2,::2]
        alpha=pixels[:,:,3:4]
        composite=pixels[:,:,:3]*alpha+np.array([.22,.24,.26])*(1-alpha)
        # File pixels are bottom-up: the front row is displayed at the top of the sheet.
        y=(3-j)*TILE//2
        sheet[y:y+TILE//2,i*TILE//2:(i+1)*TILE//2,:3]=composite
image_from_pixels('botanical-contact-sheet',sheet)
manifest={'blender':bpy.app.version_string,'seed':20261114,'families':rows,
          'readback':readback,'rawBytes':raw.stat().st_size,
          'silhouettes':comparisons,
          'atlasBytes':(OUT/'botanical-impostors.png').stat().st_size,
          'maps':[{ 'name':im.name,'width':im.size[0],'height':im.size[1],
                    'bytes':(EVIDENCE/(im.name+'.png')).stat().st_size}
                   for im in (leaf_image,bark_image,bark_normal)]}
(EVIDENCE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('BOTANICAL_DONE',json.dumps(manifest),flush=True)
