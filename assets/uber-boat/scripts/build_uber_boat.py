"""Mercury Clipper: metre-scale authored lofts, shared atlas, Blender/GLB checks.

Run: blender -b --python assets/uber-boat/scripts/build_uber_boat.py -- --stage blockout
Then omit --stage blockout to build/refine/export and render all seven views.
"""
import argparse
import json
import math
import struct
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
PARSER = argparse.ArgumentParser()
PARSER.add_argument('--stage', choices=['blockout','final'], default='final')
PARSER.add_argument('--no-render', action='store_true')
ARGS = PARSER.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
REGIONS = json.loads((ROOT/'textures/atlas_regions.json').read_text())
LENGTH, BEAM, DRAFT = 35.37, 8.30, 1.03
H = LENGTH/2
ASSET = None
BUCKETS = {}

def srgb(v):
    return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4

def material(name, color, metallic, roughness, alpha=1):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    c=tuple(srgb(v) for v in color)
    p.inputs['Base Color'].default_value=(*c,alpha)
    p.inputs['Metallic'].default_value=metallic
    p.inputs['Roughness'].default_value=roughness
    p.inputs['Alpha'].default_value=alpha
    m.diffuse_color=(*c,alpha)
    if alpha < 1:
        m.surface_render_method='BLENDED'
        m.use_transparency_overlap=False
    return m

class Mesh:
    def __init__(self, name, mat, smooth=False):
        self.name,self.mat,self.smooth=name,mat,smooth
        self.v=[]; self.f=[]; self.uv=[]
    def face(self,points,region='white',uv=None):
        n=len(self.v); self.v.extend(points); self.f.append(tuple(range(n,n+len(points))))
        if uv is None:
            x,y,w,h=REGIONS[region]
            uv=[((x+w/2)/2048,1-(y+h/2)/2048)]*len(points)
        self.uv.extend(uv)
    def quad(self,a,b,c,d,region='white'):
        self.face([a,b,c,d],region)
    def make(self):
        if not self.f:return
        mesh=bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.v,[],self.f); mesh.update()
        # Validation must not silently repair malformed model geometry.
        assert not mesh.validate(clean_customdata=False), self.name
        uv=mesh.uv_layers.new(name='AtlasUV')
        for i,p in enumerate(self.uv):uv.data[i].uv=p
        for f in mesh.polygons:f.use_smooth=self.smooth
        if self.smooth:
            bm=bmesh.new();bm.from_mesh(mesh)
            bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.00001)
            bm.to_mesh(mesh);bm.free();mesh.update()
        o=bpy.data.objects.new(self.name,mesh); ASSET.objects.link(o)
        o.data.materials.append(self.mat)
        return o

def bucket(name,mat='paint',smooth=False):
    key=(name,mat,smooth)
    if key not in BUCKETS:BUCKETS[key]=Mesh(name+'_'+mat,MATS[mat],smooth)
    return BUCKETS[key]

def box(b,c,s,region='white'):
    x,y,z=c; a,d,h=[q/2 for q in s]
    v=[(x-a,y-d,z-h),(x+a,y-d,z-h),(x+a,y+d,z-h),(x-a,y+d,z-h),
       (x-a,y-d,z+h),(x+a,y-d,z+h),(x+a,y+d,z+h),(x-a,y+d,z+h)]
    for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
        b.face([v[i] for i in f],region)

def prism_y(b,profile,y0,y1,region='white'):
    b.face([(x,y0,z) for x,z in profile][::-1],region)
    b.face([(x,y1,z) for x,z in profile],region)
    for (x,z),(xx,zz) in zip(profile,profile[1:]+profile[:1]):
        b.quad((x,y0,z),(xx,y0,zz),(xx,y1,zz),(x,y1,z),region)

def tube(b,points,r,region='white',segments=8,caps=True):
    rings=[]
    for i,p in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        tangent.normalize(); seed=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((0,1,0))
        a=tangent.cross(seed).normalized(); d=tangent.cross(a).normalized()
        rings.append([tuple(Vector(p)+r*(a*math.cos(2*math.pi*j/segments)+d*math.sin(2*math.pi*j/segments))) for j in range(segments)])
    for r0,r1 in zip(rings,rings[1:]):
        for j in range(segments):b.quad(r0[j],r0[(j+1)%segments],r1[(j+1)%segments],r1[j],region)
    if caps:
        b.face(rings[0][::-1],region);b.face(rings[-1],region)

def ellipse_ring(b,center,rx,rz,wire,region='white',axis='x',n=32):
    x,y,z=center
    if axis=='x':p=[(x,y+rx*math.cos(i*2*math.pi/n),z+rz*math.sin(i*2*math.pi/n)) for i in range(n+1)]
    else:p=[(x+rx*math.cos(i*2*math.pi/n),y,z+rz*math.sin(i*2*math.pi/n)) for i in range(n+1)]
    tube(b,p,wire,region,8,False)

def decal(b,points,key,reverse=False):
    x,y,w,h=REGIONS[key]; pad=2
    u0,u1=(x+pad)/2048,(x+w-pad)/2048
    v0,v1=1-(y+h-pad)/2048,1-(y+pad)/2048
    uv=[(u0,v0),(u1,v0),(u1,v1),(u0,v1)]
    b.face(points[::-1] if reverse else points,uv=uv[::-1] if reverse else uv)

