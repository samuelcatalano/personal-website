"""Original Wellington silhouette. Blender -b --factory-startup -P this_file.py."""
import bpy, math, os, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
def material(name,color,rough,metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
bronze=material('WellingtonBronze',(.105,.125,.105),.64,.28)
stone=material('WellingtonStone',(.56,.52,.43),.88)
cone=material('WellingtonCone',(1,1,1),.7)
def mesh(name,verts,faces,mat=bronze):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 for p in d.polygons:p.use_smooth=True
 return o
def sweep(name,points,segments=16,mat=bronze):
 # Each authored section is x,y,z,width,depth; the cross-section tracks the path.
 vs=[];fs=[]
 for i,p in enumerate(points):
  c=Vector(p[:3]); tangent=Vector(points[min(i+1,len(points)-1)][:3])-Vector(points[max(0,i-1)][:3]);tangent.normalize()
  side=Vector((0,1,0));up=tangent.cross(side).normalized()
  for j in range(segments):
   a=j*math.tau/segments;v=c+side*(math.cos(a)*p[3])+up*(math.sin(a)*p[4]);vs.append(tuple(v))
 for i in range(len(points)-1):
  for j in range(segments):a=i*segments+j;b=i*segments+(j+1)%segments;fs.append((a,b,b+segments,a+segments))
 fs += [tuple(reversed(range(segments))),tuple((len(points)-1)*segments+j for j in range(segments))]
 return mesh(name,vs,fs,mat)
def ell(name,loc,scale):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(bronze);return o
def box(name,loc,scale,mat=stone,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if bevel:
  m=o.modifiers.new('Carved edges','BEVEL');m.width=bevel;m.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
 return o
def join(objects,name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=objects[0];o.name=name;return o
# Ground datum, footprint and cornice heights match the original group exactly.
slabs=[]
for z,h,w,d in [(0,.5,5.8,3),(.5,.5,5.3,2.6),(1,1.1,4.7,2.1),(1,.15,4.95,2.35),(2.1,.25,5.1,2.6),(2.35,.25,5.4,2.8)]:
 slabs.append(box('Pedestal',(0,0,z+h/2),(w,d,h),bevel=.025))
# Side framed panels remain abstract at normal camera distance.
for s in [-1,1]:
 slabs.append(box('Inset panel',(0,s*1.061,1.57),(3.85,.035,.69),bevel=.04))
 for x in [-2.05,2.05]:slabs.append(box('Panel frame',(x,s*1.09,1.57),(.12,.08,.85)))
 for z in [1.12,2.02]:slabs.append(box('Panel frame',(0,s*1.09,z),(4.2,.08,.09)))
plinth=join(slabs,'WellingtonStone')
parts=[]
def tube(name,points,n=16):
 o=sweep(name,points,n);parts.append(o);return o
def mass(name,loc,scale):
 o=ell(name,loc,scale);parts.append(o);return o
# Barrel is a continuous loft: tapered flanks, deep girth, croup, sloping shoulder.
tube('Barrel',[(-1.96,0,4.69,.12,.15),(-1.72,0,4.72,.50,.62),(-1.25,0,4.68,.65,.77),(-.6,0,4.66,.66,.73),(.12,0,4.72,.60,.70),(.8,0,4.79,.59,.78),(1.36,0,4.84,.45,.67),(1.6,0,4.98,.2,.3)],24)
# Arched neck is broad at chest, narrowing through poll with a concave throat.
tube('Arched neck',[(1.05,0,4.62,.46,.51),(1.38,0,5.0,.45,.55),(1.50,0,5.54,.40,.53),(1.53,0,6.05,.32,.47),(1.77,0,6.48,.26,.34),(2.00,0,6.56,.22,.25)],22)
tube('Head',[(1.92,0,6.18,.22,.29),(2.15,0,6.1,.25,.29),(2.39,0,5.94,.19,.22),(2.68,0,5.75,.175,.18),(2.91,0,5.68,.22,.18),(3.04,0,5.68,.15,.12)],20)
mass('Jaw',(2.22,0,5.88),(.29,.26,.28))
for s in [-1,1]:
 tube('Pointed ear',[(1.88,s*.15,6.30,.09,.10),(1.92,s*.20,6.52,.07,.07),(2.04,s*.23,6.69,.012,.013)],10)
 mass('Brow',(2.2,s*.225,6.12),(.15,.09,.105))
 # Foreleg: shoulder/tendon/knee/cannon/fetlock, no ball-joint knees.
 x=1.19 if s<0 else 1.45
 tube('Foreleg',[(1.02,s*.41,4.87,.24,.34),(x,s*.46,4.40,.17,.23),(x+.05,s*.47,3.98,.105,.15),(x+.02,s*.46,3.73,.13,.13),(x+.02,s*.45,3.4,.085,.11),(x+.04,s*.46,3.03,.073,.09),(x+.12,s*.46,2.78,.11,.11)],14)
 tube('Front hoof',[(x+.12,s*.46,2.86,.12,.11),(x+.20,s*.46,2.70,.18,.17),(x+.23,s*.46,2.63,.19,.16)],14)
 # Back legs have visible stifle and backward hock, separated through the flank.
 xx=-1.23 if s<0 else -1.55
 tube('Hindleg',[(xx,s*.44,4.92,.29,.43),(xx+.08,s*.49,4.47,.26,.32),(xx+.26,s*.49,4.11,.16,.19),(xx-.14,s*.50,3.66,.12,.14),(xx-.30,s*.50,3.44,.12,.12),(xx-.22,s*.51,3.08,.072,.09),(xx-.17,s*.51,2.77,.10,.1)],16)
 tube('Back hoof',[(xx-.17,s*.51,2.85,.12,.1),(xx-.08,s*.51,2.70,.17,.17),(xx-.04,s*.51,2.63,.18,.16)],14)
# Tail follows a heavy curved fall, with a narrow carved tip.
tube('Tail',[(-1.74,0,5.10,.23,.21),(-2.04,.02,4.93,.25,.21),(-2.20,.03,4.59,.21,.19),(-2.29,.04,4.23,.16,.15),(-2.34,.05,3.86,.11,.11),(-2.35,.07,3.58,.025,.035)],18)
# Lift the poll and shorten the face to the upright reference silhouette.
for o in parts:
 if o.name.startswith(('Head','Jaw','Brow','Pointed ear')):
  for v in o.data.vertices:
   v.co.x=1.92+(v.co.x-1.92)*.90 if o.name.startswith(('Head','Pointed ear')) else v.co.x
  o.location.z+=.38
# Rider seat and torso, tapered uniform with sloping shoulders and a high collar.
mass('Seat',(-.38,0,5.52),(.39,.39,.30))
tube('Uniform torso',[(-.40,0,5.49,.32,.22),(-.42,0,5.75,.31,.25),(-.48,0,6.04,.33,.26),(-.49,0,6.36,.41,.27),(-.46,0,6.48,.30,.20),(-.43,0,6.61,.16,.15)],20)
mass('Neck',(-.40,0,6.65),(.13,.15,.18))
mass('Head',(-.36,0,6.89),(.205,.18,.255));mass('Nose',(-.16,0,6.91),(.10,.085,.08));mass('Chin',(-.23,0,6.74),(.13,.13,.08))
for s in [-1,1]:
 # Hands at the hip and forward rein, boots are shaped not blocks.
 tube('Thigh',[(-.37,s*.26,5.52,.21,.25),(-.03,s*.56,5.39,.20,.21),(.20,s*.68,5.08,.155,.19)],16)
 tube('Boot',[(.20,s*.68,5.10,.15,.17),(.13,s*.72,4.84,.13,.15),(.08,s*.74,4.56,.10,.12),(.09,s*.74,4.40,.10,.11),(.36,s*.75,4.36,.13,.1),(.49,s*.75,4.36,.07,.075)],14)
 if s<0: arm=[(-.48,s*.36,6.34,.14,.17),(-.51,s*.55,6.02,.13,.14),(-.26,s*.58,5.71,.09,.10),(-.07,s*.47,5.62,.09,.10)]
 else: arm=[(-.45,s*.36,6.34,.14,.17),(-.16,s*.51,6.01,.13,.14),(.21,s*.40,5.81,.095,.1),(.44,s*.32,5.79,.09,.09)]
 tube('Sleeve and hand',arm,14)
 # Long coat tails with a folded, scalloped silhouette astride the flanks.
 tube('Coat skirt',[(-.48,s*.37,5.65,.20,.20),(-.72,s*.61,5.30,.16,.32),(-.88,s*.69,4.99,.13,.32),(-1.03,s*.67,4.76,.07,.20)],16)
# Unify anatomy so overlapping construction never reads as disconnected primitive joints.
body=join(parts,'Sculptural bronze');bpy.context.view_layer.objects.active=body
rem=body.modifiers.new('Connected sculpt','REMESH');rem.mode='VOXEL';rem.voxel_size=.036;rem.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rem.name)
sm=body.modifiers.new('Sculpt polish','SMOOTH');sm.factor=.7;sm.iterations=4;bpy.ops.object.modifier_apply(modifier=sm.name)
body.data.calc_loop_triangles()
dec=body.modifiers.new('Silhouette decimation','DECIMATE');dec.ratio=min(1,11500/max(1,len(body.data.loop_triangles)));bpy.ops.object.modifier_apply(modifier=dec.name)
# Raised flowing mane and uniform folds remain deliberately broad enough to survive normal view.
details=[body]
for s in [-1,1]:
 for i in range(4):
  details.append(sweep('Mane fold',[(1.25-i*.07,s*.33,5.17+i*.19,.027,.035),(1.24+i*.13,s*.34,5.60+i*.13,.029,.04),(1.68+i*.06,s*.22,6.15+i*.035,.02,.025)],7))
 details.append(sweep('Rein',[(.42,s*.34,5.8,.027,.025),(1.18,s*.49,5.48,.027,.025),(2.09,s*.35,5.47,.027,.025),(2.82,s*.21,6.06,.027,.025)],8))
 details.append(sweep('Bridle',[(2.02,s*.24,6.64,.027,.025),(2.33,s*.24,6.29,.027,.025),(2.77,s*.23,6.08,.027,.025)],8))
# Broad bicorne, side-to-side brim and raised crown under the single cone.
bicorne=ell('Bicorne',(-.37,0,7.08),(.30,.44,.095));details.append(bicorne)
details.append(sweep('Bicorne crown',[(-.63,0,7.10,.12,.06),(-.39,0,7.19,.33,.10),(-.12,0,7.10,.14,.06)],16))
body=join(details,'WellingtonBronze')
# One vertex-colored cone: bands use the same material and renderable.
verts=[];faces=[];colors=[];rings=[(7.28,.31),(7.32,.31),(7.32,.255),(7.43,.205),(7.58,.125),(7.66,.08),(7.775,.025)]
for z,r in rings:
 for i in range(24):a=i*math.tau/24;verts.append((-.37+r*math.cos(a),r*math.sin(a),z))
for j in range(len(rings)-1):
 for i in range(24):faces.append((j*24+i,j*24+(i+1)%24,(j+1)*24+(i+1)%24,(j+1)*24+i))
faces.extend([tuple(reversed(range(24))),tuple((len(rings)-1)*24+i for i in range(24))])
c=mesh('WellingtonCone',verts,faces,cone);attr=c.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
for p in c.data.polygons:
 z=sum(c.data.vertices[v].co.z for v in p.vertices)/len(p.vertices);col=(.94,.96,.91,1) if 7.43<z<7.66 else (.94,.065,.004,1)
 for li in p.loop_indices:attr.data[li].color=col
p=cone.node_tree.nodes['Principled BSDF'];v=cone.node_tree.nodes.new('ShaderNodeVertexColor');v.layer_name='Color';cone.node_tree.links.new(v.outputs['Color'],p.inputs['Base Color'])
for o in [plinth,body,c]:
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 for p in o.data.polygons:p.use_smooth=o!=plinth
 o.data.calc_loop_triangles()
assert sum(len(o.data.loop_triangles) for o in [plinth,body,c])<18000
out=os.path.join(ROOT,'wellington-original-poc.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_yup=True,export_materials='EXPORT')
import shutil
shutil.copyfile(out,os.path.join(ROOT,'../../../assets/landmarks/wellington.glb'))
print(json.dumps({o.name:len(o.data.loop_triangles) for o in [plinth,body,c]}))
