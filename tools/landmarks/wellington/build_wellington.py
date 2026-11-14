"""Original Wellington silhouette. Blender -b --factory-startup -P this_file.py."""
import bpy, math, os, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
def material(name,color,rough,metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
bronze=material('WellingtonBronze',(.065,.085,.072),.51,.58)
stone=material('WellingtonStone',(.56,.52,.43),.88)
cone=material('WellingtonCone',(1,1,1),.48)
def mesh(name,verts,faces,mat=bronze):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 for p in d.polygons:p.use_smooth=True
 return o
def sweep(name,points,segments=16,mat=bronze):
 # Each authored section is x,y,z,width,depth; the cross-section tracks the path.
 # Catmull-Rom sections keep the authored contour while removing stacked-cone shoulders.
 sections=[]
 for i in range(len(points)-1):
  a,b,c,d=[points[max(0,min(len(points)-1,j))] for j in [i-1,i,i+1,i+2]]
  for step in range(4):
   t=step/4
   sections.append(tuple(.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in range(5)))
 points=sections+[points[-1]]
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
def ell(name,loc,scale,segments=28,rings=18):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(bronze);return o
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
tube('Barrel',[(-1.96,0,4.69,.12,.15),(-1.72,0,4.72,.50,.62),(-1.25,0,4.77,.61,.68),(-.6,0,4.70,.60,.64),(.12,0,4.76,.56,.64),(.8,0,4.79,.59,.78),(1.36,0,4.84,.45,.67),(1.6,0,4.98,.2,.3)],24)
# Arched neck is broad at chest, narrowing through poll with a concave throat.
tube('Arched neck',[(1.05,0,4.62,.46,.51),(1.38,0,5.0,.45,.55),(1.50,0,5.54,.36,.48),(1.53,0,6.05,.28,.42),(1.77,0,6.48,.23,.30),(2.00,0,6.56,.20,.22)],22)
tube('Head',[(1.92,0,6.18,.22,.29),(2.15,0,6.1,.25,.29),(2.39,0,5.94,.19,.22),(2.68,0,5.75,.175,.18),(2.91,0,5.68,.22,.18),(3.04,0,5.68,.15,.12)],20)
mass('Jaw',(2.22,0,5.88),(.29,.26,.28))
for s in [-1,1]:
 tube('Pointed ear',[(1.88,s*.15,6.30,.09,.10),(1.92,s*.20,6.52,.07,.07),(2.04,s*.23,6.69,.012,.013)],10)
 mass('Brow',(2.2,s*.225,6.12),(.15,.09,.105))
 # Foreleg: shoulder/tendon/knee/cannon/fetlock, no ball-joint knees.
 x=1.19 if s<0 else 1.45
 lift=.20 if s>0 else 0
 reach=.13 if s>0 else 0
 tube('Foreleg',[(1.02,s*.41,4.87,.24,.34),(x,s*.46,4.40,.17,.23),(x+.05,s*.47,3.98,.105,.15),(x+.02,s*.46,3.73,.13,.13),(x+.02,s*.45,3.4+lift*.25,.085,.11),(x+.04+reach*.4,s*.46,3.03+lift,.073,.09),(x+.12+reach,s*.46,2.78+lift,.11,.11)],14)
 tube('Front hoof',[(x+.12+reach,s*.46,2.86+lift,.12,.11),(x+.20+reach,s*.46,2.70+lift,.18,.17),(x+.23+reach,s*.46,2.63+lift,.19,.16)],14)
 # Back legs have visible stifle and backward hock, separated through the flank.
 xx=-1.23 if s<0 else -1.55
 tube('Hindleg',[(xx,s*.44,4.92,.29,.43),(xx+.08,s*.49,4.47,.26,.32),(xx+.12,s*.49,4.11,.16,.19),(xx-.08,s*.50,3.66,.12,.14),(xx-.17,s*.50,3.44,.12,.12),(xx-.15,s*.51,3.08,.072,.09),(xx-.17,s*.51,2.77,.10,.1)],16)
 tube('Back hoof',[(xx-.17,s*.51,2.85,.12,.1),(xx-.08,s*.51,2.70,.17,.17),(xx-.04,s*.51,2.63,.18,.16)],14)
# Tail follows a heavy curved fall, with a narrow carved tip.
tube('Tail',[(-1.65,0,5.12,.16,.16),(-2.06,.02,5.18,.19,.18),(-2.37,.03,5.02,.21,.18),(-2.48,.04,4.65,.17,.16),(-2.50,.05,4.22,.11,.11),(-2.51,.07,3.99,.025,.035)],18)
# Lift the poll and shorten the face to the upright reference silhouette.
for o in parts:
 if o.name.startswith(('Head','Jaw','Brow','Pointed ear')):
  for v in o.data.vertices:
   v.co.x=1.92+(v.co.x-1.92)*.90 if o.name.startswith(('Head','Pointed ear')) else v.co.x
  o.location.z+=.38
# Shoulder, pectoral and haunch masses blend into the barrel rather than making cylinder joints.
for side in [-1,1]:
 mass('Scapula',(.85,side*.38,4.88),(.46,.27,.63))
 mass('Pectoral',(1.32,side*.21,4.54),(.30,.29,.39))
 mass('Haunch',(-1.34,side*.36,4.77),(.47,.31,.58))
# Rider seat and torso, tapered uniform with sloping shoulders and a high collar.
mass('Seat',(-.38,0,5.52),(.39,.39,.30))
tube('Uniform torso',[(-.40,0,5.49,.32,.22),(-.42,0,5.75,.31,.25),(-.48,0,6.04,.33,.26),(-.49,0,6.36,.41,.27),(-.46,0,6.48,.30,.20),(-.43,0,6.61,.16,.15)],20)
mass('Neck',(-.40,0,6.65),(.13,.15,.18))
mass('Head',(-.36,0,6.89),(.205,.18,.255));mass('Nose',(-.16,0,6.91),(.068,.052,.09));mass('Chin',(-.23,0,6.74),(.105,.12,.075))
for s in [-1,1]:
 # Hands at the hip and forward rein, boots are shaped not blocks.
 tube('Thigh',[(-.37,s*.26,5.52,.21,.25),(-.03,s*.56,5.39,.20,.21),(.20,s*.68,5.08,.155,.19)],16)
 tube('Boot',[(.20,s*.68,5.10,.15,.17),(.13,s*.72,4.84,.13,.15),(.08,s*.74,4.56,.10,.12),(.09,s*.74,4.40,.10,.11),(.36,s*.75,4.36,.13,.1),(.49,s*.75,4.36,.07,.075)],14)
 if s<0: arm=[(-.48,s*.36,6.34,.14,.17),(-.51,s*.55,6.02,.13,.14),(-.26,s*.58,5.71,.09,.10),(-.07,s*.47,5.62,.09,.10)]
 else: arm=[(-.45,s*.36,6.34,.14,.17),(-.16,s*.51,6.01,.13,.14),(.21,s*.40,5.81,.095,.1),(.44,s*.32,5.79,.09,.09)]
 tube('Sleeve and hand',arm,14)
 # Long coat tails with a folded, scalloped silhouette astride the flanks.
 tube('Coat skirt',[(-.48,s*.37,5.65,.10,.20),(-.72,s*.64,5.30,.065,.32),(-.88,s*.72,4.99,.055,.33),(-1.03,s*.71,4.76,.035,.23)],16)
# Unify anatomy so overlapping construction never reads as disconnected primitive joints.
body=join(parts,'Sculptural bronze');bpy.context.view_layer.objects.active=body
rem=body.modifiers.new('Connected sculpt','REMESH');rem.mode='VOXEL';rem.voxel_size=.023;rem.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rem.name)
sm=body.modifiers.new('Sculpt polish','SMOOTH');sm.factor=.55;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name)
body.data.calc_loop_triangles()
dec=body.modifiers.new('Silhouette decimation','DECIMATE');dec.ratio=min(1,55000/max(1,len(body.data.loop_triangles)));bpy.ops.object.modifier_apply(modifier=dec.name)
polish=body.modifiers.new('Final cast surface','SMOOTH');polish.factor=.45;polish.iterations=3;bpy.ops.object.modifier_apply(modifier=polish.name)
# Surface work stays in one bronze mesh, including all harness and uniform ornament.
details=[body,box('Cast bronze mounting plate',(0,0,2.64),(5.12,1.78,.09),mat=bronze,bevel=.035)]
def detail(name,points,n=10):
 o=sweep(name,points,n);details.append(o);return o