def side_decal(b,side,x0,x1,z0,z1,key,y=4.109):
    # Left-to-right is reversed on the port elevation; text always faces outward.
    if side<0:points=[(x0,-y,z0),(x1,-y,z0),(x1,-y,z1),(x0,-y,z1)]
    else:points=[(x1,y,z0),(x0,y,z0),(x0,y,z1),(x1,y,z1)]
    decal(b,points,key)

def build_hulls():
    # Each ring has its own chine and keel; there is never a centreline monohull.
    section=[(-1.19,1.28),(-1.15,.68),(-1.15,.06)]
    section += [(-1.10*math.cos(i*math.pi/20),-.05-.98*math.sin(i*math.pi/20)) for i in range(21)]
    section += [(1.20,.06),(1.20,.68),(1.20,1.28)]
    stations=[-H+i*LENGTH/56 for i in range(57)]
    for side in (-1,1):
        rings=[]
        for x in stations:
            aft=max(0,(-x-15.7)/(H-15.7)); fore=max(0,(x-14.8)/(H-14.8))
            scale=1-.14*aft*aft-.12*fore*fore
            ring=[]
            for yy,z in section:
                # Raked independent bows; bottom terminates behind the deck stem.
                xx=x-max(0,1.28-z)*.48*fore**3+max(0,1.0-z)*.22*aft**3
                ring.append((xx,side*(2.95+yy*scale),z+.18*aft*aft*max(0,-z)))
            rings.append(ring)
        hull=bucket('Port_hull' if side<0 else 'Starboard_hull','paint',True)
        for i,(r0,r1) in enumerate(zip(rings,rings[1:])):
            for j in range(len(section)-1):
                z=(section[j][1]+section[j+1][1])/2
                color='teal' if z<-.05 else 'red' if z<.06 else 'black' if stations[i]<-6.5 and j>=len(section)-3 else 'white'
                p=[r0[j],r1[j],r1[j+1],r0[j+1]]
                hull.face(p[::-1] if side>0 else p,color)
        # End caps follow the same two distinct cross sections, split by paint bands.
        for end,ring in [(-1,rings[0]),(1,rings[-1])]:
            last=len(section)-1
            for j in range(last//2):
                z=(section[j][1]+section[j+1][1])/2
                col='teal' if z<-.05 else 'red' if z<.06 else 'black' if end<0 else 'white'
                pts=[ring[j],ring[last-j],ring[last-j-1],ring[j+1]] if j<last//2-1 else [ring[j],ring[last-j],ring[j+1]]
                hull.face(pts[::-1] if end*side>0 else pts,col)
    deck=bucket('Bridge_deck','paint')
    outline=[(-H+.18,-3.93),(-16.9,-4.1),(14.9,-4.1),(H,-3.98),(H,3.98),(14.9,4.1),(-16.9,4.1),(-H+.18,3.93)]
    deck.face([(x,y,1.29) for x,y in outline],'blue')
    deck.face([(x,y,1.11) for x,y in outline][::-1],'white')
    for (x,y),(xx,yy) in zip(outline,outline[1:]+outline[:1]):
        deck.quad((x,y,1.11),(xx,yy,1.11),(xx,yy,1.29),(x,y,1.29))
    # Under-deck crossbeams sit above, and never fill, the catamaran tunnel.
    for x in (-14,-6,2,10,16):box(deck,(x,0,1.02),(.22,3.5,.18))

def roof_z(x,y):
    return 3.66+.10*(1-(y/4.18)**2)-.18*(abs(y)/4.18)**8-.055*(abs(x)/15)**2

def build_superstructure():
    paint=bucket('Saloon_structure','paint')
    frame=bucket('Saloon_frames','graphite')
    glass=bucket('Saloon_glazing','glass')
    roof=bucket('Swept_canopy','graphite',True)
    white_roof=bucket('Crowned_roof','paint',True)
    # Cambered continuous canopy, rounded in plan; panels are welded loft surfaces.
    xs=[-15.5+i*25.8/64 for i in range(65)]
    ys=[-4.18+i*8.36/24 for i in range(25)]
    for i in range(len(xs)-1):
        for j in range(len(ys)-1):
            def rp(x,y):
                end=max(0,(-x-14)/1.5)
                fore=max(0,(x-9.5)/.8)
                return (x+.72*end*abs(y/4.18)**4+.64*fore*(1-(y/4.18)**2),y*(1-.025*end),roof_z(x,y))
            p=[rp(xs[i],ys[j]),rp(xs[i+1],ys[j]),rp(xs[i+1],ys[j+1]),rp(xs[i],ys[j+1])]
            target=white_roof if abs((ys[j]+ys[j+1])/2)<2.95 and xs[i]>-13.8 else roof
            target.face(p)
            roof.face([(x,y,z-.085) for x,y,z in p][::-1])
    # Thin rounded eave and underside maintain an actual roof edge in every view.
    metal=bucket('Roof_seams','metal')
    rubber=bucket('Roof_edge','rubber')
    for s in (-1,1):
        p=[(x+.72*max(0,(-x-14)/1.5),s*4.18*(1-.025*max(0,(-x-14)/1.5)),roof_z(x,s*4.18)-.025) for x in xs]
        tube(rubber,p,.055,segments=8)
        for x in [-14+i*1.25 for i in range(20)]:
            tube(metal,[(x,s*y,roof_z(x,s*y)+.012) for y in (2.94,3.35,3.75,4.16)],.008,segments=4)
    for x in (xs[0],xs[-1]):
        tube(rubber,[(x+.72*max(0,(-x-14)/1.5)*abs(y/4.18)**4+.64*max(0,(x-9.5)/.8)*(1-(y/4.18)**2),y*(1-.025*max(0,(-x-14)/1.5)),roof_z(x,y)-.025) for y in ys],.055,segments=8)
    # Side lower walls and swept aft glazing, with leaning mullions.
    for side in (-1,1):
        y=side*3.98
        box(paint,(2.05,side*4.06,1.61),(17.1,.12,.63))
        box(paint,(-8.75,side*4.06,1.61),(4.5,.12,.63),'black')
        box(frame,(0,side*3.97,1.95),(21.3,.11,.11))
        # The curved last window rises into the roof from the aft saloon shoulder.
        outline=[(-10.6+3.5*(1-math.cos(i*math.pi/32)),1.96+1.49*math.sin(i*math.pi/32)) for i in range(17)]+[(-7.1,1.96)]
        prism_y(frame,[(-11.05,1.29),(-11.05,3.47),(-7.08,3.47)]+outline[:-1][::-1],side*3.86,side*3.97)
        glass.face([(x,side*(3.98-(z-1.95)*.085),z) for x,z in outline][::side])
        for x0,x1 in [(-7.03+i*1.39,-7.03+(i+1)*1.39-.075) for i in range(12)]:
            z0,z1=1.97,3.43
            p=[(x0,side*3.985,z0),(x1,side*3.985,z0),(x1,side*3.86,z1),(x0,side*3.86,z1)]
            glass.face(p if side<0 else p[::-1])
            tube(frame,[(x0-.03,side*3.995,z0-.02),(x0-.03,side*3.87,z1+.02)],.042,segments=6)
        tube(frame,[(-10.55,side*3.99,1.95),(-10.4,side*3.97,2.22),(-9.9,side*3.93,2.65),(-9.15,side*3.89,3.07),(-8.2,side*3.87,3.4),(9.8,side*3.87,3.46)],.055,segments=8)
        # Sloping foredeck fairing grows continuously out of the canopy.
        profile=[(10.25,3.47),(11.0,3.23),(12.8,2.64),(15.1,1.98),(17.13,1.39),(15.8,1.39),(10.25,1.66)]
        prism_y(frame,profile,side*3.98,side*4.105)
        tube(metal,[(x,side*4.11,z+.025) for x,z in profile[:5]],.025,segments=6)
        # Aft bulwark curves upward from the transom with the turquoise badge.
        aft=[(-17.3,1.34),(-17.1,1.62),(-16.6,1.91),(-16.05,2.05),(-13.8,2.05),(-13.8,1.3)]
        prism_y(frame,aft,side*3.99,side*4.10)
        tube(metal,[(x,side*4.11,z+.02) for x,z in aft[:5]],.025,segments=6)
    # Convex glazed front wall: individual panes follow the curved plan, not a box.
    for k in range(10):
        ya=-3.82+k*7.64/10; yb=ya+7.64/10-.035
        def front(y,z):return (10.25+.63*(1-(y/3.82)**2)+(3.44-z)*.06,y,z)
        glass.face([front(ya,1.9),front(yb,1.9),front(yb,3.41),front(ya,3.41)])
        tube(frame,[front(ya-.025,1.88),front(ya-.025,3.46)],.034,segments=6)
        p0,p1=front(ya,1.29),front(yb,1.29)
        paint.quad(p0,p1,front(yb,1.86),front(ya,1.86))
    # Aft doors, white bulkhead and ventilation panels remain beneath the overhang.
    for y in (-3.41,3.41):box(paint,(-11.07,y,2.38),(.13,.92,2.18))
    box(paint,(-11.07,0,3.40),(.13,7.72,.14))
    box(paint,(-11.07,0,1.36),(.13,7.72,.14))
    for ya,yb in [(-2.95,-1.15),(-1.08,-.06),(.06,1.08),(1.15,2.95)]:
        glass.quad((-11.145,yb,1.46),(-11.145,ya,1.46),(-11.145,ya,3.28),(-11.145,yb,3.28))
        for yy in (ya,yb):tube(frame,[(-11.17,yy,1.43),(-11.17,yy,3.32)],.035,segments=6)

def build_wheelhouse():
    frame=bucket('Wheelhouse_frames','graphite')
    glass=bucket('Wheelhouse_glazing','glass')
    roof=bucket('Wheelhouse_roof','graphite',True)
    base=bucket('Wheelhouse_base','paint')
    for side in (-1,1):
        curve=[]
        for i in range(17):
            t=i/16
            curve.append(((1-t)**2*-4.25+2*(1-t)*t*-2.8+t*t*-1.8,(1-t)**2*3.74+2*(1-t)*t*4.80+t*t*4.80))
        profile=curve+[(3.4,4.8),(4.7,3.73)]
        # Swept aft haunch; forward panes stay open behind the glass.
        prism_y(frame,curve+[(-1.42,4.60),(-2.18,4.40),(-2.8,4.08),(-3.35,3.74)],side*2.04,side*2.15)
        p=[(-3.3,side*2.145,3.79),(-.8,side*1.94,4.65),(3.3,side*1.94,4.65),(4.52,side*2.145,3.79)]
        glass.face(p if side>0 else p[::-1])
        for x in (-.7,1.25,2.85):tube(frame,[(x,side*2.17,3.78),(x-.15,side*1.965,4.70)],.048,segments=8)
        tube(frame,[(x,side*(2.14 if z<4 else 1.97),z) for x,z in profile],.06,segments=8)
        # Distinct rear ventilation shutters, visible through the swept supports.
        for z in [3.88+i*.12 for i in range(6)]:
            xmin=-3.15+(z-3.88)*1.4
            tube(frame,[(xmin,side*(2.145-(z-3.79)*.19),z),(-.85,side*(2.145-(z-3.79)*.19),z)],.025,segments=6)
    # Curved, raked forward windscreen split into five panes.
    for i in range(5):
        ya=-2.12+i*4.24/5; yb=ya+4.24/5-.04
        def screen(y,z):
            t=(z-3.79)/.88
            return (4.7-1.12*t+.18*(1-(y/2.12)**2),y*(1-.085*t),z)
        glass.face([screen(ya,3.79),screen(yb,3.79),screen(yb,4.67),screen(ya,4.67)])
        tube(frame,[screen(ya-.02,3.76),screen(ya-.02,4.73)],.042,segments=8)
    box(base,(.3,0,3.74),(7.8,4.25,.12),'black')
    # Cambered roof with a rounded front visor and low aft tail.
    for ix in range(32):
        x0=-1.80+ix*5.43/32;x1=-1.80+(ix+1)*5.43/32
        for iy in range(12):
            y0=-2.18+iy*4.36/12;y1=-2.18+(iy+1)*4.36/12
            def rp(x,y):return (x+.18*(1-(y/2.18)**2),y,4.78+.095*(1-(y/2.18)**2)-.035*((x-.4)/3.2)**2)
            roof.face([rp(x0,y0),rp(x1,y0),rp(x1,y1),rp(x0,y1)])
    tube(frame,[(3.63+.18*(1-(y/2.18)**2),y,4.78+.095*(1-(y/2.18)**2)) for y in [-2.18+i*4.36/24 for i in range(25)]],.075,segments=8)
    # Raked glazed rear wall closes the bridge; the curved haunches remain separate.
    for i in range(5):
        ya=-1.93+i*3.86/5;yb=ya+3.86/5-.035
        glass.face([(-3.48,yb,3.82),(-3.48,ya,3.82),(-1.81,ya,4.68),(-1.81,yb,4.68)])
        tube(frame,[(-3.50,ya,3.80),(-1.81,ya,4.73)],.035,segments=6)
    for i in range(7):
        z=3.89+i*.11;x=-3.48+(z-3.82)*1.67/.86
        tube(frame,[(x-.03,-1.94,z),(x-.03,1.94,z)],.025,segments=6)

def finish_meshes():
    for b in BUCKETS.values():b.make()

def setup_stage():
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.eevee.taa_render_samples=64
    scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.film_transparent=False
    scene.world.color=(.2,.2,.2)
    world=scene.world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.37,.43,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.7
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.25
    stage=bpy.data.collections.new('STUDIO_NOT_EXPORTED');scene.collection.children.link(stage)
    for name,loc,power,size in [('Key',(8,-16,23),5500,15),('Fill',(-12,13,17),4000,13),('Bow',(22,5,10),2600,10)]:
        ld=bpy.data.lights.new(name,'AREA');ld.energy=power;ld.shape='DISK';ld.size=size
        o=bpy.data.objects.new(name,ld);stage.objects.link(o);o.location=loc
        o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    ground=material('Studio_ground',(.73,.76,.78),0,.95)
    mesh=bpy.data.meshes.new('Ground');mesh.from_pydata([(-200,-200,-1.16),(200,-200,-1.16),(200,200,-1.16),(-200,200,-1.16)],[],[(0,1,2,3)])
    obj=bpy.data.objects.new('Ground',mesh);stage.objects.link(obj);obj.data.materials.append(ground)
    c=bpy.data.cameras.new('Camera');co=bpy.data.objects.new('Camera',c);stage.objects.link(co);scene.camera=co
    return co

def render_views(camera,names=None,prefix=''):
    views={
      'left':((0,-65,2.15),'ORTHO',40.6,(0,0,2.15),(1600,620)),
      'right':((0,65,2.15),'ORTHO',40.6,(0,0,2.15),(1600,620)),
      'front':((62,0,2.1),'ORTHO',11.9,(0,0,2.1),(1000,900)),
      'rear':((-62,0,2.1),'ORTHO',11.9,(0,0,2.1),(1000,900)),
      'top':((0,0,70),'ORTHO',40.6,(0,0,0),(1600,700)),
      'front_3q':((39,-48,25),'PERSP',55,(0,0,1.5),(1600,1000)),
      'rear_3q':((-40,47,23),'PERSP',55,(0,0,1.5),(1600,1000)),
    }
    for name,(pos,typ,scale,target,res) in views.items():
        if names and name not in names:continue
        camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.type=typ;camera.data.ortho_scale=scale;camera.data.lens=scale
        bpy.context.scene.render.resolution_x,bpy.context.scene.render.resolution_y=res
        bpy.context.scene.render.filepath=str(ROOT/'renders'/f'{prefix}{name}.png')
        bpy.ops.render.render(write_still=True)

def build_details():
    paint=bucket('Deck_equipment','paint')
    trim=bucket('Deck_hardware','metal',True)
    rubber=bucket('Fendering','rubber',True)
    dark=bucket('Technical_parts','graphite')
    labels=bucket('Livery_decals','paint')
    glass=bucket('Access_door_glass','glass')
    rails=bucket('Stainless_rails','metal',True)
    fabric=bucket('Passenger_seats','fabric')
    inside=bucket('Interior_shells','graphite')
    # High and low rubbing strakes follow each side; rounded stern fenders turn around.
    for s in (-1,1):
        tube(trim,[(-17.12,s*4.04,1.20),(-16.7,s*4.18,1.20),(15.7,s*4.18,1.20),(17.0,s*4.05,1.20)],.055,segments=10)
        tube(rubber,[(8.1,s*4.21,.68),(9.0,s*4.235,.68),(14.7,s*4.20,.68)],.082,segments=12)
        for z in (.72,1.08):
            tube(rubber,[(-11.7,s*4.21,z),(-16.4,s*4.21,z),(-17.15,s*4.12,z),(-17.47,s*3.77,z),(-17.49,s*2.12,z)],.10,segments=12)
        # Large letters use the same 2K atlas on both outward-facing sides.
        side_decal(labels,s,-5.78,4.9,.12,1.91,'uber',4.168)
        aft_panel=[(-11.05,.065),(-11.05,1.94),(-6.50,1.94),(-6.50,.65),(-6.46,.39),(-6.31,.20),(-6.05,.09),(-5.80,.065)]
        paint.face([(x,s*4.169,z) for x,z in aft_panel][::s],'black')
        side_decal(labels,s,-10.78,-6.65,1.43,1.92,'by_white',4.178)
        side_decal(labels,s,11.15,14.65,1.65,2.17,'mercury',4.114)
        side_decal(labels,s,11.18,13.85,2.18,2.40,'welcome',4.115)
        side_decal(labels,s,-16.06,-15.30,1.48,2.01,'waves',4.112)
        side_decal(labels,s,14.90,15.37,-.42,-.18,'depth',4.10)
        # Narrow fore access door, recessed between cabin and swept side fairing.
        box(paint,(10.13,s*4.025,1.62),(.82,.1,.65))
        q=[(9.72,s*3.99,1.94),(10.43,s*3.99,1.94),(10.31,s*3.87,3.35),(9.72,s*3.87,3.43)]
        glass.face(q if s<0 else q[::-1])
        for x in (9.69,10.46):tube(trim,[(x,s*4.06,1.32),(x,s*4.03,2.92),(x-.10,s*3.91,3.40)],.035,segments=8)
        tube(trim,[(9.93,s*4.10,1.90),(10.21,s*4.10,1.90)],.022,segments=8)
        # Stern side boarding gates and curving rear handrails.
        for x in (-16.6,-15.55,-14.45,-13.25,-12.05):
            tube(rails,[(x,s*3.79,1.30),(x,s*3.79,2.42)],.025,segments=8)
            box(trim,(x,s*3.79,1.31),(.14,.14,.035))
        for z in (1.87,2.40):
            tube(rails,[(-16.6,s*3.79,z),(-12.05,s*3.79,z)],.028,segments=8)
        # Foredeck handrail descends from the canopy, preserving the open central deck.
        path=[(10.8,s*3.64,3.27),(12.1,s*3.64,2.90),(14.2,s*3.64,2.38),(16.90,s*3.64,2.05)]
        tube(rails,path,.031,segments=8)
        for i in range(5):
            x=11.7+i*1.13; top=3.01-(x-11.7)*.20
            tube(paint,[(x,s*3.68,1.32),(x,s*3.68,top)],.026,segments=8)
        # Gated transverse rail sections leave the mooring/walkway centre clear.
        for x in (15.85,-16.55):
            ya,yb=s*.5,s*2.43
            for y in (ya,(ya+yb)/2,yb):
                tube(rails,[(x,y,1.31),(x,y,2.31)],.026,segments=8)
                box(trim,(x,y,1.32),(.14,.14,.035))
            for z in (1.86,2.3):tube(rails,[(x,ya,z),(x,yb,z)],.028,segments=8)
        # Four canisters with shaped end caps, transport cradle, and retaining straps.
        for x in (12.9,-15.55):
            y=s*3.0;z=1.88
            profile=[(-.82,0),(-.80,.22),(-.70,.35),(-.49,.40),(.49,.40),(.70,.35),(.80,.22),(.82,0)]
            for (xa,ra),(xb,rb) in zip(profile,profile[1:]):
                for j in range(24):
                    aa=j*2*math.pi/24;bb=(j+1)*2*math.pi/24
                    pts=[(x+xa,y+ra*math.cos(aa),z+ra*math.sin(aa)),(x+xb,y+rb*math.cos(aa),z+rb*math.sin(aa)),
                         (x+xb,y+rb*math.cos(bb),z+rb*math.sin(bb)),(x+xa,y+ra*math.cos(bb),z+ra*math.sin(bb))]
                    if ra==0:pts=pts[:3]
                    elif rb==0:pts=[pts[0],pts[1],pts[3]]
                    paint.face(pts)
            for dx in (-.5,.5):
                ellipse_ring(trim,(x+dx,y,z),.409,.409,.014,axis='x',n=24)
                box(trim,(x+dx,y,1.40),(.12,.92,.10))
                for dy in (-.39,.39):tube(trim,[(x+dx,y+dy,1.34),(x+dx,y+dy,1.79)],.025,segments=6)
            # Raised mould seam around the equator reads from close viewpoints.
            for dy in (-.403,.403):tube(paint,[(x-.51,y+dy,z),(x+.51,y+dy,z)],.012,segments=6)
            # Lifebuoy behind the canister, with alternating white safety bands.
            bx=x-.92 if x>0 else x+.92
            for j in range(40):
                a=j*2*math.pi/40;aa=(j+1)*2*math.pi/40
                pts=[(bx,y+.48*math.cos(a),2.26+.48*math.sin(a)),(bx,y+.48*math.cos(aa),2.26+.48*math.sin(aa))]
                tube(paint,pts,.085,'white' if j%10<2 else 'orange',segments=8,caps=False)
            ellipse_ring(rails,(bx+.015,y,2.26),.58,.58,.012,axis='x',n=40)
            tube(trim,[(bx,y,1.32),(bx,y,2.79)],.023,segments=6)
        # Bollards, cleats, hatches and scuppers have separate readable relief.
        for x in (16.65,-16.95):
            y=s*2.82
            box(trim,(x,y,1.35),(.45,.43,.09))
            tube(trim,[(x,y,1.40),(x,y,1.75)],.115,segments=16)
            tube(trim,[(x,y,1.73),(x,y,1.78)],.155,segments=16)
        for x in (14.95,-15.9):
            y=s*.98
            tube(trim,[(x,y,1.31),(x,y,1.69)],.055,segments=12)
            tube(trim,[(x-.16,y,1.65),(x+.16,y,1.65)],.045,segments=10)
        for x in (-14.2,13.7):
            box(paint,(x,s*1.98,1.307),(1.2,1.1,.025))
            box(paint,(x,s*1.98,1.323),(.98,.88,.01),'blue')
            tube(trim,[(x-.2,s*1.98,1.34),(x+.2,s*1.98,1.34)],.016,segments=6)
        for x in (-12.5,11.3,15.3):box(dark,(x,s*4.13,1.42),(.22,.025,.065))
        # Side and aft louvers use fins, without adding high-resolution interior machinery.
        for x in (-10.55,):
            for k in range(10):
                z=2.0+k*.095
                tube(trim,[(x-.23,s*4.0,z),(x+.23,s*4.0,z)],.014,segments=4)
        for k in range(10):
            z=2.5+k*.068
            tube(trim,[(-11.16,s*3.26,z),(-11.16,s*3.67,z)],.015,segments=4)
        # Wheelhouse wipers follow the rake of the forward screen.
        for yy in (s*.57,s*1.45):
            tube(dark,[(4.91,yy,3.82),(4.35,yy-s*.22,4.30)],.018,segments=6)
            tube(dark,[(4.64,yy-s*.11,4.07),(4.09,yy-s*.31,4.52)],.018,segments=6)
        # Navigation light housings and small marine searchlights.
        box(paint,(8.8,s*3.78,3.61),(.28,.28,.12))
        box(paint,(8.8,s*3.81,3.73),(.13,.15,.14),'red' if s<0 else 'green')
        tube(paint,[(5.8,s*3.0,3.73),(5.8,s*3.0,4.03)],.048,segments=10)
        tube(paint,[(5.72,s*3.0,4.05),(5.94,s*3.0,4.05)],.19,segments=20)
        tube(paint,[(5.95,s*3.0,4.05),(5.97,s*3.0,4.05)],.155,'light',segments=20)
        for x in (-8.5,-12.5):
            tube(rails,[(x,s*2.83,roof_z(x,s*2.83)+.01),(x,s*2.83,3.98),(x+1.25,s*2.83,3.98),(x+1.25,s*2.83,3.75)],.022,segments=6)
        # Door safety plates remain legible without geometric lettering.
        decal(labels,[(10.93,s*2.9,1.54),(10.93,s*2.55,1.54),(10.93,s*2.55,1.75),(10.93,s*2.9,1.75)],'exit',reverse=s<0)
    # Curved front doors: lower panels, inset outlines, horizontal pushbars, handles.
    for y in (-.60,.60):
        x=10.92
        box(paint,(x,y,1.62),(.07,1.06,.55))
        tube(trim,[(x+.035,y-.51,1.35),(x+.035,y-.51,3.30),(x+.035,y+.51,3.30),(x+.035,y+.51,1.35)],.025,segments=8)
        tube(trim,[(x+.10,y-.36,1.96),(x+.10,y+.36,1.96)],.022,segments=8)
    box(paint,(10.97,0,3.51),(.035,2.11,.32),'black')
    decal(labels,[(10.994,-1.04,3.37),(10.994,1.04,3.37),(10.994,1.04,3.65),(10.994,-1.04,3.65)],'route')
    # Low-complexity interior follows the operator's outer/inner seating aisles.
    def seat(x,y,z=1.31):
        box(fabric,(x+.11,y,z+.45),(.48,.44,.11))
        profile=[(x-.14,z+.45),(x-.16,z+.94),(x-.12,z+1.08),(x+.01,z+1.13),(x+.09,z+1.08),(x+.10,z+.45)]
        prism_y(fabric,profile,y-.215,y+.215)
        tube(inside,[(x-.1,y,z+.08),(x-.1,y,z+.43)],.045,segments=4)
        for s in (-1,1):
            tube(inside,[(x-.12,y+s*.245,z+.57),(x+.30,y+s*.245,z+.57)],.022,segments=4)
    for x in [-9.5+i*.92 for i in range(21)]:
        for y in (-3.32,-2.76,2.76,3.32):seat(x,y)
        if not -2<x<2.3:
            for y in (-1.27,-.71,.71,1.27):seat(x,y)
    for x in (-12.0,-12.95,-13.9):
        for y in (-1.34,-.76,.76,1.34):seat(x,y)
    box(paint,(0,0,1.95),(2.9,1.65,1.27),'black')
    box(paint,(.1,0,2.64),(3.15,1.85,.12),'silver')
    box(paint,(-9.65,0,2.18),(1.8,2.1,1.74))
    # The bridge's interior bulkhead prevents rear shutters reading as front bars.
    box(inside,(-.75,0,4.21),(.09,3.68,.94))
    box(inside,(3.45,0,3.99),(.72,3.28,.42))
    for y in (-.73,.73):seat(2.30,y,3.43)
    # Radar, aerials and roof service panels are shared-material geometry.
    for x in (-6.0,-8.1,-10.2):
        tube(trim,[(x,0,3.78),(x-.8,0,4.65)],.027,segments=8)
        tube(trim,[(x-.8,0,4.65),(x-1.05,0,4.97)],.012,segments=6)
        box(paint,(x,0,3.78),(.28,.24,.08))
    tube(paint,[(.55,0,4.87),(.55,0,5.0)],.24,segments=24)
    tube(paint,[(.55,0,4.98),(.55,0,5.24)],.40,segments=32)
    tube(paint,[(.55,0,5.05),(.55,0,5.12)],.405,'teal',segments=32)
    tube(trim,[(.55,0,5.25),(.55,0,5.72)],.055,segments=12)
    tube(dark,[(.55,0,5.69),(.55,0,5.90)],.095,segments=12)
    for y in (-1.9,1.9):
        tube(trim,[(1.9,y,4.83),(1.9,y,5.63)],.014,segments=6)
    # Rear-facing rooftop wordmark bends with the canopy rather than floating above it.
    tx,ty,tw,th=REGIONS['by_white']
    for i in range(16):
        u0=i/16;u1=(i+1)/16;y0=3.1-6.2*u0;y1=3.1-6.2*u1
        pts=[(-15.05,y0,roof_z(-15.05,y0)+.012),(-15.05,y1,roof_z(-15.05,y1)+.012),
             (-13.95,y1,roof_z(-13.95,y1)+.012),(-13.95,y0,roof_z(-13.95,y0)+.012)]
        uv=[((tx+u0*tw)/2048,1-(ty+th)/2048),((tx+u1*tw)/2048,1-(ty+th)/2048),
            ((tx+u1*tw)/2048,1-ty/2048),((tx+u0*tw)/2048,1-ty/2048)]
        labels.face(pts,uv=uv)
    for x in (6.4,7.6,8.8):
        box(trim,(x,0,3.78),(.75,.68,.035))
        for i in range(5):tube(dark,[(x-.29,-.25+i*.12,3.804),(x+.29,-.25+i*.12,3.804)],.012,segments=4)
    # A small aft Red Ensign matches the operator photo. No unverified oversized bow flag.
    tube(trim,[(-16.92,0,1.3),(-16.92,0,3.7)],.025,segments=8)
    for i in range(16):
        u0=i/16;u1=(i+1)/16
        points=[]
        for u,z in [(u0,3.12),(u1,3.12),(u1,3.64),(u0,3.64)]:
            points.append((-16.95-u*.72,.09*math.sin(u*2.5*math.pi),z-.08*u))
        x,y,w,h=REGIONS['ensign']
        uv=[((x+u0*w)/2048,1-(y+h)/2048),((x+u1*w)/2048,1-(y+h)/2048),((x+u1*w)/2048,1-y/2048),((x+u0*w)/2048,1-y/2048)]
        labels.face(points,uv=uv)
    # Fore anchor stock and flukes stay inside the nominal LOA envelope.
    tube(trim,[(H-.08,0,.66),(H-.08,0,2.02)],.048,segments=10)
    paint.face([(H-.045,-.45,.85),(H-.045,0,.48),(H-.045,.45,.85),(H-.045,.16,1.20),(H-.045,-.16,1.20)])
    tube(trim,[(H-.07,-.36,.82),(H-.07,.36,.82)],.03,segments=8)

def geometry_metrics(objects):
    count=0;degenerate=0;duplicates=0;seen=set();points=[]
    materials=set();images=set()
    for o in objects:
        if o.type!='MESH':continue
        me=o.data;me.calc_loop_triangles()
        points.extend(o.matrix_world@v.co for v in me.vertices)
        for p in me.vertices:
            assert all(math.isfinite(v) for v in p.co),o.name
        for tri in me.loop_triangles:
            v=[o.matrix_world@me.vertices[i].co for i in tri.vertices]
            if (v[1]-v[0]).cross(v[2]-v[0]).length<1e-9:degenerate+=1
            key=tuple(sorted(tuple(round(c,6) for c in p) for p in v))
            if key in seen:duplicates+=1
            seen.add(key);count+=1
        for mat in me.materials:
            if not mat:continue
            materials.add(mat.name)
            for node in mat.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image:images.add(node.image.name)
    low=[min(p[i] for p in points) for i in range(3)]
    high=[max(p[i] for p in points) for i in range(3)]
    return {'triangles':count,'mesh_objects':len(objects),'materials':len(materials),'textures':len(images),
            'bounds_blender':{'min':low,'max':high},'dimensions_m':[high[i]-low[i] for i in range(3)],
            'degenerate_triangles':degenerate,'duplicate_triangles':duplicates}

def export_and_validate():
    source=list(ASSET.objects)
    source_metrics=geometry_metrics(source)
    assert source_metrics['degenerate_triangles']==0,source_metrics
    assert source_metrics['duplicate_triangles']==0,source_metrics
    collection=bpy.data.collections.new('EXPORT_BATCHES');bpy.context.scene.collection.children.link(collection)
    batches=[]
    for material_name,material in MATS.items():
        copies=[]
        for obj in source:
            if obj.data.materials[0]!=material:continue
            cp=obj.copy();cp.data=obj.data.copy();collection.objects.link(cp);copies.append(cp)
        if not copies:continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in copies:obj.select_set(True)
        bpy.context.view_layer.objects.active=copies[0]
        bpy.ops.object.join()
        joined=bpy.context.object;joined.name='Mercury_'+material_name;batches.append(joined)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in batches:obj.select_set(True)
    glb=ROOT/'exports/uber_boat.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,
                             export_apply=True,export_materials='EXPORT',export_animations=False,
                             export_cameras=False,export_lights=False,export_extras=True)
    binary=glb.read_bytes();size,typ=struct.unpack_from('<I4s',binary,12)
    data=json.loads(binary[20:20+size])
    assert typ==b'JSON' and len(data['materials'])==6 and len(data['images'])==1
    assert len(data['meshes'])==6
    # A separate clean scene proves the delivered GLB, independent of source objects.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.world=bpy.data.worlds.new('Validation_world')
    bpy.ops.import_scene.gltf(filepath=str(glb))
    imported=[o for o in bpy.context.scene.objects if o.type=='MESH']
    imported_metrics=geometry_metrics(imported)
    assert imported_metrics['triangles']==source_metrics['triangles'],(source_metrics,imported_metrics)
    assert imported_metrics['degenerate_triangles']==0 and imported_metrics['duplicate_triangles']==0
    assert all(abs(a-b)<.0001 for a,b in zip(source_metrics['dimensions_m'],imported_metrics['dimensions_m']))
    # Empty tunnel is sampled below the crossdeck and above the nominal waterline.
    from mathutils.bvhtree import BVHTree
    depsgraph=bpy.context.evaluated_depsgraph_get()
    trees=[BVHTree.FromObject(o,depsgraph) for o in imported]
    for x in (-16,-8,0,8,16):
        for y in (-1.2,0,1.2):
            start=Vector((x,y,-.8));direction=Vector((0,0,1))
            for tree in trees:
                hit=tree.ray_cast(start,direction,1.2)
                assert hit[0] is None,('Tunnel obstruction',x,y,hit[0])
    report={'variant':'Mercury Clipper, Hunt Mk II (2017)','nominal_loa_m':LENGTH,'moulded_beam_m':BEAM,
            'loaded_draft_reference_m':DRAFT,'waterline_blender_z':0,'bow_axis':'+X',
            'glb_up_axis':'+Y','source':source_metrics,'glb':imported_metrics,
            'glb_bytes':len(binary),'glb_materials':[m['name'] for m in data['materials']],
            'texture_size_px':[2048,2048],'tunnel_clearance_samples':15,'clean_reimport_passed':True,
            'extensions_used':data.get('extensionsUsed',[])}
    (ROOT/'exports/metrics.json').write_text(json.dumps(report,indent=2)+'\n')
    camera=setup_stage()
    if not ARGS.no_render:render_views(camera,['front_3q'],prefix='reimport_')
    print('MERCURY_VALIDATION '+json.dumps(report))

