// Opaque pane-local room layers: stable furniture and finishes, no per-window objects or lights.
export const ROOM_SHAPES = `
float roomRect(vec2 p,vec2 lo,vec2 hi) {
  vec2 aa=max(fwidth(p),vec2(.001));
  vec2 mask=smoothstep(lo-aa,lo+aa,p)*(1.0-smoothstep(hi-aa,hi+aa,p));
  return mask.x*mask.y;
}`;
export const ROOM_INTERIOR = `
  vec2 roomPixel = fwidth(vRoom.xy);
  float roomFade = (1.0 - smoothstep(100.0, 180.0, length(vViewPosition)))
    * (1.0 - smoothstep(0.14, 0.30, max(roomPixel.x, roomPixel.y))) * step(0.01, vRoom.w);
  if (roomFade > 0.001) {
    vec3 viewer = inverseTransformDirection(glassView, viewMatrix);
    vec3 wallNormal = inverseTransformDirection(normal, viewMatrix);
    vec3 across = normalize(cross(vec3(0.0, 1.0, 0.0), wallNormal));
    vec3 ray = vec3(-dot(viewer, across) / (4.0 * vRoom.w), -viewer.y, max(dot(viewer, wallNormal), 0.06));
    vec2 entry = clamp(vRoom.xy, 0.0001, 0.9999);
    vec2 sides = mix(entry, 1.0 - entry, step(0.0, ray.xy)) / max(abs(ray.xy), vec2(0.0001));
    float roomSeed=vRoom.z, depth=.65+roomSeed*.65;
    float back=depth/ray.z, distanceToWall=min(min(sides.x,sides.y),back);
    vec3 roomHit=vec3(entry,0.0)+ray*distanceToWall;
    float rear=step(back,min(sides.x,sides.y));
    float floorHit=(1.0-rear)*step(sides.y,sides.x)*(1.0-step(0.0,ray.y));
    float ceiling=(1.0-rear)*step(sides.y,sides.x)*step(0.0,ray.y);
    float wallShade=mix(.72,1.0,rear)*(1.0-.36*floorHit)+ceiling*.18;
    float lamp=fract(roomSeed*7.13+.37);
    float occupied=litWindow*uGlassNight*(lamp>.86?.08:lamp>.70?.46:1.0);
    vec3 daylight=mix(vec3(.13,.15,.15),vec3(.30,.27,.22),roomSeed);
    vec3 light=mix(vec3(.92,.59,.30),vec3(.64,.73,.85),step(.80,roomSeed));
    vec3 illumination=daylight*(1.0-.86*uGlassNight)+light*occupied*.76;
    vec3 roomColor=illumination*wallShade;
    float baseboard=1.0-smoothstep(.025,.055,roomHit.y);
    roomColor*=1.0-.20*baseboard*(1.0-floorHit);
    // Floor grain/rug is projected onto the floor, never baked onto the pane.
    float boardAA=1.0-smoothstep(.08,.25,fwidth(roomHit.x)*8.0);
    float boards=.88+.12*smoothstep(.02,.08,fract(roomHit.x*8.0));
    vec3 floorColor=illumination*vec3(.58,.47,.36)*mix(1.0,boards,boardAA);
    float rug=roomRect(roomHit.xz,vec2(.18,.16),vec2(.82,depth*.78));
    roomColor=mix(roomColor,mix(floorColor,floorColor*vec3(.65,.90,1.15),rug*.7),floorHit);
    float picture=roomRect(roomHit.xy,vec2(.20,.46),vec2(.58,.73))*rear;
    float art=roomRect(roomHit.xy,vec2(.225,.485),vec2(.555,.705))*rear;
    roomColor=mix(roomColor,illumination*vec3(.24,.22,.19),picture);
    roomColor=mix(roomColor,illumination*mix(vec3(.62,.45,.30),vec3(.32,.49,.57),roomSeed),art);
    // One depth layer catches parallax before the rear wall, clipped by the room box.
    float layerDepth=depth*(.48+.15*roomSeed), layerT=layerDepth/ray.z;
    vec2 furniture=entry+ray.xy*layerT;
    float furnitureVisible=1.0-step(distanceToWall,layerT);
    float furnishing=roomSeed<.48
      ? roomRect(furniture,vec2(.12,.04),vec2(.82,.26))
      : roomRect(furniture,vec2(.16,.22),vec2(.85,.26))
        +roomRect(furniture,vec2(.20,.03),vec2(.23,.22))
        +roomRect(furniture,vec2(.77,.03),vec2(.80,.22));
    vec3 furnitureColor=illumination*mix(vec3(.35,.44,.42),vec3(.42,.29,.20),roomSeed);
    roomColor=mix(roomColor,furnitureColor,clamp(furnishing*furnitureVisible,0.0,1.0));
    float shelf=roomRect(furniture,vec2(.78,.04),vec2(.94,.65))*step(.48,roomSeed)*furnitureVisible;
    float shelfLine=.58+.42*smoothstep(.02,.055,fract(furniture.y*7.0));
    roomColor=mix(roomColor,illumination*vec3(.33,.27,.20)*shelfLine,shelf);
    float stem=roomRect(furniture,vec2(.64,.26),vec2(.655,.52));
    float shade=roomRect(furniture,vec2(.59,.49),vec2(.71,.57));
    roomColor=mix(roomColor,illumination*vec3(.6,.5,.35),stem*furnitureVisible);
    roomColor=mix(roomColor,illumination*.8+light*occupied*.25,shade*furnitureVisible);
    vec2 shadePoint=entry+ray.xy*min(distanceToWall,.10/ray.z);
    float blind=smoothstep(.52,.58,shadePoint.y+(roomSeed-.6)*.4);
    float curtain=1.0-smoothstep(.17,.23,min(shadePoint.x,1.0-shadePoint.x));
    float covered=roomSeed<.32?curtain:roomSeed>.65?blind:0.0;
    float fabricAA=1.0-smoothstep(.025,.08,max(roomPixel.x,roomPixel.y));
    float pleats=.88+.12*cos(shadePoint.x*62.83),slats=.90+.10*cos(shadePoint.y*100.53);
    vec3 fabric=(vec3(.25,.23,.19)*(1.0-.72*uGlassNight)+light*occupied*.24)
      *mix(1.0,roomSeed<.32?pleats:slats,fabricAA);
    roomColor=mix(roomColor,fabric,covered);
    float edge=min(min(entry.x,1.0-entry.x)*(4.0*vRoom.w),min(entry.y,1.0-entry.y));
    float revealShadow=smoothstep(0.0,.065,edge);
    roomColor*=mix(.44,1.0,revealShadow);
    outgoingLight=mix(outgoingLight,roomColor,roomFade*(1.0-.35*grazing));
    reflectionWeight=mix(reflectionWeight,(.24+.58*grazing)*mix(.60,1.0,revealShadow),roomFade);
  }`;
