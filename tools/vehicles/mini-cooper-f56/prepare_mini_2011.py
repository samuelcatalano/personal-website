"""Prepare the owner-supplied Nieve5677 CC-BY-4.0 Mini; run in Blender Python."""
import bpy, bmesh, math, os
from mathutils import Matrix, Vector
ROOT = '/Users/samuel.catalano/Projects/samuelcatalano/personal-website'
SOURCE = '/Users/samuel.catalano/Library/CloudStorage/OneDrive-OneWorkplace/Desktop/mini_cooper_s_hardtop_2011.glb'
OUT = ROOT + '/assets/vehicles/mini-cooper-2011.glb'
for obj in list(bpy.context.scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
for material in list(bpy.data.materials):bpy.data.materials.remove(material)
bpy.ops.import_scene.gltf(filepath=SOURCE)
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
s=3.73/372.19
transform=Matrix(((0,0,-s,0),(s,0,0,0),(0,-s,0,0),(0,0,0,1)))
for o in objects:
 o.data.transform(transform @ o.matrix_world); o.parent=None; o.matrix_world=Matrix.Identity(4)
 if o.name=='Object_36':
  bm=bmesh.new();bm.from_mesh(o.data)
  for y in [-.27,-.09,.09,.27]:
   bmesh.ops.bisect_plane(bm,geom=[*bm.verts,*bm.edges,*bm.faces],plane_co=(0,y,0),plane_no=(0,1,0),dist=1e-7)
  for x in [1.0,1.72]:
   bmesh.ops.bisect_plane(bm,geom=[*bm.verts,*bm.edges,*bm.faces],plane_co=(x,0,0),plane_no=(1,0,0),dist=1e-7)
  bm.to_mesh(o.data);bm.free();o.data.update()
# Use the source tyre bounds, including the small left/right asymmetry.
centers={}
for o in objects:
 if o.name not in ['Object_68','Object_70','Object_72','Object_74']:continue
 pts=[v.co for v in o.data.vertices];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)])
 c=(lo+hi)/2;name=('F' if c.x>0 else 'R')+('L' if c.y>0 else 'R');centers[name]=c
assert len(centers)==4
colors={'CarBody':('#f2f0e9',.26,.24),'CarRoof':('#c9252b',.3,.08),'CarStripe':('#f2f0e9',.26,.24),'CarTrim':('#17191c',.5,0),'CarChrome':('#d8dadd',.17,.9),'CarRim':('#aeb4ba',.24,.85),'CarGlass':('#1b2830',.06,0),'CarInterior':('#2b2724',.8,0),'CarHeadlight':('#fff6e0',.18,0),'CarTaillight':('#c01414',.25,0)}
materials={}
for name,(color,rough,metal) in colors.items():
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)];b.inputs['Base Color'].default_value=tuple(((x+.055)/1.055)**2.4 if x>.04045 else x/12.92 for x in rgb)+(1,);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal;materials[name]=m
parts={}
for o in objects:
 g=o.data; source=g.materials[0].name; parent=list(range(len(g.vertices)));weld={}
 def find(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return i
 for v in g.vertices:
  k=tuple(round(x,5) for x in v.co);parent[v.index]=weld.setdefault(k,v.index)
 for p in g.polygons:
  a=find(p.vertices[0])
  for i in p.vertices[1:]:parent[find(i)]=a
 components={}
 for p in g.polygons:components.setdefault(find(p.vertices[0]),[]).append(p)
 for faces in components.values():
  indices={i for f in faces for i in f.vertices};pts=[g.vertices[i].co for i in indices];lo=Vector([min(p[i] for p in pts)for i in range(3)]);hi=Vector([max(p[i] for p in pts)for i in range(3)]);c=(lo+hi)/2
  wheel=None
  if source in ['tire','material_13','chrome']:
   for name,center in centers.items():
    if math.hypot(c.x-center.x,c.z-center.z)<.12 and abs(c.y-center.y)<.16 and hi.x-lo.x<.68 and hi.z-lo.z<.68:wheel=name;break
  role= {'carpaint':'CarBody','chrome':'CarChrome','mirror':'CarChrome','tire':'CarTrim','material_13':'CarRim','brakedisk':'CarChrome','black':'CarTrim','windowglass':'CarGlass','clearglass':'CarHeadlight','redglass':'CarTaillight'}.get(source,'CarInterior')
  if source=='black' and lo.z>1.2 and hi.y-lo.y>.6:role='CarRoof'
  if wheel and source=='chrome':role='CarRim'
  # Match the previous Mini: pearl bonnet, twin red stripes, red roof and mirror caps.
  for f in faces:
   center=f.center; r=role
   if source=='carpaint':
    if (center.z>1.18 and f.normal.z>.4) or o.name=='Object_35':r='CarRoof'
    if o.name=='Object_36':
     r='CarBody'
     if 1.0<center.x<1.72 and .09<abs(center.y)<.27:r='CarRoof'
   key=(wheel,r);vertices,polys=parts.setdefault(key,([],[]));start=len(vertices)
   vertices.extend(tuple(g.vertices[i].co-(centers[wheel] if wheel else Vector())) for i in f.vertices);polys.append(tuple(range(start,start+len(f.vertices))))
for o in list(bpy.context.scene.objects):bpy.data.objects.remove(o,do_unlink=True)
root=bpy.data.objects.new('CarRoot',None);bpy.context.scene.collection.objects.link(root)
pivots={}
for name,c in centers.items():
 p=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(p);p.parent=root;p.location=c;p['radius']=.3145;pivots[name]=p
for (wheel,role),(vertices,faces) in parts.items():
 mesh=bpy.data.meshes.new(role);mesh.from_pydata(vertices,[],faces);mesh.materials.append(materials[role]);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bm.to_mesh(mesh);bm.free();mesh.update()
 o=bpy.data.objects.new((wheel or 'Body')+'_'+role,mesh);bpy.context.scene.collection.objects.link(o);o.parent=pivots[wheel] if wheel else root
 for p in mesh.polygons:p.use_smooth=True
bpy.context.view_layer.update()
for name,p in pivots.items():assert len(p.children)>0,name
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
print('EXPORTED',OUT,os.path.getsize(OUT),'pivots',[(n,tuple(c))for n,c in centers.items()],flush=True)