def ornament(name,loc,scale):
 o=ell(name,loc,scale,12 if name.startswith('Relief') else 20,8 if name.startswith('Relief') else 12);details.append(o);return o
for side in [-1,1]:
 # The bridle follows cheek and nose; reins hang outside the neck with a clear air gap.
 detail('Rein',[(.43,side*.33,5.8,.020,.020),(1.07,side*.60,5.49,.020,.020),(1.95,side*.43,5.72,.020,.020),(2.79,side*.22,6.08,.020,.020)])
 detail('Cheek strap',[(1.99,side*.23,6.72,.024,.024),(2.25,side*.28,6.44,.024,.024),(2.79,side*.22,6.08,.024,.024)])
 detail('Throat latch',[(1.97,side*.23,6.67,.021,.021),(1.93,side*.32,6.16,.021,.021),(2.16,side*.27,6.02,.021,.021)])
 ornament('Eye',(2.17,side*.247,6.51),(.065,.025,.043))
 ornament('Nostril rim',(2.76,side*.18,6.11),(.073,.031,.043))
 detail('Mouth',[(2.70,side*.16,6.01,.013,.013),(2.80,side*.175,5.99,.013,.013),(2.87,side*.13,6.00,.013,.013)],8)
 # Carved mane descends over the crest with overlapping locks, not floating whiskers.
 for i in range(24):
  z=5.10+i*.068;x=.86+max(0,z-5.30)*.45
  detail('Mane lock',[(x,side*.08,z+.08,.026,.030),(x+.06,side*.24,z,.030,.034),(x+.22,side*(.36-(z-5.10)*.065),z-.19,.008,.012)],7)
 # Saddle cloth is a broad draped sheet; hem and folds remain visible under the coat.
 verts=[];faces=[]
 for row in range(8):
  t=row/7;y=side*(.30+.42*t)
  for col in range(9):
   u=col/8;x=-1.13+1.52*u
   z=5.40-.65*t+.10*math.sin(u*math.pi)+.075*math.cos(u*math.pi*6)*t
   verts.append((x,y,z))
 for row in range(7):
  for col in range(8):
   q=row*9+col;faces.append((q,q+1,q+10,q+9))
 cloth=mesh('Saddle cloth',verts,faces);solid=cloth.modifiers.new('Cast cloth thickness','SOLIDIFY');solid.thickness=.045
 bpy.context.view_layer.objects.active=cloth;bpy.ops.object.modifier_apply(modifier=solid.name);details.append(cloth)
 detail('Saddle cloth braid',[(*verts[63+i],.022,.022) for i in range(9)],8)
 detail('Breast harness',[(.18,side*.57,5.26,.035,.025),(.93,side*.62,4.88,.035,.025),(1.42,side*.24,4.63,.035,.025)])
 detail('Stirrup leather',[(.05,side*.72,5.19,.026,.021),(-.03,side*.81,4.72,.026,.021),(.12,side*.82,4.34,.026,.021)],8)
 detail('Stirrup iron',[(.08,side*.83,4.53,.018,.018),(-.03,side*.83,4.31,.018,.018),(.39,side*.83,4.30,.018,.018),(.31,side*.83,4.48,.018,.018)],8)
 # Tapered lapels, cuffs, epaulettes and draped coat seams identify the military uniform.
 ornament('Epaulette',(-.47,side*.35,6.38),(.22,.16,.065))
 for i in range(6):
  detail('Epaulette fringe',[(-.59+i*.047,side*.43,6.37,.013,.014),(-.59+i*.047,side*.455,6.28,.013,.014)],6)
 detail('Lapels',[(-.29,side*.12,6.48,.04,.035),(-.18,side*.19,6.24,.045,.04),(-.20,side*.10,6.03,.028,.022)],8)
 detail('Coat piping',[(-.59,side*.40,5.58,.022,.026),(-.79,side*.69,5.19,.022,.026),(-1.03,side*.72,4.75,.018,.020)],8)
 for i in range(4):
  detail('Coat fold',[(-.46-i*.08,side*.46,5.55,.032,.035),(-.57-i*.10,side*.64,5.21,.034,.04),(-.70-i*.11,side*.71,4.94-i*.04,.012,.016)],8)
