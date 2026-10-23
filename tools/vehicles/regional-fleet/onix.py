"""Dedicated MY2020 Onix surfaces traced from GM's gallery and dimension side view.
No photos/meshes/textures included. Author coordinates metres, +X front/+Z up.
"""
import math
from mathutils import Vector

def build_onix(d, api):
 mesh,box,prism,line,cyl,body,wheel=[api[k] for k in ('mesh','box','prism','line','cyl','body','wheel')]
 SILVER=(.46,.50,.55,1);BLACK=(.018,.025,.032,1);RED=(.58,.008,.016,1);WHITE=(.93,.97,1,1)
 L,W,H=d['dims']
 # From the owner's manual profile: short 730 mm rear overhang; arched cabin,
 # shoulder rising rearwards, roof rolls into hatch ahead of the rear bumper.
 d['body']=[[-.5,.63,.87],[-.48,.69,.96],[-.43,.735,.99],[-.34,.75,1],[-.22,.72,.99],[-.04,.685,.99],[.17,.67,.99],[.29,.675,1],[.40,.64,.97],[.47,.60,.93],[.5,.55,.84]]
 d['_onix_curved_ends']=True
 body(d);wheel(d)
 # Hermite profile is continuous at each control point, not a planar four-corner cabin.
 def curve(keys,x):
  x=max(keys[0][0],min(keys[-1][0],x))
  for i in range(len(keys)-1):
   xa,ya=keys[i];xb,yb=keys[i+1]
   if x<=xb:
    t=(x-xa)/(xb-xa);m0=(yb-keys[max(0,i-1)][1])/(xb-keys[max(0,i-1)][0]);m1=(keys[min(len(keys)-1,i+2)][1]-ya)/(keys[min(len(keys)-1,i+2)][0]-xa)
    return (2*t**3-3*t*t+1)*ya+(t**3-2*t*t+t)*(xb-xa)*m0+(-2*t**3+3*t*t)*yb+(t**3-t*t)*(xb-xa)*m1
  return keys[-1][1]
 roof=[(-1.84,1.12),(-1.65,1.25),(-1.35,1.37),(-1.05,1.42),(-.65,1.44),(-.3,1.44),(.05,1.40),(.30,1.29),(.62,1.10),(.96,.995)]
 belt=[(-1.84,1.09),(-1.35,1.08),(-.7,1.04),(0,1.005),(.60,.985),(.96,.975)]
 rw=[(-1.84,.75),(-1.4,.66),(-.7,.64),(0,.65),(.4,.70),(.96,.79)]
 def side_y(x,z):
  base=curve(belt,x);top=curve(roof,x);t=max(0,min(1,(z-base)/max(.015,top-base)))
  return .805+(curve(rw,x)-.805)*t+.012*math.sin(math.pi*t)
 # Closed cabin mass: many cross-sections with a genuine curved roof/canted sides.
 verts=[];faces=[];nx=65;nr=17
 for i in range(nx):
  x=-1.84+2.8*i/(nx-1);base=curve(belt,x);top=curve(roof,x);w=curve(rw,x)
  ring=[(-.805,base)]
  ring += [(-side_y(x,base+(top-base)*j/4),base+(top-base)*j/4) for j in range(1,5)]
  ring += [(w*v,top+.035*(1-v*v)) for v in (-.75,-.5,-.25,0,.25,.5,.75)]
  ring += [(side_y(x,base+(top-base)*j/4),base+(top-base)*j/4) for j in (4,3,2,1)]
  ring += [(.805,base)]
  assert len(ring)==nr
  verts += [(x,y,z) for y,z in ring]
 for i in range(nx-1):
  for j in range(nr):faces.append((i*nr+j,i*nr+(j+1)%nr,(i+1)*nr+(j+1)%nr,(i+1)*nr+j))
 faces += [tuple(range(nr-1,-1,-1)),tuple((nx-1)*nr+j for j in range(nr))]
 mesh('Onix arched cabin',verts,faces,'FleetBody',smooth=True)
 # Rounded boundaries preserve the small GM quarter pane rather than a wagon's long rectangle.
 def rounded(poly,f=.07):
  out=[]
  for i,p in enumerate(poly):
   p=Vector(p);a=Vector(poly[i-1]);b=Vector(poly[(i+1)%len(poly)])
   q=p+(a-p)*f;r=p+(b-p)*f
   for j in range(5):
    t=j/4;out.append(tuple((1-t)**2*q+2*(1-t)*t*p+t*t*r))
  return out
 def panel(name,outline,side,sem,color=None,offset=.006):
  # A curved fan with concentric rings lies on the same analytical surface as the cabin.
  boundary=rounded(outline);center=sum((Vector(v) for v in boundary),Vector((0,0)))/len(boundary);vs=[];n=len(boundary)
  for ring in range(1,5):
   f=ring/4
   for v in boundary:
    x,z=center+(Vector(v)-center)*f;vs.append((x,side*(side_y(x,z)+offset),z))
  vs.append((center.x,side*(side_y(center.x,center.y)+offset),center.y));fs=[]
  for j in range(n):fs.append((4*n,j,(j+1)%n))
  for ring in range(3):
   for j in range(n):a=ring*n+j;b=ring*n+(j+1)%n;fs.append((a,b,b+n,a+n))
  # Closed back skin, with thickness; no DoubleSide or open panes.
  count=len(vs);vs += [(x,y-side*.008,z) for x,y,z in vs]
  fs += [tuple(i+count for i in reversed(f)) for f in list(fs)]
  fs += [(3*n+j,3*n+(j+1)%n,3*n+(j+1)%n+count,3*n+j+count) for j in range(n)]
  return mesh(name,vs,fs,sem,color,smooth=True)
 window_front=[(.82,.999),(.28,1.315),(.13,1.375),(-.16,1.403),(-.245,1.035)]
 window_rear=[(-.315,1.405),(-.90,1.365),(-1.11,1.19),(-1.18,1.13),(-.33,1.045)]
 window_quarter=[(-.99,1.342),(-1.38,1.147),(-1.235,1.132)]
 for side in (-1,1):
  # Black pillars/surround are integral to this generation's visual mass.
  for name,out in [('front',window_front),('rear',window_rear),('quarter',window_quarter)]:
   panel('Onix '+name+' rubber seal',out,side,'FleetTrim',BLACK,.012)
   center=sum((Vector(v) for v in out),Vector((0,0)))/len(out)
   inset=[tuple(center+(Vector(v)-center)*.965) for v in out]
   panel('Onix '+name+' glass',inset,side,'FleetGlass',None,.017)
  panel('Onix black B pillar',[(-.17,1.41),(-.325,1.41),(-.345,1.032),(-.24,1.025)],side,'FleetTrim',BLACK,.025)
  surround=[(.83,1.0),(.58,1.16),(.28,1.33),(.13,1.39),(-.16,1.417),(-.55,1.409),(-.90,1.379),(-1.08,1.29),(-1.40,1.145),(-1.2,1.116),(-.66,1.065),(-.27,1.025),(.27,1.004),(.83,1.0)]
  pts=[(x,side*(side_y(x,z)+.023),z) for x,z in surround]
  line('Onix window bright surround',pts,.008,'FleetTrim',SILVER)
  # Narrow sculpted door gaps and short body-colored handles with dark recesses.
  door=[(-.265,side*.853,1.025),(-.285,side*.861,.85),(-.26,side*.86,.48),(-.21,side*.82,.27)]
  line('Onix front door shut',door,.006,'FleetTrim',(.065,.075,.085,1))
  line('Onix rear door shut',[(-1.20,side*.85,1.09),(-1.18,side*.86,.89),(-1.0,side*.86,.60),(-1.0,side*.81,.28)],.006,'FleetTrim',(.065,.075,.085,1))
  for x,z in [(-.02,.975),(-.99,1.025)]:
   box('Onix handle recess',(x,side*.855,z),(.16,.026,.035),'FleetTrim',BLACK,.014)
   box('Onix painted handle',(x,side*.874,z+.014),(.13,.024,.026),'FleetBody',bevel=.011)
  # Mirrors sit on small triangular black sail panels rather than a long stalk.
  panel('Onix mirror sail',[(.79,1.0),(.63,1.09),(.60,1.00)],side,'FleetTrim',BLACK,.022)
  box('Onix mirror foot',(.70,side*.86,1.04),(.12,.13,.06),'FleetTrim',BLACK,.023)
  box('Onix rounded mirror',(.69,side*.94,1.065),(.24,.16,.115),'FleetBody',bevel=.047)
  box('Onix mirror lens',(.565,side*.94,1.07),(.008,.12,.075),'FleetTrim',SILVER,.02)
  box('Onix sill',(0,side*.79,.245),(2.17,.055,.06),'FleetBody',bevel=.022)
 # Compound-curved windscreen and rear hatch glass.
 def screen(name,front=True):
  vs=[];fs=[];nu=25;nv=17
  for j in range(nv):
   t=j/(nv-1)
   for i in range(nu):
    u=-1+2*i/(nu-1)
    if front:
     x=(.89+.025*u*u)*(1-t)+(.10+.09*u*u)*t+.025*math.sin(math.pi*t)*(1-u*u)
     y=u*(.765*(1-t)+.618*t)
     tx=.10+.09*u*u;ty=.618*u
     tz=curve(roof,tx)+.035*(1-(ty/curve(rw,tx))**2)
     z=(.998+.008*(1-u*u))*(1-t)+tz*t
    else:
     x=-1.81*(1-t)-1.27*t-.025*(1-u*u);z=(1.122+.012*(1-u*u))*(1-t)+(1.385-.035*u*u)*t;y=u*(.72*(1-t)+.593*t)
    vs.append((x+(.012 if front else -.012),y,z))
  for j in range(nv-1):
   for i in range(nu-1):k=j*nu+i;fs.append((k,k+1,k+nu+1,k+nu))
  # Shell behind glazing already closes the cabin; panes themselves get closed skins.
  count=len(vs);vs += [(x+(-.007 if front else .007),y,z) for x,y,z in vs]
  fs += [tuple(k+count for k in reversed(f)) for f in list(fs)]
  border=list(range(nu))+[j*nu+nu-1 for j in range(1,nv)]+list(range((nv-1)*nu+nu-2,(nv-1)*nu-1,-1))+[j*nu for j in range(nv-2,0,-1)]
  fs += [(a,b,b+count,a+count) for a,b in zip(border,border[1:]+border[:1])]
  mesh(name,vs,fs,'FleetGlass',smooth=True)
 screen('Onix bowed windscreen');screen('Onix hatch screen',False)
 line('Onix front wiper',[(.91,-.59,1.016),(.89,-.05,1.025)],.009,'FleetTrim',BLACK)
 line('Onix front wiper',[(.89,.04,1.025),(.88,.55,1.028)],.009,'FleetTrim',BLACK)
 line('Onix rear wiper',[(-1.835,-.22,1.15),(-1.835,.20,1.15)],.009,'FleetTrim',BLACK)
 # Rear roof lip follows the short sloping hatch, without a long horizontal wagon tail.
 box('Onix roof spoiler',(-1.38,0,1.395),(.16,1.31,.045),'FleetBody',bevel=.021)
 # Curved bumper patches share the actual body-end surface; no floating front stickers.
 def fx(y,z):return L/2-.18*(abs(y)/(.865*.84))**2
 def rx(y,z):return -L/2+.14*(abs(y)/(.865*.87))**2
 def patch(name,outline,front,sem,color=None,offset=.006):
  # fan subdivided radially to follow bumper curvature.
  boundary=rounded(outline,.10);center=sum((Vector(p) for p in boundary),Vector((0,0)))/len(boundary);vs=[];fs=[];n=len(boundary)
  for r in range(1,5):
   for p in boundary:
    y,z=center+(Vector(p)-center)*r/4;x=(fx(y,z) if front else rx(y,z))+(offset if front else -offset);vs.append((x,y,z))
  vs.append(((fx(center.x,center.y) if front else rx(center.x,center.y))+(offset if front else -offset),center.x,center.y))
  for j in range(n):fs.append((4*n,j,(j+1)%n))
  for r in range(3):
   for j in range(n):a=r*n+j;b=r*n+(j+1)%n;fs.append((a,b,b+n,a+n))
  count=len(vs);vs += [(x+(-.008 if front else .008),y,z) for x,y,z in vs]
  fs += [tuple(i+count for i in reversed(f)) for f in list(fs)]
  fs += [(3*n+j,3*n+(j+1)%n,3*n+(j+1)%n+count,3*n+j+count) for j in range(n)]
  return mesh(name,vs,fs,sem,color,smooth=True)
 mouth=[(-.48,.325),(.48,.325),(.60,.40),(.63,.66),(.54,.785),(-.54,.785),(-.63,.66),(-.60,.40)]
 patch('Onix deep lower grille',mouth,True,'FleetTrim',BLACK,.012)
 pts=[(fx(y,z)+.025,y,z) for y,z in rounded(mouth,.1)];line('Onix grille chrome perimeter',pts+[pts[0]],.013,'FleetTrim',SILVER)
 for z,w in [(.39,.49),(.455,.555),(.52,.58),(.585,.592),(.65,.58),(.715,.55)]:
  pts=[(fx(y,z)+.029,y,z+.009*(1-(y/w)**2)) for y in [w*(i/12*2-1) for i in range(13)]]
  line('Onix grille horizontal louvre',pts,.017,'FleetTrim',(.20,.23,.27,1))
 upper=[(-.48,.837),(.48,.837),(.54,.92),(-.54,.92)]
 patch('Onix narrow upper grille',upper,True,'FleetTrim',BLACK,.015)
 line('Onix upper chrome wing',[(fx(y,.855)+.031,y,.855+.015*abs(y)/.5) for y in [i*.05 for i in range(-10,11)]],.015,'FleetTrim',SILVER)
 # Bowtie is a real small gold silhouette in the horizontal separator bar.
 bow=[(-.105,.86),(-.045,.86),(-.045,.847),(.045,.847),(.045,.86),(.105,.86),(.105,.89),(.045,.89),(.045,.903),(-.045,.903),(-.045,.89),(-.105,.89)]
 patch('Onix Chevrolet bowtie',bow,True,'FleetTrim',(.78,.51,.11,1),.045)
 # Deep swept lenses: their outer points run back onto the fender, not a flat front rectangle.
 for side in (-1,1):
  lamp=[(side*.43,.79),(side*.64,.72),(side*.81,.735),(side*.805,.815),(side*.66,.835),(side*.45,.82)]
  patch('Onix swept headlamp lens',lamp,True,'FleetTrim',BLACK,.001)
  hint=[(side*.585+.018*math.cos(2*math.pi*i/20),.778+.012*math.sin(2*math.pi*i/20)) for i in range(20)]
  patch('Onix headlamp projector hint',hint,True,'FleetLights',WHITE,.002)
  recess=[(side*.64,.36),(side*.81,.365),(side*.81,.58),(side*.73,.67),(side*.66,.57)]
  patch('Onix tall corner recess',recess,True,'FleetTrim',BLACK,.026)
  for z in (.415,.47,.525):
   yy=side*.735;line('Onix outer intake vanes',[(fx(yy-.055,z)+.039,yy-.055,z),(fx(yy+.055,z)+.039,yy+.055,z)],.015,'FleetTrim',(.11,.14,.17,1))
  line('Onix corner bright trim',[(fx(y,z)+.045,y,z) for y,z in [(side*.65,.357),(side*.805,.365),(side*.82,.43)]],.013,'FleetTrim',SILVER)
  # Sculptural rear jewel housing, with a contained red hook and pale reverse segment.
  tail=[(side*.47,.865),(side*.76,.88),(side*.83,1.025),(side*.70,1.095),(side*.49,1.075),(side*.40,.99)]
  patch('Onix rear jewel housing',tail,False,'FleetGlass',(.07,.021,.025,1),.015)
  red=[(side*.48,1.032),(side*.71,1.044),(side*.77,1.012),(side*.72,.983),(side*.53,.982),(side*.49,.92),(side*.57,.91),(side*.60,.95),(side*.74,.95),(side*.77,1.034),(side*.68,1.068),(side*.48,1.065)]
  patch('Onix contained red tail signature',red,False,'FleetLights',RED,.030)
  # Side return is integrated into the same rear quarter footprint.
  prism('Onix tail lens side return',[(-1.89,side*.78,.94),(-1.63,side*.85,.97),(-1.62,side*.84,1.065),(-1.90,side*.77,1.075)],side*.012,'FleetGlass',(.12,.025,.03,1),axis=1)
  box('Onix tail reverse insert',(rx(side*.59,.925)-.039,side*.59,.925),(.012,.11,.035),'FleetLights',(.56,.59,.61,1),.008)
 # Neutral Brazilian plate and modest cabin silhouettes.
 for front in (True,False):
  z=.59 if front else .55;x=(fx(0,z)+.054) if front else (rx(0,z)-.04)
  box('Onix plate holder',(x,0,z),(.018,.45,.14),'FleetTrim',BLACK,.012)
  box('Onix neutral plate',(x+(.011 if front else -.011),0,z),(.006,.40,.10),'FleetLights',(.76,.80,.83,1),.006)
  box('Onix plate blue header',(x+(.015 if front else -.015),0,z+.036),(.004,.40,.015),'FleetLights',(.01,.08,.4,1),.002)
 patch('Onix rear lower valance',[(-.67,.27),(.67,.27),(.60,.48),(-.60,.48)],False,'FleetTrim',BLACK,.017)
 box('Onix undertray',(0,0,.22),(3.55,1.3,.07),'FleetInterior',bevel=.03)
 box('Onix dashboard',(.64,0,.98),(.25,1.43,.13),'FleetInterior',bevel=.045)
 for x in (-.08,-.89):
  for side in (-1,1):
   box('Onix seat',(x,side*.37,.91),(.17,.38,.44),'FleetInterior',bevel=.045)
   box('Onix headrest',(x,side*.37,1.16),(.12,.23,.16),'FleetInterior',bevel=.045)
 d['_headlightHeight']=.91;d['_tailLampHeight']=.99
