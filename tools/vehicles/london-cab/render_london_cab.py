"""Ten neutral studio views of the exported GLB, without production-scene assets.
blender -b --factory-startup -P render_london_cab.py -- input.glb output-directory
Optional --views front,right --samples 32 --resolution 1000.
Add --sheet evidence/contact-sheet.png after a full ten-view render for a labeled sheet.
"""
import bpy, math, os, sys
from mathutils import Vector

args=sys.argv[sys.argv.index('--')+1:]; source,out=args[:2]
def opt(key,default): return args[args.index(key)+1] if key in args else default
os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=os.path.abspath(source))
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=int(opt('--samples',40))
scene.cycles.use_denoising=True
scene.render.resolution_x=int(opt('--resolution',1100)); scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGB'
scene.view_settings.view_transform='AgX'
points=[ob.matrix_world@Vector(c) for ob in scene.objects if ob.type=='MESH' for c in ob.bound_box]
world=bpy.data.worlds.new('Neutral studio'); world.use_nodes=True; scene.world=world
world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.35,.40,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.005)); ground=bpy.context.object
material=bpy.data.materials.new('Studio ground'); material.use_nodes=True
material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.19,.21,.24,1)
material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.82; ground.data.materials.append(material)
for label,loc,power,size in (('Key',(3,-4,6),1300,5),('Fill',(1,4,4),1000,4),('Rim',(-4,-1,5),1500,4)):
    data=bpy.data.lights.new(label,'AREA'); data.energy=power; data.shape='DISK'; data.size=size
    ob=bpy.data.objects.new(label,data); scene.collection.objects.link(ob); ob.location=loc
    ob.rotation_euler=(Vector((0,0,.9))-ob.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.objects.new('Inspection camera',bpy.data.cameras.new('Inspection camera')); scene.collection.objects.link(cam); scene.camera=cam
cam.data.type='ORTHO'; target=Vector((0,0,.9))
# Azimuth +90 looks at the left side (+Y); -90 at UK driver's right (-Y).
views=[('front',0,8),('rear',180,8),('left',90,6),('right',-90,6),
       ('front_left',40,20),('front_right',-40,20),('rear_left',140,20),('rear_right',-140,20),
       ('top_left',45,55),('top_right',-45,55)]
selected=opt('--views',','.join(v[0] for v in views)).split(',')
for label,az,el in views:
    if label not in selected: continue
    a,e=math.radians(az),math.radians(el)
    cam.location=target+Vector((math.cos(a)*math.cos(e),math.sin(a)*math.cos(e),math.sin(e)))*12
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    inv=cam.rotation_euler.to_matrix().transposed(); projected=[inv@(p-target) for p in points]
    width=max(p.x for p in projected)-min(p.x for p in projected)
    height=max(p.y for p in projected)-min(p.y for p in projected)
    cam.data.ortho_scale=max(width,height*scene.render.resolution_x/scene.render.resolution_y)*1.18
    scene.render.filepath=os.path.join(out,label+'.png'); bpy.ops.render.render(write_still=True)
    print('CAB VIEW',label,scene.render.filepath)

# Blender's own PNG loader/scaler plus stdlib PNG output keeps the evidence sheet
# reproducible without Pillow, ImageMagick or a machine-specific Python runtime.
if '--sheet' in args:
    import array, hashlib, struct, zlib
    sheet_path=os.path.abspath(opt('--sheet','contact-sheet.png'))
    order=['front','front_left','left','rear_left','rear','front_right','right','rear_right','top_left','top_right']
    glyphs={
        'A':['01110','10001','10001','11111','10001','10001','10001'],
        'E':['11111','10000','10000','11110','10000','10000','11111'],
        'F':['11111','10000','10000','11110','10000','10000','10000'],
        'G':['01110','10001','10000','10111','10001','10001','01110'],
        'H':['10001','10001','10001','11111','10001','10001','10001'],
        'I':['11111','00100','00100','00100','00100','00100','11111'],
        'L':['10000','10000','10000','10000','10000','10000','11111'],
        'N':['10001','11001','11001','10101','10011','10011','10001'],
        'O':['01110','10001','10001','10001','10001','10001','01110'],
        'P':['11110','10001','10001','11110','10000','10000','10000'],
        'R':['11110','10001','10001','11110','10100','10010','10001'],
        'T':['11111','00100','00100','00100','00100','00100','00100']}
    tile_w,tile_h,label_h=500,400,24; sheet_w,sheet_h=2500,848
    rgba=bytearray(bytes((29,33,40,255))*(sheet_w*sheet_h))
    for k,label in enumerate(order):
        image_path=os.path.join(out,label+'.png'); assert os.path.isfile(image_path),image_path
        im=bpy.data.images.load(image_path,check_existing=False); im.colorspace_settings.name='Non-Color'; im.scale(tile_w,tile_h)
        pixels=array.array('f',[0])*(tile_w*tile_h*4); im.pixels.foreach_get(pixels)
        x=(k%5)*tile_w; y=(k//5)*(tile_h+label_h)
        for row in range(tile_h):
            src=(tile_h-1-row)*tile_w*4; dst=((y+row)*sheet_w+x)*4
            rgba[dst:dst+tile_w*4]=bytes(max(0,min(255,round(v*255))) for v in pixels[src:src+tile_w*4])
        bpy.data.images.remove(im)
        for ci,char in enumerate(label.replace('_',' ').upper()):
            for gy,bits in enumerate(glyphs.get(char,[])):
                for gx,bit in enumerate(bits):
                    if bit!='1': continue
                    for dy in range(2):
                        for dx in range(2):
                            pos=(((y+tile_h+5+gy*2+dy)*sheet_w)+x+12+ci*12+gx*2+dx)*4
                            rgba[pos:pos+4]=bytes((235,238,244,255))
    def chunk(kind,blob):
        return struct.pack('>I',len(blob))+kind+blob+struct.pack('>I',zlib.crc32(kind+blob)&0xffffffff)
    scanlines=b''.join(b'\0'+rgba[row*sheet_w*4:(row+1)*sheet_w*4] for row in range(sheet_h))
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>2I5B',sheet_w,sheet_h,8,6,0,0,0))
    png+=chunk(b'IDAT',zlib.compress(scanlines,6))+chunk(b'IEND',b'')
    os.makedirs(os.path.dirname(sheet_path),exist_ok=True)
    with open(sheet_path,'wb') as file: file.write(png)
    print('CAB SHEET',sheet_path,'SOURCE SHA256',hashlib.sha256(open(source,'rb').read()).hexdigest())