# Forehead and noseband wrap all the way across the head.
for x,z,w in [(2.16,6.61,.25),(2.76,6.15,.20)]:
 detail('Cross strap',[(x,-w,z,.024,.021),(x+.04,0,z+.04,.024,.021),(x,w,z,.024,.021)],10)
# Original shallow battle frieze: cast figures and cavalry rhythm, not a copied historic relief.
for side in [-1,1]:
 panel=box('Bronze relief field',(0,side*1.087,1.57),(3.83,.037,.67),mat=bronze,bevel=.015);details.append(panel)
 for i in range(7):
  x=-1.67+i*.25;z=1.40+.055*math.sin(i*1.8)
  ornament('Relief head',(x,side*1.126,z+.27),(.060,.033,.062))
  ornament('Relief coat',(x,side*1.124,z+.12),(.073,.031,.12))
  detail('Relief stance',[(x-.05,side*1.13,z+.04,.022,.022),(x-.09,side*1.13,z-.11,.019,.018)],6)
  detail('Relief stance',[(x+.03,side*1.13,z+.04,.022,.022),(x+.10,side*1.13,z-.11,.019,.018)],6)
  detail('Relief musket',[(x+.11,side*1.14,z-.03,.012,.012),(x+.02,side*1.14,z+.37,.012,.012)],6)
 # Two cavalry figures break up the infantry procession.
 for x in [.42,1.22]:
  ornament('Relief horse',(x,side*1.13,1.47),(.26,.035,.10))
  ornament('Relief horse neck',(x+.20,side*1.13,1.58),(.065,.035,.17))
  ornament('Relief horse head',(x+.25,side*1.13,1.72),(.10,.035,.055))
  ornament('Relief cavalry',(x,side*1.13,1.69),(.055,.035,.12))
  ornament('Relief rider head',(x,side*1.13,1.84),(.05,.035,.05))
  for dx in [-.19,.16]:
   detail('Relief horse leg',[(x+dx,side*1.135,1.43,.018,.018),(x+dx-.04,side*1.135,1.29,.018,.018)],6)
 # Outer bronze frame sits inside the existing stone molding.
 for z in [1.24,1.90]:details.append(box('Relief border',(0,side*1.117,z),(3.82,.03,.025),mat=bronze,bevel=.009))
