"""Original regional ambient fleet. Blender 5: blender -b -P build_fleet.py [-- model-id].
Metres: author +X forward / +Z up, GLB +X forward / +Y up. No downloaded geometry.
"""
import bpy, bmesh, math, json, sys, shutil, hashlib, struct
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OUT=ROOT/'assets/vehicles'
EVIDENCE=Path('/private/tmp/regional-fleet-pass/asset-evidence')
# x/body-height/width-factor stations; x and height are fractions of L and H.
# Cabin = front scuttle, front roof, rear roof, rear glass heel, belt/H, roof halfwidth/body halfwidth.
MODELS=[
 dict(id='chevrolet-onix',name='Chevrolet Onix',generation='Second generation hatch, MY2020',region='br',dims=[4.163,1.731,1.476],wb=2.551,overhang=.882,r=.311,spokes=5,
  body=[[-.5,.59,.88],[-.46,.65,.98],[-.32,.69,1],[-.08,.66,1],[.21,.65,.99],[.39,.61,.96],[.5,.56,.86]],cabin=[0.255, 0.085, -0.36, -0.455, 0.65, 0.77],b=.03,paint=[.24,.37,.54],
  windows=[[[0.23, 0.685], [0.065, 0.94], [-0.06, 0.95], [-0.06, 0.685]], [[-0.085, 0.685], [-0.085, 0.95], [-0.335, 0.94], [-0.405, 0.71]]],signature='Split Chevrolet grille; swept headlamps; separate red hook tail lamps; climbing rear quarter glass'),
 dict(id='hyundai-hb20',name='Hyundai HB20',generation='Second generation hatch, MY2023 facelift',region='br',dims=[4.015,1.720,1.470],wb=2.530,overhang=.820,r=.310,spokes=8,
  body=[[-.5,.60,.85],[-.465,.67,.97],[-.30,.69,1],[-.05,.66,1],[.22,.66,.98],[.405,.59,.96],[.5,.55,.83]],cabin=[0.27, 0.09, -0.355, -0.445, 0.66, 0.75],b=0,paint=[.13,.34,.48],
  windows=[[[0.242, 0.698], [0.085, 0.946], [-0.05, 0.947], [-0.05, 0.7]], [[-0.075, 0.7], [-0.075, 0.947], [-0.33, 0.935], [-0.395, 0.76]]],signature='Wide black cascading lower grille; angular upper lamps; full-width H-shaped rear light graphic; upswept quarter'),
 dict(id='toyota-corolla',name='Toyota Corolla',generation='Twelfth generation sedan, MY2020 Brazil',region='br',dims=[4.630,1.780,1.455],wb=2.700,overhang=.935,r=.320,spokes=10,
  body=[[-.5,.57,.85],[-.465,.64,.96],[-.30,.68,.99],[-.12,.66,1],[.22,.64,1],[.40,.57,.96],[.5,.51,.88]],cabin=[0.25, 0.08, -0.225, -0.36, 0.66, 0.76],b=0,paint=[.46,.48,.49],
  windows=[[[0.225, 0.697], [0.07, 0.947], [-0.03, 0.954], [-0.03, 0.695]], [[-0.055, 0.695], [-0.055, 0.95], [-0.22, 0.93], [-0.328, 0.7]]],signature='Long low sedan bonnet and separate boot; narrow J headlamps; broad trapezoidal intake; stretched rear lamps'),
 dict(id='vw-t-cross',name='Volkswagen T-Cross',generation='First generation, MY2020 Brazilian long-wheelbase',region='br',dims=[4.199,1.760,1.568],wb=2.651,overhang=.847,r=.326,spokes=5,
  body=[[-.5,.65,.89],[-.46,.72,.99],[-.30,.73,1],[.02,.71,1],[.24,.70,.99],[.43,.68,.97],[.5,.61,.90]],cabin=[0.27, 0.12, -0.395, -0.465, 0.71, 0.81],b=.03,paint=[.64,.32,.16],
  windows=[[[0.242, 0.745], [0.105, 0.95], [-0.055, 0.95], [-0.055, 0.744]], [[-0.081, 0.745], [-0.081, 0.95], [-0.355, 0.949], [-0.421, 0.79]]],signature='Square upright SUV greenhouse; strong wheel cladding; wide VW grille; linked rear lamps in black crossbar'),
 dict(id='fiat-fiorino',name='Fiat Fiorino',generation='Brazilian second generation, MY2022 Endurance facelift',region='br',dims=[4.407,1.643,1.899],wb=2.716,overhang=.856,r=.306,spokes=8,
  body=[[-.5,.51,.92],[-.465,.59,1],[-.26,.60,1],[.04,.58,.99],[.28,.55,.96],[.43,.49,.92],[.5,.43,.83]],cabin=[0.29, 0.15, -0.1, -0.13, 0.56, 0.8],b=0,paint=[.74,.75,.72],
  windows=[[[0.265, 0.59], [0.135, 0.765], [-0.065, 0.766], [-0.065, 0.586]]],signature='Low Uno-derived cab ahead of taller rectangular cargo box; narrow facelift lamps; tall rear corner lamps; split cargo doors'),
 dict(id='ford-fiesta',name='Ford Fiesta',generation='Mk8 five-door Titanium, circa 2018',region='uk',dims=[4.040,1.735,1.476],wb=2.493,overhang=.835,r=.305,spokes=10,
  body=[[-.5,.56,.84],[-.46,.64,.97],[-.31,.68,1],[-.06,.64,1],[.22,.62,.99],[.40,.55,.94],[.5,.48,.83]],cabin=[0.28, 0.125, -0.36, -0.455, 0.64, 0.74],b=0,paint=[.46,.13,.13],
  windows=[[[0.25, 0.68], [0.11, 0.943], [-0.045, 0.958], [-0.045, 0.68]], [[-0.07, 0.684], [-0.07, 0.958], [-0.325, 0.929], [-0.388, 0.742]]],signature='Low oval-trapezoid Ford upper grille; long teardrop lamps; domed roof; horizontal Mk8 rear lights'),
 dict(id='vw-golf',name='Volkswagen Golf',generation='Mk7 facelift five-door, circa 2017',region='uk',dims=[4.258,1.799,1.452],wb=2.637,overhang=.880,r=.316,spokes=5,
  body=[[-.5,.59,.89],[-.46,.66,.99],[-.31,.69,1],[-.06,.66,1],[.22,.64,.99],[.425,.60,.96],[.5,.55,.89]],cabin=[0.27, 0.11, -0.37, -0.46, 0.66, 0.79],b=0,paint=[.25,.28,.31],
  windows=[[[0.24, 0.695], [0.09, 0.948], [-0.06, 0.952], [-0.06, 0.696]], [[-0.085, 0.696], [-0.085, 0.951], [-0.315, 0.925], [-0.363, 0.74]]],signature='Broad C-pillar, straight shoulder, upright hatch; thin grille with twin rectangular lamp units; angular two-piece tail lamps'),
 dict(id='vauxhall-corsa',name='Vauxhall Corsa',generation='Corsa F five-door, circa 2020 (pre-Vizor)',region='uk',dims=[4.060,1.765,1.433],wb=2.538,overhang=.831,r=.308,spokes=8,
  body=[[-.5,.57,.86],[-.46,.65,.98],[-.31,.69,1],[-.02,.65,1],[.23,.63,.99],[.42,.56,.95],[.5,.51,.85]],cabin=[0.28, 0.125, -0.335, -0.445, 0.65, 0.76],b=0,paint=[.32,.48,.40],
  windows=[[[0.245, 0.69], [0.105, 0.942], [-0.045, 0.95], [-0.045, 0.69]], [[-0.07, 0.69], [-0.07, 0.95], [-0.29, 0.924], [-0.355, 0.79]]],signature='Low CMP-platform five-door; narrow wing grille predating Vizor; long blade lamps; contrasting roof and rising rear quarter'),
 dict(id='nissan-qashqai',name='Nissan Qashqai',generation='J11 facelift, circa 2017',region='uk',dims=[4.394,1.806,1.590],wb=2.646,overhang=.925,r=.343,spokes=10,
  body=[[-.5,.57,.87],[-.46,.67,.98],[-.31,.72,1],[-.02,.69,1],[.23,.69,.99],[.41,.61,.95],[.5,.55,.86]],cabin=[0.275, 0.1, -0.355, -0.445, 0.69, 0.77],b=0,paint=[.12,.35,.44],
  windows=[[[0.245, 0.725], [0.08, 0.947], [-0.055, 0.953], [-0.055, 0.726]], [[-0.08, 0.728], [-0.08, 0.952], [-0.315, 0.93], [-0.396, 0.79]]],signature='Swept SUV roof, pinched rear quarter, V-motion grille; boomerang headlight and rear-lamp signatures; deep lower cladding'),
 dict(id='ford-transit-custom',name='Ford Transit Custom',generation='First generation facelift L1H1 panel van, circa 2018',region='uk',dims=[4.973,1.986,1.964],wb=2.933,overhang=1.012,r=.343,spokes=6,
  body=[[-.5,.59,.94],[-.465,.66,1],[-.27,.66,1],[.03,.63,1],[.27,.63,.98],[.43,.615,.94],[.5,.595,.87]],cabin=[0.36, 0.21, -0.445, -0.49, 0.62, 0.88],b=0,paint=[.67,.69,.68],
  windows=[[[0.332, 0.655], [0.197, 0.945], [-0.025, 0.947], [-0.025, 0.653]]],signature='Full-length low-roof van with steep cab screen, large hexagonal facelift grille; slim upper lamps; vertical rear lamps and split doors'),
]
SOURCES={
 'chevrolet-onix':['https://meu.chevrolet.com.br/content/dam/gmownercenter/gmsa/gmbr/dynamic/manuals/2020/chevrolet/OnixPlus/pt/om_ng-chevrolet_Onix%20Plus_my20-pt_BR.pdf.pdf'],
 'hyundai-hb20':['https://www.hyundai.com.br/content/dam/hmb/cars/hb20/2023/catalogos/Catalogo_Digital_Novo_HB20_2023.pdf'],
 'toyota-corolla':['https://www.toyotacomunica.com.br/toyota-apresenta-o-novo-corolla-2020/','https://www.toyotaoman.com/wp-content/uploads/2020/05/Corolla-2020.pdf'],
 'vw-t-cross':['https://www.volkswagen.com.pe/idhub/content/dam/onehub_pkw/importers/pe/ficha_tecnica/01-2024/VWPer%C3%BA_FichaT%C3%A9cnica_%20T-CrossMY2023-2024.pdf','https://www.volkswagen-newsroom.com/en/welcome-to-the-family-the-new-t-cross-4306/the-exterior-4311'],
 'fiat-fiorino':['https://www.media.stellantis.com/br-pt/fiat/nova-fiorino-my-2022','https://www.media.stellantis.com/br-pt/download-model-document/168'],
 'ford-fiesta':['https://media.ford.com/content/dam/fordmedia/Europe/documents/productReleases/Fiesta/FordFiesta2017_FiestaDrive_TechSpecs_EU.pdf','https://media.ford.com/content/dam/fordmedia/Europe/en/2016/11/GF3/NEXT_GEN_FIESTA_TECH_SPEC.pdf'],
 'vw-golf':['https://www.volkswagen-newsroom.com/en/vehicle-data-golf-7-profile-20039'],
 'vauxhall-corsa':['https://media-psa.groupe-psa.com/pm_1_2853_2853737-yp47k772vh.pdf'],
 'nissan-qashqai':['https://www.nissan-cdn.net/content/dam/Nissan/ch/fr/brochures/pkw/qashqai-2017-ebrochure-listedeprix.pdf','https://europe.nissannews.com/en-GB/releases/the-new-nissan-qashqai-premium-enhancements-reinforcing-10-years-of-crossover-leadership'],
 'ford-transit-custom':['https://www.ford.ie/content/dam/guxeu/ie/Documents/Brochures/CVs/BRO-New_transit_custom.pdf']}
