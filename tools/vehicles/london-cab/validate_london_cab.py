"""Validate actual GLB contract and reconstructed mesh topology in Blender.
blender -b --factory-startup --python-exit-code 1 -P validate_london_cab.py -- input.glb
"""
import bpy, bmesh, json, math, os, struct, sys
from mathutils import Vector

path=os.path.abspath(sys.argv[sys.argv.index('--')+1]); data=open(path,'rb').read()
magic,version,total=struct.unpack_from('<III',data); assert magic==0x46546c67 and version==2 and total==len(data)
length,kind=struct.unpack_from('<II',data,12); assert kind==0x4e4f534a
j=json.loads(data[20:20+length]); expected={'CabBody','CabGlass','CabRubber','CabTrim','CabInterior','CabLights'}
assert len(j['meshes'])==6 and len(j['materials'])==6
assert {m['name'] for m in j['materials']}==expected
assert not j.get('textures') and not j.get('images') and not j.get('animations')
assert all(not m.get('doubleSided',False) for m in j['materials'])
def values(index):
    accessor=j['accessors'][index]; view=j['bufferViews'][accessor['bufferView']]
    size,fmt={5121:(1,'B'),5123:(2,'H'),5126:(4,'f')}[accessor['componentType']]
    width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[accessor['type']]
    binary_start=20+length+8; start=binary_start+view.get('byteOffset',0)+accessor.get('byteOffset',0)
    stride=view.get('byteStride',size*width)
    divisor=(255 if size==1 else 65535) if accessor.get('normalized') else 1
    return [tuple(c/divisor for c in struct.unpack_from('<'+fmt*width,data,start+i*stride)) for i in range(accessor['count'])]
triangles=0
for m in j['meshes']:
    assert len(m['primitives'])==1, (m['name'],'multiple primitives')
    p=m['primitives'][0]; assert p.get('mode',4)==4
    assert {'POSITION','NORMAL','COLOR_0'} <= p['attributes'].keys(), (m['name'],p['attributes'])
    assert j['materials'][p['material']]['name']==m['name']
    colors=values(p['attributes']['COLOR_0'])
    normals=values(p['attributes']['NORMAL'])
    assert all(abs(sum(c*c for c in n)-1)<.002 for n in normals),(m['name'],'non-unit normals')
    if m['name']=='CabBody': assert all(min(c[:3])>.999 for c in colors),'body colors must stay white'
    if m['name']=='CabLights':
        assert any(c[0]>.5 and c[1]<.05 for c in colors),'missing red rear lamps'
        assert any(c[0]>.9 and .2<c[1]<.6 and c[2]<.05 for c in colors),'missing amber lamps'
        assert any(min(c[:3])>.7 for c in colors),'missing white front lamps'
    triangles+=j['accessors'][p['indices']]['count']//3
assert triangles<=10000,triangles
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=path)
meshes=[ob for ob in bpy.context.scene.objects if ob.type=='MESH']; assert len(meshes)==6
points=[ob.matrix_world@v.co for ob in meshes for v in ob.data.vertices]
mins=[min(p[k] for p in points) for k in range(3)]; maxs=[max(p[k] for p in points) for k in range(3)]
dims=[maxs[k]-mins[k] for k in range(3)]
assert abs(dims[0]-4.857)<.006 and abs(dims[1]-2.036)<.015 and abs(dims[2]-1.888)<.006,dims
assert abs(mins[2])<.002 and abs(mins[0]+maxs[0])<.002 and abs(mins[1]+maxs[1])<.002,(mins,maxs)
failures=[]
for ob in meshes:
    assert len(ob.data.materials)==1
    bm=bmesh.new(); bm.from_mesh(ob.data)
    # glTF splits vertices at hard normals and corner colors. Weld only for the
    # topology audit; the exported normals and colors remain untouched.
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
    nonmanifold=sum(not e.is_manifold for e in bm.edges)
    loose=sum(not v.link_faces for v in bm.verts)
    degenerate=sum(f.calc_area()<1e-12 for f in bm.faces)
    remaining=set(bm.faces); volumes=[]
    while remaining:
        stack=[remaining.pop()]; component=[]
        while stack:
            face=stack.pop(); component.append(face)
            for edge in face.edges:
                for neighbor in edge.link_faces:
                    if neighbor in remaining: remaining.remove(neighbor); stack.append(neighbor)
        volume=0
        for face in component:
            v=[p.co for p in face.verts]
            for k in range(1,len(v)-1): volume+=v[0].dot(v[k].cross(v[k+1]))/6
        volumes.append(volume)
    inward=sum(v < -1e-9 for v in volumes)
    record=dict(mesh=ob.name,triangles=sum(len(p.vertices)-2 for p in ob.data.polygons),closed_components=len(volumes),nonmanifold_edges=nonmanifold,loose_vertices=loose,degenerate_faces=degenerate,inward_components=inward)
    print('CAB TOPOLOGY',json.dumps(record,sort_keys=True))
    if nonmanifold or loose or degenerate or inward: failures.append(record)
    bm.free()
assert not failures,failures
print('CAB VALIDATION',json.dumps(dict(triangles=triangles,meshes=6,materials=6,textures=0,dimensions_xyz=dims,origin_ground=True,closed_components=True,glb_bytes=len(data)),sort_keys=True))