# Belt, crossed sash and buttons cast clear uniform highlights at intermediate views.
for z in [5.82,5.91]:
 detail('Waist belt',[(-.23,-.29,z,.026,.022),(-.16,0,z,.026,.022),(-.23,.29,z,.026,.022)],10)
detail('Cross sash',[(-.29,-.29,6.37,.047,.025),(-.17,0,6.12,.047,.025),(-.20,.25,5.94,.047,.025)],10)
for z in [6.0,6.12,6.24,6.36]:ornament('Uniform button',(-.204,-.07,z),(.025,.024,.024))
for side in [-1,1]:ornament('Ear',(-.38,side*.178,6.90),(.047,.020,.067))
# Raised strands follow the hanging tail.
for i in range(7):
 y=(i-3)*.04
 detail('Tail strand',[(-1.93,y,5.25,.014,.019),(-2.39,y*1.3,5.06,.016,.021),(-2.55,y,4.60,.014,.018),(-2.51,y*.35,4.05,.008,.010)],7)
# Broad bicorne, side-to-side brim and raised crown under the single cone.
bicorne=ell('Bicorne',(-.37,0,7.08),(.30,.44,.095));details.append(bicorne)
details.append(sweep('Bicorne crown',[(-.63,0,7.10,.12,.06),(-.39,0,7.19,.33,.10),(-.12,0,7.10,.14,.06)],16))
body=join(details,'WellingtonBronze')
# Sandstone face tooling, end-panel borders remain in the stone bucket.
stone_parts=[plinth]
for sign in [-1,1]:
 stone_parts.append(box('End panel',(sign*2.366,0,1.58),(.045,1.65,.72),bevel=.018))
 for y in [-.86,.86]:stone_parts.append(box('End panel frame',(sign*2.396,y,1.58),(.05,.05,.80),bevel=.009))
 for z in [1.18,1.98]:stone_parts.append(box('End panel frame',(sign*2.396,0,z),(.05,1.77,.045),bevel=.009))