def main():
    global ASSET,MATS
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for col in list(bpy.data.collections):
        if col.name!='Collection':bpy.data.collections.remove(col)
    ASSET=bpy.data.collections.new('MERCURY_CLIPPER');bpy.context.scene.collection.children.link(ASSET)
    bpy.context.scene.unit_settings.system='METRIC'
    MATS={'paint':material('Mercury_atlas_paint',(1,1,1),.08,.37),
          'graphite':material('Graphite_structure',(.14,.17,.20),.3,.33),
          'glass':material('Smoked_marine_glass',(.10,.16,.18),.15,.19,.86),
          'metal':material('Brushed_aluminium',(.64,.69,.72),.8,.28),
          'rubber':material('Rubber_fenders',(.026,.032,.037),.0,.86),
          'fabric':material('Seat_upholstery',(.12,.20,.24),.0,.9)}
    img=bpy.data.images.load(str(ROOT/'textures/mercury_atlas.png'));img.pack()
    mat=MATS['paint']; tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img
    mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    build_hulls();build_superstructure();build_wheelhouse()
    if ARGS.stage=='final':build_details()
    finish_meshes();camera=setup_stage()
    if ARGS.stage=='blockout':
        bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/blockout.blend'))
        if not ARGS.no_render:render_views(camera,['left','front','front_3q'],prefix='blockout_')
        return
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/uber_boat.blend'))
    if not ARGS.no_render:render_views(camera)
    export_and_validate()

if __name__=='__main__':main()