SOURCES['vw-t-cross'].insert(0,'https://www.volkswagen.com.ar/idhub/content/dam/onehub_pkw/importers/ar/modelos/t-cross/flyer-especificaciones-t%C3%A9cnicas/Flyer%20T-Cross%20TSI%20MY21%20-%20Mayo%202021.pdf')
# Primary visual evidence complements technical dimensional tables.
SOURCES['chevrolet-onix'].append('https://media.gmc.com/Pages/galleries/br/pt/vehicles/chevrolet/onix/2020-onix-hatch.html')
SOURCES['ford-fiesta'].append('https://www.fr.ford.ch/content/dam/guxeu/ch/fr_ch/documents/feature-pdfs/FT-Fiesta_17.5.pdf')
SOURCES['vw-golf'].append('https://www.volkswagen.se/idhub/content/dam/onehub_pkw/importers/se/hjalp-och-support/broschyrer/golf/tidigare-golf/002.1648_golf_s18_w1.download.pdf')
SOURCES['vauxhall-corsa'] += ['https://www.media.stellantis.com/uk-en/vauxhall/media-library/press-images/509038','https://www.vauxhall.co.uk/content/dam/vauxhall/Home/e-brochures/range/cars/20my/brochures/4_October_2019.pdf']
SEMANTICS=['FleetBody','FleetGlass','FleetTrim','FleetRubber','FleetLights','FleetInterior']
PALETTE={'FleetBody':(1,1,1,1),'FleetGlass':(.055,.11,.15,1),'FleetTrim':(.025,.031,.035,1),'FleetRubber':(.019,.022,.025,1),'FleetLights':(1,.88,.64,1),'FleetInterior':(.033,.04,.048,1)}
SILVER=(.48,.51,.54,1); RED=(.65,.012,.018,1); WHITE=(.93,.96,1,1); AMBER=(1,.29,.02,1)
MATS={}; PARTS=[]
def material(name):
 m=bpy.data.materials.new(name);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.34 if name in ('FleetBody','FleetGlass') else .65
 p.inputs['Metallic'].default_value=.32 if name=='FleetBody' else .08
 if name=='FleetGlass':p.inputs['Roughness'].default_value=.16;p.inputs['Metallic'].default_value=.4
 c=m.node_tree.nodes.new('ShaderNodeVertexColor');c.layer_name='Color';m.node_tree.links.new(c.outputs['Color'],p.inputs['Base Color'])
 m.diffuse_color=PALETTE[name];m.use_backface_culling=True
 return m