plinth=join(stone_parts,'WellingtonStone')
# One vertex-colored cone: bands use the same material and renderable.
verts=[];faces=[];rings=[(7.32,.22),(7.345,.22),(7.355,.205),(7.52,.15),(7.69,.095),(7.855,.04),(7.885,.04),(7.90,.046)]
for z,r in rings:
 for i in range(24):a=i*math.tau/24;verts.append((-.37+r*math.cos(a),r*math.sin(a),z))
for j in range(len(rings)-1):
 for i in range(24):faces.append((j*24+i,j*24+(i+1)%24,(j+1)*24+(i+1)%24,(j+1)*24+i))
faces.extend([tuple(reversed(range(24))),tuple((len(rings)-1)*24+i for i in range(24))])
# Chamfered square rubber foot and a truncated neck distinguish road equipment from a pointed hat.
foot=[(-.215,-.27),(.215,-.27),(.27,-.215),(.27,.215),(.215,.27),(-.215,.27),(-.27,.215),(-.27,-.215)]
offset=len(verts)
for z in [7.28,7.32]:
 for x,y in foot:verts.append((-.37+x,y,z))
for i in range(8):faces.append((offset+i,offset+(i+1)%8,offset+8+(i+1)%8,offset+8+i))
faces.extend([tuple(offset+i for i in reversed(range(8))),tuple(offset+8+i for i in range(8))])
c=mesh('WellingtonCone',verts,faces,cone);attr=c.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
for p in c.data.polygons:
 z=sum(c.data.vertices[v].co.z for v in p.vertices)/len(p.vertices);col=(.025,.028,.03,1) if z<7.321 else (.94,.96,.91,1) if 7.52<z<7.69 else (.94,.065,.004,1)
 for li in p.loop_indices:attr.data[li].color=col
p=cone.node_tree.nodes['Principled BSDF'];v=cone.node_tree.nodes.new('ShaderNodeVertexColor');v.layer_name='Color';cone.node_tree.links.new(v.outputs['Color'],p.inputs['Base Color'])
for o in [plinth,body,c]:
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 for p in o.data.polygons:p.use_smooth=o!=plinth and (o!=c or p.center.z>7.321)
 o.data.calc_loop_triangles()
# Coherent vertex patina exports directly to glTF; no image or shader dependency.
attr=body.data.color_attributes.new(name='Patina',type='FLOAT_COLOR',domain='POINT')
for v in body.data.vertices:
 p=body.matrix_world @ v.co
 grain=(math.sin(p.x*9+p.z*7)*math.sin(p.y*13-p.z*4)+math.sin(p.x*23+p.y*17+p.z*11)*.25)*.5+.5
 green=max(0,min(1,(grain-.40)*1.4))
 attr.data[v.index].color=(.052+.040*green,.064+.075*green,.052+.063*green,1)
p=bronze.node_tree.nodes['Principled BSDF'];vc=bronze.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Patina';bronze.node_tree.links.new(vc.outputs['Color'],p.inputs['Base Color'])
assert len([o for o in bpy.context.scene.objects if o.type=='MESH'])==3
assert all(math.isfinite(c) for o in [plinth,body,c] for v in o.data.vertices for c in v.co)
assert sum(len(o.data.loop_triangles) for o in [plinth,body,c])<100000
assert abs(plinth.dimensions.x-5.8)<.001 and abs(plinth.dimensions.y-3)<.001
assert abs(max((plinth.matrix_world @ v.co).z for v in plinth.data.vertices)-2.6)<.001
out=os.path.join(ROOT,'wellington-original-poc.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_yup=True,export_materials='EXPORT')
import subprocess
subprocess.run(['node',os.path.join(ROOT,'../../pipeline/compress-lossless.mjs'),out,os.path.join(ROOT,'../../../assets/landmarks/wellington.glb')],check=True)
print(json.dumps({o.name:len(o.data.loop_triangles) for o in [plinth,body,c]}))
