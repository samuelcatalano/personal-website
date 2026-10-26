# blender -b --factory-startup -P render_wellington.py -- asset.glb output-dir
import bpy,sys,os,math
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:];os.makedirs(a[1],exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=os.path.abspath(a[0]))
s=bpy.context.scene;s.render.engine='BLENDER_EEVEE';s.render.resolution_x=900;s.render.resolution_y=1050;s.render.resolution_percentage=100
w=bpy.data.worlds.new('Studio');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.31,.36,.41,1);w.node_tree.nodes['Background'].inputs[1].default_value=.8
for name,pos,power,size in [('Key',(4,-7,12),1800,7),('Rim',(-5,3,10),1300,6)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,4))-o.location).to_track_quat('-Z','Y').to_euler()
c=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));s.collection.objects.link(c);s.camera=c;c.data.type='ORTHO';c.data.ortho_scale=9.6
for name,pos in [('side',(0,-17,6)),('front',(17,0,6)),('rear',(-17,0,6)),('threequarter',(12,-17,10)),('opposite',(0,17,6))]:
 c.location=pos;c.rotation_euler=(Vector((0,0,3.9))-c.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=os.path.join(a[1],name+'.png');bpy.ops.render.render(write_still=True)