def mesh(name,verts,faces,semantic='FleetBody',color=None,smooth=False):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(MATS[semantic]);PARTS.append(ob)
 col=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 for v in col.data:v.color=color or PALETTE[semantic]
 for p in me.polygons:p.use_smooth=smooth
 return ob

def box(name,loc,scale,semantic='FleetBody',color=None,bevel=.015):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mo=o.modifiers.new('edge softening','BEVEL');mo.width=bevel;mo.segments=2
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mo.name)
 me=o.data;me.materials.append(MATS[semantic]);col=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 for v in col.data:v.color=color or PALETTE[semantic]
 PARTS.append(o);return o

def prism(name,points,depth,semantic='FleetTrim',color=None,axis=0):
 # Closed polygon extrusion; source points already in author coordinates.
 n=len(points);vs=[tuple(p) for p in points]+[tuple(p[i]+(depth if i==axis else 0) for i in range(3)) for p in points]
 return mesh(name,vs,[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],semantic,color)

def line(name,points,r=.008,semantic='FleetTrim',color=None):
 # Solid rectangular seams: robust mesh, no curve export dependency.
 for a,b in zip(points,points[1:]):
  a,b=Vector(a),Vector(b);o=box(name,(a+b)/2,(r,r,(b-a).length),semantic,color,0);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()

