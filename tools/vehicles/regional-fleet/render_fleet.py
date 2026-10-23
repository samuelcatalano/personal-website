"""Render exported fleet: blender -b -P render_fleet.py [-- id ...].
Writes beauty and front/side/rear/opposite/top/underside diagnostics to /tmp evidence.
No source/production changes. Uses authored .blend from deterministic builder.
"""
import sys
sys.dont_write_bytecode=True
if '--sheets' in sys.argv:
 from PIL import Image,ImageDraw,ImageFont
 from pathlib import Path
 import json
 root=Path('/private/tmp/regional-fleet-pass/asset-evidence');meta=json.load(open('tools/vehicles/regional-fleet/models.json'))['models']
 font=ImageFont.load_default(size=18);small=ImageFont.load_default(size=13)
 sheet=Image.new('RGB',(1600,840),'#202831');dr=ImageDraw.Draw(sheet)
 for i,m in enumerate(meta):
  p=root/m['id']/'beauty.png'
  if not p.exists():continue
  im=Image.open(p).convert('RGB');im.thumbnail((320,190));x=(i%5)*320;y=(i//5)*420+40
  # Each column gets front 3/4 and rear for immediate silhouette + signature review.
  sheet.paste(im,(x,y));dr.text((x+10,y-28),m['name'],font=font,fill='white');dr.text((x+10,y+194),m['generation'][:43],font=small,fill='#c7d5e0')
  rear=Image.open(root/m['id']/'rear.png').convert('RGB');rear.thumbnail((320,170));sheet.paste(rear,(x,y+220))
 sheet.save(root/'fleet-contact.png')
 views=['front','side','rear','opposite','top','underside'];s=Image.new('RGB',(1800,2800),'#202831');draw=ImageDraw.Draw(s)
 for i,m in enumerate(meta):
  y=i*280;draw.text((10,y+5),m['name']+' | '+m['generation'],font=font,fill='white')
  for j,v in enumerate(views):
   p=root/m['id']/(v+'.png')
   if p.exists():
    im=Image.open(p).convert('RGB');im.thumbnail((300,210));s.paste(im,(j*300,y+32));draw.text((j*300+5,y+225),v,font=small,fill='white')
 s.save(root/'fleet-diagnostics.png')
 sys.exit(0)
import bpy,math,sys,json
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from build_fleet import MODELS,EVIDENCE
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
VIEWS={'beauty':(38,25),'front':(0,10),'side':(90,0),'rear':(180,10),'opposite':(270,10),'top':(90,89.9),'underside':(90,-55)}
if '--prototype' in args:
 VIEWS={k:v for k,v in VIEWS.items() if k in ('beauty','side')}
 args.remove('--prototype')
for d in MODELS:
 if args and d['id'] not in args:continue
 bpy.ops.wm.open_mainfile(filepath=str(EVIDENCE/f"{d['id']}.blend"))
 sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE';sc.render.resolution_x=640;sc.render.resolution_y=380;sc.render.resolution_percentage=100
 sc.render.image_settings.file_format='PNG';sc.render.film_transparent=False
 sc.view_settings.view_transform='AgX'
 world=bpy.data.worlds.new('studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.18,.22,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6;sc.world=world
 # Beauty body paint differs by model; GLB itself retains neutral vertex colors for runtime paints.
 mat=bpy.data.materials['FleetBody'];p=mat.node_tree.nodes.get('Principled BSDF')
 for link in list(mat.node_tree.links):
  if link.to_socket==p.inputs['Base Color']:mat.node_tree.links.remove(link)
 p.inputs['Base Color'].default_value=(*d['paint'],1)
 for name,loc,power,size in [('key',(3,-4,6),1000,5),('fill',(-3,4,4),750,4),('rim',(-4,-2,4),800,3)]:
  light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size
  ob=bpy.data.objects.new(name,light);sc.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,.7))-ob.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio ground';ground.location.z=-.012
 m=bpy.data.materials.new('ground');m.diffuse_color=(.09,.105,.12,1);ground.data.materials.append(m)
 cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));sc.collection.objects.link(cam);sc.camera=cam;cam.data.type='ORTHO';cam.data.lens=55
 center=Vector((0,0,d['dims'][2]*.45))
 out=EVIDENCE/d['id'];out.mkdir(exist_ok=True)
 for view,(az,el) in VIEWS.items():
  a,e=math.radians(az),math.radians(el);direction=Vector((math.cos(a)*math.cos(e),-math.sin(a)*math.cos(e),math.sin(e)))
  cam.location=center+direction*12;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
  # same pixels per metre across body styles; front/rear use wider framing for roof/ground.
  cam.data.ortho_scale=5.9 if view not in ('front','rear') else 4.0
  ground.hide_render=view=='underside'
  sc.render.filepath=str(out/f'{view}.png');bpy.ops.render.render(write_still=True)
 print('RENDERED '+d['id'],flush=True)