def cyl(name,loc,r,depth,semantic='FleetRubber',color=None,vertices=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc,rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=name
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 o.data.materials.append(MATS[semantic]);col=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 for c in col.data:c.color=color or PALETTE[semantic]
 for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
 PARTS.append(o);return o

def body(d):
 L,W,H=d['dims'];v=[];f=[]
 stations=[list(q) for q in d['body']]
 stations.insert(1,[stations[0][0]+.014,stations[0][1]+.016,stations[0][2]+.04])
 stations.insert(-1,[stations[-1][0]-.014,stations[-1][1]+.016,stations[-1][2]+.04])
 for u,h,w in stations:
  x=u*L;t=h*H;a=W/2*w
  # Crown bonnet/boot, shoulder break, tucked-in sill, closed floor.
  ring=[(-.77*a,.24),(-.96*a,.31),(-a,t*.70),(-a,t-.07),(-.89*a,t),(-.5*a,t+.023),(0,t+.034),(.5*a,t+.023),(.89*a,t),(a,t-.07),(a,t*.70),(.96*a,.31),(.77*a,.24)]
  if d.get('_onix_curved_ends'):
   v.extend((x-(.18*(abs(y)/max(a,.01))**2*max(0,(x-1.40)/.6815)**2 if x>1.4 else -.14*(abs(y)/max(a,.01))**2*max(0,(-x-1.55)/.5315)**2),y,z) for y,z in ring)
  else:v.extend((x,y,z) for y,z in ring)
 n=13
 for j in range(len(stations)-1):
  for i in range(n):f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 f.extend([tuple(range(n-1,-1,-1)),tuple((len(stations)-1)*n+i for i in range(n))])
 o=mesh('contoured lower body',v,f,smooth=True)
 for p in o.data.polygons:
  if len(p.vertices)>4:p.use_smooth=False
 # Round the stamped metal envelope before cutting true wheel openings.
 # End support loops preserve the reference bumper overhang while softening corners.
 sub=o.modifiers.new('stamped coachwork curvature','SUBSURF');sub.levels=2;sub.render_levels=2
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=sub.name)
 # Apply real wheel openings; keep ambient tyres static.
 for x in (L/2-d['overhang'],L/2-d['overhang']-d['wb']):
  bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=d['r']+.037,depth=W+1,location=(x,0,d['r']),rotation=(math.pi/2,0,0));c=bpy.context.object
  bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('wheel opening','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=c;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(c,do_unlink=True)
 # Boolean-created faces inherit corner colors in Blender; ensure every corner is paint-white.
 for c in o.data.color_attributes['Color'].data:c.color=(1,1,1,1)
 bevel=o.modifiers.new('coachwork edge radius','BEVEL');bevel.width=.022;bevel.segments=3;bevel.harden_normals=True
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
 d['_bodyObject']=o
 return o

def cabin(d):
 L,W,H=d['dims'];a,b,c,e,belt,taper=d['cabin'];top=H if d['id']!='fiat-fiorino' else H*.80
 # Roof shoulder profiles preserve each generation's own rake, crown and rear heel.
 a,b,c,e=[u*L for u in (a,b,c,e)];bottom=belt*H;wb=W*.46;wt=W/2*taper
 camber={'ford-fiesta':.047,'toyota-corolla':.035,'nissan-qashqai':.035,'vauxhall-corsa':.036,'vw-golf':.023,'vw-t-cross':.018,'hyundai-hb20':.033,'fiat-fiorino':.018,'ford-transit-custom':.019}[d['id']]
 keys=[(e,bottom+.012),(c,top-.085),(c+(b-c)*.27,top-.032),(c+(b-c)*.65,top-.030),(b,top-.080),(a,bottom+.012)]
 widths=[(e,wb),(c,wt*1.015),(c+(b-c)*.4,wt),(b,wt*1.025),(a,wb)]
 def curve(keys,x):
  for i in range(len(keys)-1):
   xa,ya=keys[i];xb,yb=keys[i+1]
   if x<=xb:
    t=max(0,min(1,(x-xa)/(xb-xa)));before=keys[max(0,i-1)];after=keys[min(len(keys)-1,i+2)]
    m0=(yb-before[1])/(xb-before[0]);m1=(after[1]-ya)/(after[0]-xa)
    return (2*t**3-3*t*t+1)*ya+(t**3-2*t*t+t)*(xb-xa)*m0+(-2*t**3+3*t*t)*yb+(t**3-t*t)*(xb-xa)*m1
  return keys[-1][1]
 def side_y(x,z):
  t=max(0,min(1,(z-bottom)/max(.01,curve(keys,x)-bottom)))
  return wb+(curve(widths,x)-wb)*t+.012*math.sin(math.pi*t)
 def roof_z(x,y):
  w=curve(widths,x);return curve(keys,x)+camber*(1-(y/w)**2)
 # Side sheets have real window holes; no painted mass sits behind glazing.
 outlines=[[(u*L,min(z*H,curve(keys,u*L)-.025)) for u,z in out] for out in d['windows']]
 outer=[(e,bottom),(a,bottom)]+[(a+(e-a)*i/64,curve(keys,a+(e-a)*i/64)) for i in range(65)]
 for side in (-1,1):
  cu=bpy.data.curves.new('pierced cabin side','CURVE');cu.dimensions='2D';cu.fill_mode='BOTH';cu.resolution_u=1
  for points in [outer]+[list(reversed(out)) for out in outlines]:
   sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
   for v,(x,z) in zip(sp.points,points):v.co=(x,z,0,1)
   sp.use_cyclic_u=True
  ob=bpy.data.objects.new('side template',cu);bpy.context.collection.objects.link(ob)
  bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
  template=ob.data;vs=[(v.co.x,side*side_y(v.co.x,v.co.y),v.co.y) for v in template.vertices];fs=[tuple(p.vertices) for p in template.polygons]
  bpy.data.objects.remove(ob,do_unlink=True)
  shell=mesh('pierced curved cabin side',vs,fs,'FleetTrim' if d['id']=='vauxhall-corsa' else 'FleetBody',smooth=True)
  solid=shell.modifiers.new('thin stamped pillar sheet','SOLIDIFY');solid.thickness=.008
  bpy.context.view_layer.objects.active=shell;bpy.ops.object.modifier_apply(modifier=solid.name)
 # Roof grid aligns exactly with screen opening boundaries.
 xs=sorted(set([e+(a-e)*i/64 for i in range(65)]+[e+(c-e)*.07,e+(c-e)*.95,a+(b-a)*.07,a+(b-a)*.95]))
 us=[-1,-.9,-.75,-.5,-.25,0,.25,.5,.75,.9,1];vs=[];fs=[];n=len(us)
 for x in xs:
  for u in us:
   y=curve(widths,x)*u;vs.append((x,y,roof_z(x,y)))
 for i in range(len(xs)-1):
  x=(xs[i]+xs[i+1])/2
  screen=(a+(b-a)*.95<x<a+(b-a)*.07) or (d['id'] not in ('fiat-fiorino','ford-transit-custom') and e+(c-e)*.07<x<e+(c-e)*.95)
  for j in range(n-1):
   if screen and abs((us[j]+us[j+1])/2)<.9:continue
   q=i*n+j;fs.append((q,q+1,q+n+1,q+n))
 roof=mesh('curved roof with screen apertures',vs,fs,'FleetTrim' if d['id']=='vauxhall-corsa' else 'FleetBody',smooth=True)
 solid=roof.modifiers.new('roof sheet thickness','SOLIDIFY');solid.thickness=.008
 bpy.context.view_layer.objects.active=roof;bpy.ops.object.modifier_apply(modifier=solid.name)
 def closed_skin(name,vs,fs,sem,delta):
  n=len(vs);front=list(fs);vs += [tuple(Vector(v)+Vector(delta)) for v in vs]
  fs += [tuple(i+n for i in reversed(f)) for f in front]
  edges={}
  for f in front:
   for a0,b0 in zip(f,f[1:]+f[:1]):
    k=tuple(sorted((a0,b0)));edges[k]=edges.get(k,0)+1
  fs += [(a0,b0,b0+n,a0+n) for (a0,b0),count in edges.items() if count==1]
  return mesh(name,vs,fs,sem,smooth=True)
 # Screen points follow the same curved roof surface, including the upper edge.
 for front,x0,x1 in [(True,a,b),(False,e,c)]:
  if not front and d['id'] in ('fiat-fiorino','ford-transit-custom'):continue
  vs=[];fs=[];nu=21;nv=13
  for j in range(nv):
   t=.07+.88*j/(nv-1);x=x0+(x1-x0)*t
   for i in range(nu):
    u=-.90+1.8*i/(nu-1);y=curve(widths,x)*u
    vs.append((x+(.009 if front else -.009),y,roof_z(x,y)+.007))
  for j in range(nv-1):
   for i in range(nu-1):q=j*nu+i;fs.append((q,q+1,q+nu+1,q+nu))
  closed_skin('fitted windscreen' if front else 'fitted rear screen',vs,fs,'FleetGlass',(-.006 if front else .006,0,-.004))
 def side_panel(name,outline,side,sem,offset):
  boundary=[]
  for i,p in enumerate(outline):
   q=outline[(i+1)%len(outline)]
   for j in range(8):boundary.append(Vector(p).lerp(Vector(q),j/8))
  center=sum(boundary,Vector((0,0)))/len(boundary);n=len(boundary);vs=[];fs=[]
  if name=='window seal':
   for scale in (.955,1):
    for p in boundary:
     x,z=center+(p-center)*scale;vs.append((x,side*(side_y(x,z)+offset),z))
   for j in range(n):q=(j+1)%n;fs.append((j,q,q+n,j+n))
   return closed_skin(name,vs,fs,sem,(0,-side*.005,0))
  for ring in range(1,5):
   for p in boundary:
    x,z=center+(p-center)*ring/4;vs.append((x,side*(side_y(x,z)+offset),z))
  vs.append((center.x,side*(side_y(center.x,center.y)+offset),center.y))
  for j in range(n):fs.append((4*n,j,(j+1)%n))
  for r in range(3):
   for j in range(n):q=r*n+j;v=r*n+(j+1)%n;fs.append((q,v,v+n,q+n))
  return closed_skin(name,vs,fs,sem,(0,-side*.005,0))
 for side in (-1,1):
  for n,outline in enumerate(d['windows']):
   # Clamp glass below the curved shoulder; model-specific outlines retain their quarters.
   coords=[(u*L,min(z*H,curve(keys,u*L)-.025)) for u,z in outline]
   side_panel('window seal',coords,side,'FleetTrim',.009)
   center=sum((Vector(v) for v in coords),Vector((0,0)))/len(coords)
   inside=[tuple(center+(Vector(p)-center)*.955) for p in coords]
   side_panel('curved side glazing',inside,side,'FleetGlass',.016)
  if len(d['windows'])>1:
   x0=d['windows'][0][-1][0]*L;x1=d['windows'][1][0][0]*L
   side_panel('black B pillar',[(x0+.012,bottom+.025),(x0+.012,curve(keys,x0)-.012),(x1-.012,curve(keys,x1)-.012),(x1-.012,bottom+.025)],side,'FleetTrim',.021)
  if d['id']=='hyundai-hb20':
   pillar=[(-.35*L,side*W*.382,H*.94),(-.42*L,side*W*.445,H*.75),(-.45*L,side*W*.454,H*.74),(-.365*L,side*W*.389,H*.954)]
   prism('HB20 floating quarter pillar',pillar,side*.01,'FleetTrim',axis=1)
  # B pillar and door seams run through body to the sill, avoiding wheel opening.
  seams=[-.063] if len(d['windows'])>1 else [-.075]
  for u in seams:
   line('door shut',[(u*L,side*W*.497,.39),(u*L,side*W*.499,bottom-.045)],.008)
  for u in ([.11,-.245] if len(d['windows'])>1 else [.015]):
   box('recess door handle',(u*L,side*W*.498,bottom-.09),(.14,.019,.023),'FleetTrim',bevel=.009)
  # Mirror stems and closed mirror housings with glass rear surface.
  mx=a-.07;my=side*(W/2+.072);mz=bottom+.04
  box('mirror stalk',(mx,side*(W/2+.005),mz-.03),(.055,.14,.028),'FleetTrim',bevel=.007)
  box('mirror housing',(mx,my,mz),(.17,.13,.085),'FleetBody',bevel=.03)
  box('mirror silver',(mx-.089,my,mz),(.006,.097,.055),'FleetTrim',SILVER,.005)
 # Minimal cabin silhouettes; position steering wheel on correct regional side.
 box('dashboard',(a-.16,0,bottom-.015),(.24,W*.78,.16),'FleetInterior',bevel=.035)
 for sx in (-.12,-.28):
  if d['id'] in ('fiat-fiorino','ford-transit-custom') and sx==-.28:continue
  for side in (-1,1):
   box('seat back',(sx*L,side*W*.23,bottom-.05),(.14,.39,.50),'FleetInterior',bevel=.05)
   box('headrest',(sx*L,side*W*.23,bottom+.20),(.12,.24,.17),'FleetInterior',bevel=.035)
 steering_side=-1 if d['region']=='uk' else 1
 # Author +Y is vehicle left; glTF export maps to -Z.
 cyl('steering wheel silhouette',(a-.48,steering_side*W*.22,bottom+.055),.11,.023,'FleetInterior',vertices=20)

def wheel(d):
 L,W,H=d['dims'];r=d['r'];front=L/2-d['overhang'];rear=front-d['wb'];track=W-.22
 for axle,x in [('front',front),('rear',rear)]:
  for s in (-1,1):
   y=s*track/2
   cyl('static tyre',(x,y,r),r,.20)
   outer=y+s*.104
   cyl('alloy rim',(x,outer,r),r*.69,.012,'FleetTrim',SILVER)
   cyl('dark inset',(x,outer+s*.009,r),r*.54,.013,'FleetTrim')
   n=d['spokes']
   for i in range(n):
    a=2*math.pi*i/n
    o=box('wheel spoke',(x+math.sin(a)*r*.32,outer+s*.019,r+math.cos(a)*r*.32),(r*.09,.021,r*.53),'FleetTrim',SILVER,.004);o.rotation_euler[1]=a
   cyl('hub',(x,outer+s*.028,r),r*.17,.018,'FleetTrim',SILVER,vertices=20)
   # Dark closed arch liners; arch outer body paint remains interrupted by real opening.
   vs=[]
   for j in range(21):
    a=math.pi*j/20
    for rr in (r+.023,r+.052):vs.append((x+math.cos(a)*rr,s*(W/2-.012),r+math.sin(a)*rr))
   for j in range(20):
    prism('wheel arch lip',[vs[j*2],vs[j*2+1],vs[j*2+3],vs[j*2+2]],s*.014,'FleetTrim' if d['id'] in ('vw-t-cross','nissan-qashqai','ford-transit-custom','fiat-fiorino') else 'FleetBody',axis=1)
 return front,rear,track

def face(d,front,outline,sem='FleetTrim',color=None,name='fascia detail',offset=0):
 # Subdivided fascia patches follow the actual stamped nose/boot surface.
 L,W,H=d['dims'];layer=.009+abs(offset)+(.012 if color==SILVER else 0);direction=1 if front else -1;outline=[Vector((y*W/2,z)) for y,z in outline]
 center=sum(outline,Vector((0,0)))/len(outline)
 def point(y,z,depth):
  hit,loc,normal,index=d['_bodyObject'].ray_cast(Vector((direction*(L/2+1),y,z)),Vector((-direction,0,0)))
  x=loc.x if hit else direction*(L/2-.09*(abs(y)/(W/2))**2)
  return (x+direction*depth,y,z)
 if name=='headlight lens':d.setdefault('_frontLampPoints',[]).append(point(center.x,center.y,layer))
 from mathutils.geometry import tessellate_polygon
 vs=[];fs=[];lookup={};steps=6
 def vertex(p):
  key=(round(p.x,8),round(p.y,8))
  if key not in lookup:lookup[key]=len(vs);vs.append(point(p.x,p.y,layer))
  return lookup[key]
 # Triangulate the actual outline before projection: concave V/chrome/hook shapes stay hollow.
 for tri in tessellate_polygon([[Vector((p.x,p.y,0)) for p in outline]]):
  aa,bb,cc=[outline[v] if isinstance(v,int) else Vector((v.x,v.y)) for v in tri];grid={}
  for i in range(steps+1):
   for j in range(steps+1-i):grid[i,j]=vertex(aa+(bb-aa)*i/steps+(cc-aa)*j/steps)
  for i in range(steps):
   for j in range(steps-i):
    fs.append((grid[i,j],grid[i+1,j],grid[i,j+1]))
    if i+j<steps-1:fs.append((grid[i+1,j],grid[i+1,j+1],grid[i,j+1]))
 count=len(vs);front=list(fs);vs += [(x-direction*.006,y,z) for x,y,z in vs]
 fs += [tuple(i+count for i in reversed(f)) for f in front]
 edges={}
 for f in front:
  for a,b in zip(f,f[1:]+f[:1]):
   key=tuple(sorted((a,b)));edges[key]=edges.get(key,0)+1
 fs += [(a,b,b+count,a+count) for (a,b),n in edges.items() if n==1]

 return mesh(name,vs,fs,sem,color,smooth=True)

def rectangle(d,front,y0,y1,z0,z1,sem='FleetTrim',color=None,name='fascia detail',offset=0):
 return face(d,front,[(y0,z0),(y1,z0),(y1,z1),(y0,z1)],sem,color,name,offset)

def identity(d):
 k=d['id'];L,W,H=d['dims'];nose=d['body'][-1][1]*H;tail=d['body'][0][1]*H
 # All ten front masks are separately laid out from the relevant generation.
 if k=='chevrolet-onix':
  face(d,1,[(-.60,.37),(.60,.37),(.73,.63),(-.73,.63)])
  rectangle(d,1,-.43,.43,.69,.765)
  rectangle(d,1,-.75,.75,.647,.677,'FleetTrim',SILVER)
  lamps=[(.43,.72),(.87,.73),(.81,.84),(.54,.815)]
 elif k=='hyundai-hb20':
  face(d,1,[(-.72,.34),(.72,.34),(.79,.57),(.54,.74),(-.54,.74),(-.79,.57)])
  lamps=[(.40,.77),(.86,.73),(.82,.86),(.51,.87)]
  for z in (.43,.51,.59):rectangle(d,1,-.65,.65,z,z+.012,'FleetTrim',(.09,.105,.12,1))
 elif k=='toyota-corolla':
  face(d,1,[(-.72,.33),(.72,.33),(.59,.65),(-.59,.65)])
  rectangle(d,1,-.38,.38,.68,.724)
  lamps=[(.31,.715),(.86,.70),(.84,.82),(.48,.81)]
  for z in (.39,.46,.53):rectangle(d,1,-.62,.62,z,z+.011,'FleetTrim',(.1,.11,.12,1))
 elif k=='vw-t-cross':
  rectangle(d,1,-.78,.78,.72,.94)
  for z in (.75,.82,.9):rectangle(d,1,-.73,.73,z,z+.018,'FleetTrim',SILVER)
  lamps=[(.43,.79),(.86,.79),(.86,.99),(.43,.99)]
  rectangle(d,1,-.77,.77,.35,.55)
 elif k=='fiat-fiorino':
  face(d,1,[(-.65,.41),(.65,.41),(.72,.66),(-.72,.66)])
  lamps=[(.35,.70),(.85,.72),(.80,.84),(.42,.85)]
  rectangle(d,1,-.85,.85,.31,.44)
 elif k=='ford-fiesta':
  face(d,1,[(-.39,.42),(.39,.42),(.64,.64),(.49,.72),(-.49,.72),(-.64,.64)])
  for z in (.48,.54,.60,.66):rectangle(d,1,-.43,.43,z,z+.013,'FleetTrim',SILVER)
  lamps=[(.54,.69),(.88,.69),(.78,.88),(.60,.84)]
 elif k=='vw-golf':
  rectangle(d,1,-.83,.83,.69,.79)
  rectangle(d,1,-.8,.8,.732,.75,'FleetTrim',SILVER)
  lamps=[(.38,.68),(.86,.68),(.83,.84),(.41,.84)]
  rectangle(d,1,-.79,.79,.36,.51)
 elif k=='vauxhall-corsa':
  face(d,1,[(-.45,.65),(.45,.65),(.52,.77),(-.52,.77)])
  rectangle(d,1,-.47,.47,.714,.732,'FleetTrim',SILVER)
  lamps=[(.43,.72),(.88,.69),(.83,.84),(.46,.82)]
  face(d,1,[(-.68,.34),(.68,.34),(.60,.51),(-.60,.51)])
 elif k=='nissan-qashqai':
  face(d,1,[(-.35,.53),(.35,.53),(.57,.95),(-.57,.95)])
  face(d,1,[(-.56,.96),(-.37,.57),(.37,.57),(.56,.96),(.44,.96),(.29,.69),(-.29,.69),(-.44,.96)],'FleetTrim',SILVER)
  lamps=[(.48,.82),(.89,.80),(.83,1.00),(.56,.96)]
  rectangle(d,1,-.77,.77,.32,.45)
 else:
  face(d,1,[(-.55,.53),(.55,.53),(.70,.82),(.53,1.03),(-.53,1.03),(-.70,.82)])
  for z in (.62,.72,.82,.92):rectangle(d,1,-.52,.52,z,z+.02,'FleetTrim',SILVER)
  lamps=[(.51,1.06),(.88,1.02),(.84,1.20),(.58,1.21)]
  rectangle(d,1,-.85,.85,.30,.46)
 d['_headlightHeight']=sum(z for y,z in lamps)/len(lamps)
 d['_headlightHalfWidth']=sum(y for y,z in lamps)/len(lamps)*W/2
 # Angular headlamp enclosure and two-tone lens create model-specific front identity.
 for s in (-1,1):
  p=[(s*y,z) for y,z in lamps];face(d,1,p,'FleetTrim',name='headlight dark housing',offset=.009)
  cy=sum(a[0] for a in p)/len(p);cz=sum(a[1] for a in p)/len(p)
  inset=[(cy+(y-cy)*.84,cz+(z-cz)*.72) for y,z in p];face(d,1,inset,'FleetLights',WHITE,'headlight lens',.019)
  # Side wrap connects lighting to fender instead of disconnected front-only decal.
  x=L/2-.10;y=s*W*.43;z=sum(a[1] for a in lamps)/4
  # Lens patch itself wraps onto the stamped nose; no floating fender block.
  # Lower corner insert and foglamp for readable bumper volume.
  box('lower bumper corner',(L/2-.055,s*W*.35,.43),(.06,.20,.12),'FleetTrim',bevel=.018)
 # Minimal badge geometric medallion; no text texture, no user-facing copy.
 if k=='chevrolet-onix':
  face(d,1,[(-.105,.682),(-.045,.682),(-.045,.667),(.045,.667),(.045,.682),(.105,.682),(.105,.717),(.045,.717),(.045,.732),(-.045,.732),(-.045,.717),(-.105,.717)],'FleetTrim',(.8,.55,.14,1),offset=.025)
 else:box('brand medallion',(L/2+.014,0,.78 if k!='ford-transit-custom' else .98),(.012,.12,.065),'FleetTrim',SILVER,.025)
 # Rear lighting: each generation's topology, not one shared rectangle.
 if k in ('fiat-fiorino','ford-transit-custom'):
  top=1.46 if k=='fiat-fiorino' else 1.57
  d['_tailLampHeight']=(.65+top)/2
  for s in (-1,1):
   rectangle(d,0,s*.79,s*.94,.65,top,'FleetLights',RED)
   rectangle(d,0,s*.80,s*.93,.81,.96,'FleetLights',WHITE,offset=-.01)
  # Separate hinged cargo doors with hinges, recessed handle and bumper step.
  line('cargo split',[(-L/2-.012,0,.51),(-L/2-.012,0,H-.12)],.012)
  for s in (-1,1):
   for z in (.72,1.46):box('cargo hinge',(-L/2-.025,s*W*.37,z),(.055,.08,.05),'FleetTrim',bevel=.006)
  box('rear cargo handle',(-L/2-.018,-W*.12,1.02),(.025,.16,.04),'FleetTrim',bevel=.008)
  rectangle(d,0,-.90,.90,.27,.48)
 elif k in ('hyundai-hb20','vw-t-cross'):
  h=.86 if k=='hyundai-hb20' else 1.00
  d['_tailLampHeight']=h
  rectangle(d,0,-.87,.87,h-.04,h+.07,'FleetTrim')
  rectangle(d,0,-.79,.79,h+.008,h+.04,'FleetLights',RED,offset=-.009)
  for s in (-1,1):face(d,0,[(s*.54,h-.015),(s*.87,h-.015),(s*.87,h-.22),(s*.74,h-.22),(s*.74,h-.06),(s*.54,h-.06)],'FleetLights',RED,offset=-.01)
 else:
  if k=='chevrolet-onix':p=[(.54,.75),(.87,.75),(.86,.89),(.64,.93),(.64,.88),(.79,.86),(.79,.80),(.54,.80)]
  elif k=='toyota-corolla':p=[(.30,.72),(.91,.73),(.88,.89),(.64,.91),(.53,.85),(.30,.83)]
  elif k=='ford-fiesta':p=[(.43,.77),(.89,.73),(.88,.91),(.68,.95),(.52,.89)]
  elif k=='vw-golf':p=[(.40,.73),(.90,.73),(.87,.94),(.46,.90)]
  elif k=='vauxhall-corsa':p=[(.40,.73),(.89,.72),(.86,.90),(.60,.88),(.45,.82)]
  else:p=[(.40,.89),(.88,.78),(.88,1.06),(.69,1.10),(.53,1.00),(.73,1.01),(.73,.91)]
  d['_tailLampHeight']=sum(z for y,z in p)/len(p)
  for s in (-1,1):
   q=[(s*y,z) for y,z in p];cy=sum(y for y,z in q)/len(q);cz=sum(z for y,z in q)/len(q)
   face(d,0,[(cy+(y-cy)*1.08,cz+(z-cz)*1.12) for y,z in q],'FleetTrim',offset=-.006,name='tail lamp bezel')
   face(d,0,q,'FleetLights',RED,offset=-.017)
   box('tail lamp side return',(-L/2+.12,s*W*.43,sum(z for y,z in p)/len(p)),(.24,.045,.095),'FleetLights',RED,.02)
 if k not in ('fiat-fiorino','ford-transit-custom'):
  x=-L/2-.012
  line('tailgate shut',[(x,-W*.34,.41),(x,-W*.37,.65),(x,-W*.38,tail-.02)],.007)
  line('tailgate shut',[(x,W*.34,.41),(x,W*.37,.65),(x,W*.38,tail-.02)],.007)
  box('rear bumper lower',(-L/2+.017,0,.32),(.07,W*.78,.105),'FleetTrim',bevel=.025)
  box('rear badge',(x-.01,0,tail-.10),(.015,.095,.06),'FleetTrim',SILVER,.022)
  if k!='toyota-corolla':
   cr=d['cabin'];bz=cr[4]*H;rx=cr[3]*L+(cr[2]-cr[3])*L*.18
   line('rear wiper',[(rx-.016,-.22,bz+(H-bz)*.18),(rx-.016,.17,bz+(H-bz)*.18)],.010)
 # Neutral plates, UK rear yellow. No authored registration.
 for front in (True,False):
  x=(L/2+.021)*(1 if front else -1);z=.58 if front else .60
  if d['id'] in ('fiat-fiorino','ford-transit-custom') and not front:z=.64
  box('plate recess',(x,0,z),(.021,.49,.115),'FleetTrim',bevel=.008)
  col=(.95,.68,.045,1) if d['region']=='uk' and not front else (.82,.86,.88,1)
  box('neutral plate',(x+(.012 if front else -.012),0,z),(.005,.43,.085),'FleetLights',col,.005)
  if d['region']=='br':box('plate blue header',(x+(.016 if front else -.016),0,z+.032),(.005,.43,.014),'FleetLights',(.015,.13,.5,1),0)
 # Door lower sculpture and shut lines, integral trim break.
 for s in (-1,1):
  line('shoulder crease',[(L*.23,s*W*.496,H*.60),(-L*.31,s*W*.497,H*.64)],.008,'FleetBody')
  box('sill',(0,s*W*.466,.29),(d['wb']-.68,.06,.085),'FleetTrim' if k in ('nissan-qashqai','vw-t-cross','ford-transit-custom') else 'FleetBody',bevel=.012)
 if k in ('vw-t-cross','nissan-qashqai'):
  for s in (-1,1):
   line('roof rail',[(L*.025,s*W*.34,H+.012),(-L*.29,s*W*.34,H+.012)],.025,'FleetTrim',SILVER)
 if k=='fiat-fiorino':
  # Brazilian cargo body rises distinctly above its passenger-car cab.
  box('raised cargo box',(-L*.285,0,H*.656),(L*.42,W*.99,H*.688),'FleetBody',bevel=.065)
  # box min rear matches -L/2; exact envelope corrected at finish.
  for s in (-1,1):
   box('cargo rubbing strip',(-L*.28,s*W*.50,.70),(L*.39,.035,.16),'FleetTrim',bevel=.018)
   line('cargo panel seam',[(-L*.45,s*W*.498,1.67),(-L*.13,s*W*.498,1.67),(-L*.13,s*W*.498,.87)],.008,'FleetTrim',(.20,.22,.23,1))
 if k=='ford-transit-custom':
  # High opaque cargo sides, full-length roof, sliding door and rail.
  for s in (-1,1):
   coords=[(-L*.47,s*W*.464,H*.66),(-L*.47,s*W*.441,H*.96),(-L*.05,s*W*.441,H*.965),(-L*.05,s*W*.464,H*.65)]
   prism('cargo upper side',coords,s*.018,'FleetBody',axis=1)
   line('sliding door perimeter',[(-L*.045,s*W*.481,.48),(-L*.045,s*W*.479,1.78),(-L*.33,s*W*.479,1.78),(-L*.33,s*W*.481,.48)],.009)
   line('sliding rail',[(-L*.09,s*W*.498,1.16),(-L*.45,s*W*.498,1.16)],.018)
   box('sliding handle',(-L*.10,s*W*.504,1.04),(.15,.025,.035),'FleetTrim',bevel=.009)
 # Underbody, axles, exhaust: 360 closed construction, nothing floats below tyre ground.
 box('undertray',(0,0,.235),(L*.77,W*.70,.07),'FleetInterior',bevel=.035)
 for ax in (L/2-d['overhang'],L/2-d['overhang']-d['wb']):cyl('axle',(ax,0,d['r']),.045,W*.8,'FleetInterior',vertices=12)

def finalize(d):
 # Collapse authoring objects to exactly one mesh per semantic material.
 result=[]
 for sem in SEMANTICS:
  obs=[o for o in list(bpy.context.scene.objects) if o.type=='MESH' and o.data.materials and o.data.materials[0].name==sem]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name=sem
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  # Vertex colors survive joins/booleans; recalc normals after all transforms.
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
  o.data.calc_loop_triangles()
  for v in o.data.vertices:assert all(math.isfinite(q) for q in v.co)
  for p in o.data.polygons:assert p.normal.length>.5
  result.append(o)
 # Front details exceed bumper by centimetres; keep source L and ground origin exactly by scaling X.
 allv=[v.co for o in result for v in o.data.vertices];lo=[min(v[i] for v in allv) for i in range(3)];hi=[max(v[i] for v in allv) for i in range(3)]
 L,W,H=d['dims'];sz=H/(hi[2]-lo[2])
 front=L/2-d['overhang'];rear=front-d['wb']
 # Normalize the bumper extremities without moving the measured axle centres.
 def fit_x(x):
  if x>front:return front+(x-front)*(L/2-front)/(hi[0]-front)
  if x<rear:return rear+(x-rear)*(-L/2-rear)/(lo[0]-rear)
  return x
 for o in result:
  for v in o.data.vertices:v.co.x=fit_x(v.co.x);v.co.z=(v.co.z-lo[2])*sz
  o.data.update()
 # Authoring axle coordinates are transformed by final envelope normalization.
 halftrack=(W-.22)/2
 metrics={'length':L,'bodyWidth':W,'height':H,'wheelbase':round(front-rear,6),'sourceWheelbase':d['wb'],'widthIncludingMirrors':round(hi[1]-lo[1],6)}
 axles={'front':round(front,6),'rear':round(rear,6),'height':round(d['r']*sz,6),'halfTrack':halftrack,'wheelRadius':round(d['r']*sz,6)}
 rearHalfWidth=W*(.4325 if d['id'] in ('fiat-fiorino','ford-transit-custom') else .35)
 if d['id']=='chevrolet-onix':d['_headlightHeight']=.778;d['_headlightHalfWidth']=.585
 frontHalfWidth=d.get('_headlightHalfWidth',W*.32)
 frontPoints=d.get('_frontLampPoints',[(L/2-.18*(.585/(.865*.84))**2+.002,y,.778) for y in (-.585,.585)])
 beam={'front':[[round(fit_x(x),6),round((z-lo[2])*sz,6),round(-y,6)] for x,y,z in frontPoints],'rear':[[-L/2,round(d['_tailLampHeight']*sz,6),z] for z in [-rearHalfWidth,rearHalfWidth]]}
 # glTF coordinates x/y/z; author Y becomes negative glTF Z.
 return result,metrics,axles,beam

def build(d):
 global PARTS,MATS
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for datablocks in (bpy.data.meshes,bpy.data.materials):
  for data in list(datablocks):
   if data.users==0:datablocks.remove(data)
 PARTS=[];MATS={s:material(s) for s in SEMANTICS}
 if d['id']=='chevrolet-onix':
  sys.path.insert(0,str(HERE));from onix import build_onix
  build_onix(d,globals())
 else:body(d);cabin(d);wheel(d);identity(d)
 obs,dims,axles,beams=finalize(d)
 for o in obs:
  if o.name=='FleetBody':
   # White vertex colors are essential for runtime body paint multiplication.
   for c in o.data.color_attributes['Color'].data:c.color=(1,1,1,1)
 o=bpy.data.objects.new(d['id'],None);bpy.context.collection.objects.link(o)
 for child in obs:child.parent=o
 bpy.ops.object.select_all(action='SELECT');OUT.mkdir(parents=True,exist_ok=True);(HERE/'poc').mkdir(exist_ok=True)
 path=HERE/'poc'/f"{d['id']}.glb"
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_vertex_color='ACTIVE',export_texcoords=False,export_attributes=False,export_cameras=False,export_lights=False,export_extras=False)
 shutil.copyfile(path,OUT/path.name)
 # Local author file deliberately stays in /tmp; deterministic source is this script.
 bpy.ops.wm.save_as_mainfile(filepath=str(EVIDENCE/f"{d['id']}.blend"))
 tris=sum(len(o.data.loop_triangles) for o in obs);verts=sum(len(o.data.vertices) for o in obs)
 return dict(id=d['id'],name=d['name'],generation=d['generation'],region=d['region'],path=f"assets/vehicles/{d['id']}.glb",dimensions=dims,axles=axles,beamAnchors=beams,materials=SEMANTICS,meshCount=len(obs),triangles=tris,vertices=verts,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),signature=d['signature'],sources=SOURCES[d['id']],referenceLimit='Manufacturer dimensions; contours and detailed lamp/axle locations interpreted from visual references, not CAD measurements.',author='Original procedural Blender geometry; no external meshes or photographic textures')

def validate_export(record):
 """Self-check serialized data, including axes and color material contract."""
 p=ROOT/record['path'];raw=p.read_bytes();assert raw[:4]==b'glTF'
 n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=raw[28+n:]
 assert len(g['meshes'])==6
 assert sorted(m['name'] for m in g['materials'])==sorted(SEMANTICS)
 assert not any(m.get('doubleSided',False) for m in g['materials'])
 def values(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];components={'VEC3':3,'VEC4':4,'SCALAR':1}[a['type']]
  code,size={5126:('f',4),5125:('I',4),5123:('H',2),5121:('B',1)}[a['componentType']]
  offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',components*size)
  return [struct.unpack_from('<'+code*components,binary,offset+j*stride) for j in range(a['count'])]
 points=[];triangles=0;export_vertices=0
 for mesh in g['meshes']:
  assert len(mesh['primitives'])==1
  for pr in mesh['primitives']:
   a=pr['attributes'];assert all(k in a for k in ('POSITION','NORMAL','COLOR_0'))
   pts=values(a['POSITION']);normals=values(a['NORMAL']);points+=pts;export_vertices+=len(pts)
   assert len(pts)==len(normals)
   assert all(all(math.isfinite(c) for c in p) for p in pts)
   assert all(all(math.isfinite(c) for c in n) and abs(sum(c*c for c in n)-1)<.001 for n in normals)
   ind=values(pr['indices']);triangles+=len(ind)//3;assert all(0<=i[0]<len(pts) for i in ind)
 lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
 assert abs(lo[1])<1e-5 and abs(hi[1]-record['dimensions']['height'])<1e-5
 assert abs(lo[0]+record['dimensions']['length']/2)<1e-5 and abs(hi[0]-record['dimensions']['length']/2)<1e-5
 assert p.read_bytes()==(HERE/'poc'/p.name).read_bytes()
 assert triangles==record['triangles']
 return {'id':record['id'],'finitePositionsNormals':True,'unitNormals':True,'outwardNormalsRecalculated':True,'doubleSided':False,'meshPrimitives':6,'colorAttributes':True,'pocProductionByteEqual':True,'boundsGLTF':{'min':lo,'max':hi},'triangles':triangles,'exportVertices':export_vertices}

if __name__=='__main__':
 EVIDENCE.mkdir(parents=True,exist_ok=True)
 args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 selected=[d for d in MODELS if not args or d['id'] in args]
 records=[build(d) for d in selected]
 checks=[validate_export(r) for r in records]
 (EVIDENCE/'validation.json').write_text(json.dumps(checks,indent=2)+'\n')
 if len(records)<10 and (HERE/'models.json').exists():
  old=json.loads((HERE/'models.json').read_text())['models'];new={r['id']:r for r in records};records=[new.get(r['id'],r) for r in old]
 if len(records)==10:(HERE/'models.json').write_text(json.dumps({'schemaVersion':1,'units':'metres','coordinates':'+X forward, +Y up, centered ground origin','models':records},indent=2)+'\n')
 print('FLEET_RESULT '+json.dumps([{k:r[k] for k in ('id','triangles','meshCount','bytes')} for r in records]))
