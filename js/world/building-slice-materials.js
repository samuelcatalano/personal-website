import { streetEnvironment, STREET_WIND } from './streetscape-state.js';
import * as THREE from 'three';
import { GLASS_REFLECTION } from './glass-reflection.js';

// One metric atlas: each padded tile covers 1 x 2 metres, independent of lot size.
export const SURFACE = Object.freeze({ plaster: 0, brick: 1, roof: 2, trim: 3, stone: 4, litGlass: 5, glass: 6, door: 7 });
let shared, landmarkSet;
const hash = (x, y) => { let n = Math.imul(x + 131, 374761393) ^ Math.imul(y + 719, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return (n >>> 0) / 4294967295; };
const mod = (x, n) => (x % n + n) % n;
const palette = [[220,211,191],[160,96,73],[68,80,94],[230,221,201],[196,186,164],[65,94,112],[65,94,112],[52,67,69]];

// Periodic, interpolated grain avoids a visible seam or a low-frequency sine pattern.
function grain(u,v,columns,rows) {
  const x=u*columns,y=v*rows,ix=Math.floor(x),iy=Math.floor(y);
  const fx=x-ix,fy=y-iy,s=fx*fx*(3-2*fx),t=fy*fy*(3-2*fy);
  const h=(dx,dy)=>hash(mod(ix+dx,columns),mod(iy+dy,rows));
  return (h(0,0)*(1-s)+h(1,0)*s)*(1-t)+(h(0,1)*(1-s)+h(1,1)*s)*t;
}
function texel(surface, x, y) {
  const u=mod(x-4,120)/120,v=mod(y-4,248)/248;
  const fine=hash(Math.floor(u*120),Math.floor(v*248))-.5;
  let color=palette[surface],shade=1+fine*.012,height=fine*.00008,rough=.84,metal=0;
  if(surface===SURFACE.brick||surface===SURFACE.stone){
    const brick=surface===SURFACE.brick,rows=brick?24:8,columns=brick?4:2;
    const row=Math.floor(v*rows),column=Math.floor(u*columns+(row%2)*.5);
    const bx=mod(u*columns+(row%2)*.5,1),by=mod(v*rows,1);
    const joint=Math.min(bx,1-bx)<.018||Math.min(by,1-by)<.045;
    const tone=hash(mod(column,columns),row)-.5;
    color=joint?(brick?[168,150,128]:[169,159,141]):color.map((c,i)=>c+tone*(brick?[26,16,12]:[12,10,8])[i]);
    shade=1+fine*.02; height=joint?-.0008:fine*.0002;
    rough=joint?.95:(brick?.86:.78)+tone*.05;
  }else if(surface===SURFACE.roof){
    const row=Math.floor(v*6),column=Math.floor(u*4+(row%2)*.5);
    const rx=mod(u*4+(row%2)*.5,1),ry=mod(v*6,1);
    const tone=hash(mod(column,4),row)-.5;
    shade=.96+tone*.09+fine*.012;
    if(rx<.018||ry<.03)shade*=.87;
    height=ry<.03?-.0006:.0006*(1-ry);rough=.79+tone*.06;
  }else if(surface===SURFACE.glass||surface===SURFACE.litGlass){
    // flat, dark, cool pane: sky reflection comes from glass-reflection.js, not baked gradients
    color=[65,94,112];shade=.95+(hash(Math.floor(u*8),Math.floor(v*16))-.5)*.04;
    height=0;rough=.24;
  }else if(surface===SURFACE.trim){
    height=fine*.00004;rough=.64;metal=0;shade=1+fine*.01;
  }else if(surface===SURFACE.door){
    const edge=Math.min(mod(u*2,1),1-mod(u*2,1),mod(v*3,1),1-mod(v*3,1));
    shade=edge<.07?.81:1+fine*.012;height=edge<.07?-.001:0;rough=.69;
  }else{
    // plaster: metre-scale tone drift (+-2.5%), fine trowel grain, slight roughness variation
    const micro=grain(u,v,30,62)-.5,soft=grain(u,v,2,4)-.5;
    shade=1+soft*.05+micro*.02+fine*.008;
    height=micro*.00015+fine*.00004;rough=.83+soft*.06+micro*.03;
  }
  const emission=surface===SURFACE.litGlass?.68:0;
  return {rgb:color.map(c=>Math.max(0,Math.min(255,c*shade))),height,rough,metal,emission};
}

function makeMaps() {
  const data = Array.from({length:4},()=>new Uint8ClampedArray(512*512*4));
  for (let surface=0;surface<8;surface++) for(let y=0;y<256;y++) for(let x=0;x<128;x++) {
    const p=texel(surface,x,y), hx=texel(surface,x+1,y).height-texel(surface,x-1,y).height, hy=texel(surface,x,y+1).height-texel(surface,x,y-1).height;
    const normal=new THREE.Vector3(-hx*220,hy*220,1).normalize();
    const i=(((1-Math.floor(surface/4))*256+y)*512+(surface%4)*128+x)*4;
    const emission=[162,123,77].map(c=>c*p.emission);
    [ [...p.rgb,255],[(normal.x*.5+.5)*255,(normal.y*.5+.5)*255,(normal.z*.5+.5)*255,255],[255,p.rough*255,p.metal*255,255],[...emission,255] ].forEach((rgba,k)=>data[k].set(rgba,i));
  }
  return data.map((pixels,i)=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const ctx=canvas.getContext('2d');ctx.putImageData(new ImageData(pixels,512,512),0,0);
    const image=i===3?document.createElement('canvas'):canvas;
    if(i===3){image.width=image.height=256;image.getContext('2d').drawImage(canvas,0,0,256,256);}
    const texture=new THREE.CanvasTexture(image);texture.name=['slice-albedo','slice-normal','slice-orm','slice-emissive'][i];
    texture.colorSpace=i===0||i===3?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.anisotropy=16; // desktop: window panes and facade grain stay crisp at grazing angles (moire at distance with 4)
    return texture;
  });
}

// Night floodlights for landmarks (world-space boxes, so the shared materials stay shared). mode 0: warm/cool wash brightest at
// the base, fading up the facade, walls more than roofs. mode 1: scattered lit window cells (Copan). Driven by the glass uNight.
const FLOOD_MAX = 8, flood = { count: { value: 0 }, box: { value: Array.from({ length: FLOOD_MAX }, () => new THREE.Vector4()) }, y: { value: Array.from({ length: FLOOD_MAX }, () => new THREE.Vector2()) }, tone: { value: Array.from({ length: FLOOD_MAX }, () => new THREE.Vector4()) } };
export function addFloodlight(bounds, color, mode = 0, gain = 1) {
  const i = flood.count.value; if (i >= FLOOD_MAX) return;
  flood.box.value[i].set(bounds.min.x - 0.3, bounds.max.x + 0.3, bounds.min.z - 0.3, bounds.max.z + 0.3); flood.y.value[i].set(bounds.min.y, bounds.max.y);
  const c = new THREE.Color(color).multiplyScalar(gain); flood.tone.value[i].set(c.r, c.g, c.b, mode); flood.count.value = i + 1;
}
export function resetFloodlights() { flood.count.value = 0; }
const FLOOD_GLSL = `uniform int uFloodCount; uniform vec4 uFloodBox[${FLOOD_MAX}]; uniform vec2 uFloodY[${FLOOD_MAX}]; uniform vec4 uFloodTone[${FLOOD_MAX}]; uniform float uFloodNight; varying vec3 vFloodP;
  float floodHash(vec3 c){ return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  vec3 floodlight(vec3 albedo, vec3 n, bool glass){
    vec3 e = vec3(0.0);
    for (int i = 0; i < ${FLOOD_MAX}; i++) {
      if (i >= uFloodCount) break;
      vec4 b = uFloodBox[i]; if (vFloodP.x < b.x || vFloodP.x > b.y || vFloodP.z < b.z || vFloodP.z > b.w || vFloodP.y > uFloodY[i].y + 0.5) continue;
      vec4 t = uFloodTone[i]; float h = clamp((vFloodP.y - uFloodY[i].x) / max(1.0, uFloodY[i].y - uFloodY[i].x), 0.0, 1.0);
      if (t.w < 0.5) { float face = 0.22 + 0.78 * pow(max(0.0, dot(n, normalize(vec3(0.25, 0.25, 1.0)))), 1.3); // lamps on the street side, below
        e += albedo * t.rgb * (1.0 - 0.8 * smoothstep(0.0, 1.0, h)) * (1.0 + 0.8 * (1.0 - smoothstep(0.0, 0.12, h))) * face * (glass ? 0.3 : 1.0); }
      else if (glass) { float y = vFloodP.y - uFloodY[i].x, base = 1.0 - step(3.2, y), gridY = y - 3.2 * (1.0 - base);
        vec2 bay = vec2(floor((vFloodP.x - b.x) / 1.5), floor(gridY / 3.0)), pane = vec2(fract((vFloodP.x - b.x) / 1.5), fract(gridY / 3.0));
        float side = step(0.0, n.z), r = floodHash(vec3(bay, side)), window = step(0.14, pane.x) * (1.0 - step(0.86, pane.x)) * step(0.18, pane.y) * (1.0 - step(0.78, pane.y));
        e += t.rgb * (window * step(3.2, y) * step(0.58, r) * (0.34 + 0.2 * floodHash(vec3(bay + 7.0, side))) + window * base * step(0.98, r) * 0.08); }
    }
    return e * uFloodNight;
  }`;
function floodShader(shader, glass) {
  Object.assign(shader.uniforms, { uFloodCount: flood.count, uFloodBox: flood.box, uFloodY: flood.y, uFloodTone: flood.tone, uFloodNight: night });
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFloodP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloodP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + FLOOD_GLSL)
    .replace('#include <opaque_fragment>', `outgoingLight += floodlight(diffuseColor.rgb, inverseTransformDirection(normal, viewMatrix), ${glass});\n#include <opaque_fragment>`);
}
const night = { value: 0 };

// Office recess shading (office glass only): the spandrel shades the top of each pane, the piers shade its sides, each pane carries a small deterministic tone (vPane.z).
const OFFICE_RECESS=`float recessTop=smoothstep(0.76,1.0,vPane.y);
        float recessSide=min(1.0,(1.0-smoothstep(0.0,0.14,vPane.x))+(1.0-smoothstep(0.0,0.14,1.0-vPane.x)));
        outgoingLight*=mix((1.0-0.5*recessTop-0.26*recessSide)*(1.0+(vPane.z-0.5)*0.12),1.0,litWindow*uGlassNight);`;
// Facade weathering knobs (shader-only, world-space so LOD/batch changes never re-roll a look).
const FACADE_GRIME = 1.0;      // 0 = clean walls; scales base grime, damp tint, ledge soot and streaks together
const FACADE_VARIATION = 0.07; // per-building value/hue spread (fraction)
const FACADE_DETAIL_NEAR = 14.0; // metres: close-range stucco/brick grain fades out by here
// ponytail: the per-building seed is smooth world-space value noise (~13 m period), not a true lot id: neighbours in a terrace
// blend instead of switching at party walls. Upgrade path: bake a per-lot seed attribute at build time (city-rollout.js).
const FACADE_GLSL = `
  float sliceHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float sliceNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sliceHash(i), sliceHash(i + vec2(1.0, 0.0)), f.x), mix(sliceHash(i + vec2(0.0, 1.0)), sliceHash(i + vec2(1.0)), f.x), f.y); }`;
const facadeWeather = cityWalls => `
  vec3 facadeN = inverseTransformDirection(normalize(vNormal), viewMatrix);
  float facadeSeed = sliceNoise(vFloodP.xz / 13.0), facadeSeed2 = sliceNoise(vFloodP.xz / 13.0 + 17.3);
  float facadeAlong = dot(vFloodP.xz, normalize(vec2(-facadeN.z, facadeN.x) + 1e-4)); // metres along the wall
  float facadeWall = (1.0 - step(4.5, vSliceSurface)) * step(0.1, abs(vSliceSurface - 2.0)); // plaster/brick/trim/stone, not roof
  ${cityWalls ? 'float facadeMoisture = 0.0;' : ''}
  if (facadeWall > 0.5) {
    float v = (facadeSeed - 0.5) * ${FACADE_VARIATION.toFixed(3)}, w = (facadeSeed2 - 0.5) * ${FACADE_VARIATION.toFixed(3)};
    diffuseColor.rgb *= (1.0 + v) * vec3(1.0 + w, 1.0, 1.0 - w);
    float dirt = ${FACADE_GRIME.toFixed(2)} * (0.55 + 0.9 * facadeSeed2);
    float base = 1.0 - smoothstep(0.0, 2.6, vFloodP.y), damp = 1.0 - smoothstep(0.0, 0.7, vFloodP.y);
    float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(0.93, 0.91, 0.87), 0.22 * base * dirt);
    diffuseColor.rgb *= (1.0 - 0.08 * base * dirt) * mix(vec3(1.0), vec3(0.92, 0.97, 0.89), damp * dirt * 0.5);
    diffuseColor.rgb *= 1.0 - 0.14 * dirt * smoothstep(0.55, 0.95, facadeN.y); // soot on sills, ledges, cornice tops
    ${cityWalls ? 'diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(0.35, 0.85, -facadeN.y);' : ''} // recessed undersides and overhangs
    float vertical = 1.0 - smoothstep(0.25, 0.5, abs(facadeN.y));
    float sx = facadeAlong * 1.2, aa = 1.0 - smoothstep(0.25, 0.6, fwidth(sx)); // fade before streaks alias (no shimmer at range)
    float runoff = sliceNoise(vec2(sx, vFloodP.y * 0.09 + facadeSeed * 9.0));
    float streak = smoothstep(0.62, 0.9, runoff);
    float storey = fract((vFloodP.y - 0.85) / 3.0);
    float belowSill = ${cityWalls ? 'smoothstep(0.18, 0.86, storey) * (1.0 - smoothstep(0.90, 1.0, storey))' : '1.0 - storey'};
    diffuseColor.rgb *= 1.0 - ${cityWalls ? '0.06' : '0.14'} * dirt * streak * belowSill * vertical * aa * step(0.35, facadeSeed2 + 0.25);
    ${cityWalls ? `
      float dampPatch = smoothstep(0.35, 0.83, runoff) * aa;
      float risingDamp = 1.0 - smoothstep(0.12, 0.45 + dampPatch * 1.2, vFloodP.y);
      float porous = step(0.25, abs(vSliceSurface - 3.0));
      facadeMoisture = clamp((risingDamp * 0.75 + dampPatch * belowSill * 0.12) * vertical * porous, 0.0, 1.0);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.74, 0.79, 0.78), facadeMoisture);
    ` : ''}
  }`;
const FACADE_RELIEF = `
  float masonry = 1.0 - step(0.25, min(abs(vSliceSurface - 1.0), abs(vSliceSurface - 4.0)));
  float plaster = 1.0 - step(0.25, abs(vSliceSurface));
  float relief = 0.75 * masonry + 0.15 * plaster;
  if (relief > 0.0) normal = normalize(normal + (normal - nonPerturbedNormal) * relief);`;
const FACADE_DETAIL = `
  if (facadeWall > 0.5) {
    float near = 1.0 - smoothstep(${(FACADE_DETAIL_NEAR * 0.45).toFixed(1)}, ${FACADE_DETAIL_NEAR.toFixed(1)}, length(vViewPosition));
    vec2 q = vec2(facadeAlong, vFloodP.y) * 14.0;
    near *= 1.0 - smoothstep(0.4, 0.9, fwidth(q.x) + fwidth(q.y));
    if (near > 0.0) { float a = sliceNoise(q), b = sliceNoise(q.yx + 5.3);
      normal = normalize(normal + vec3(a - 0.5, b - 0.5, 0.0) * 0.16 * near); }
  }`;
// Trace a shallow room box behind the opaque pane. Coordinates are in pane-height units.
const ROOM_INTERIOR = `
  vec2 roomPixel = fwidth(vRoom.xy);
  float roomFade = (1.0 - smoothstep(42.0, 76.0, length(vViewPosition)))
    * (1.0 - smoothstep(0.14, 0.30, max(roomPixel.x, roomPixel.y))) * step(0.01, vRoom.w);
  if (roomFade > 0.001) {
    vec3 viewer = inverseTransformDirection(glassView, viewMatrix);
    vec3 wallNormal = inverseTransformDirection(normal, viewMatrix);
    vec3 across = normalize(cross(vec3(0.0, 1.0, 0.0), wallNormal));
    vec3 ray = vec3(-dot(viewer, across) / (4.0 * vRoom.w), -viewer.y, max(dot(viewer, wallNormal), 0.06));
    vec2 entry = clamp(vRoom.xy, 0.0001, 0.9999);
    vec2 sides = mix(entry, 1.0 - entry, step(0.0, ray.xy)) / max(abs(ray.xy), vec2(0.0001));
    float back = 0.78 / ray.z, distanceToWall = min(min(sides.x, sides.y), back);
    vec3 roomHit = vec3(entry, 0.0) + ray * distanceToWall;
    float wallShade = back <= min(sides.x, sides.y) ? 1.0 : (sides.y <= sides.x ? mix(0.51, 1.15, step(0.0, ray.y)) : 0.72);
    float roomSeed = vRoom.z, lamp = fract(roomSeed * 7.13 + 0.37);
    float occupied = litWindow * uGlassNight * (lamp > 0.86 ? 0.08 : lamp > 0.70 ? 0.46 : 1.0);
    vec3 daylight = mix(vec3(0.10, 0.12, 0.13), vec3(0.24, 0.22, 0.18), roomSeed);
    vec3 light = mix(vec3(0.92, 0.59, 0.30), vec3(0.64, 0.73, 0.85), step(0.80, roomSeed));
    vec3 roomColor = (daylight * (1.0 - 0.86 * uGlassNight) + light * occupied * 0.76) * wallShade;
    roomColor *= mix(0.72, 1.0, smoothstep(0.02, 0.2, min(roomHit.y, 1.0 - roomHit.y)));
    vec2 shadePoint = entry + ray.xy * min(distanceToWall, 0.10 / ray.z);
    float blind = smoothstep(0.52, 0.58, shadePoint.y + (roomSeed - 0.6) * 0.4);
    float curtain = 1.0 - smoothstep(0.17, 0.23, min(shadePoint.x, 1.0 - shadePoint.x));
    float covered = roomSeed < 0.32 ? curtain : roomSeed > 0.65 ? blind : 0.0;
    float fabricAA = 1.0 - smoothstep(0.025, 0.08, max(roomPixel.x, roomPixel.y));
    float pleats = 0.88 + 0.12 * cos(shadePoint.x * 62.83);
    float slats = 0.90 + 0.10 * cos(shadePoint.y * 100.53);
    vec3 fabric = (vec3(0.25, 0.23, 0.19) * (1.0 - 0.72 * uGlassNight) + light * occupied * 0.24)
      * mix(1.0, roomSeed < 0.32 ? pleats : slats, fabricAA);
    roomColor = mix(roomColor, fabric, covered);
    float edge = min(min(entry.x, 1.0 - entry.x) * (4.0 * vRoom.w), min(entry.y, 1.0 - entry.y));
    float revealShadow = smoothstep(0.0, 0.065, edge);
    roomColor *= mix(0.48, 1.0, revealShadow);
    outgoingLight = mix(outgoingLight, roomColor, roomFade * (1.0 - 0.35 * grazing));
    reflectionWeight = mix(reflectionWeight, (0.27 + 0.58 * grazing) * mix(0.60, 1.0, revealShadow), roomFade);
  }`;
function metricAtlas(material, cityWalls = false) {
  material.customProgramCacheKey=()=> material.name+(cityWalls||material.name==='slice-glass-city'?'-metric-atlas-v11':'-metric-atlas-v8');
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float aSurface; varying float vSliceSurface; varying float vSliceY;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSliceSurface = aSurface; vSliceY = (modelMatrix * vec4(position,1.0)).y;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying float vSliceSurface; varying float vSliceY;
      vec4 sliceSample(sampler2D tex,vec2 uv){
        vec2 tile=vec2(mod(vSliceSurface,4.0),floor(vSliceSurface/4.0));
        vec2 scale=vec2(120.0/512.0,124.0/512.0);
        vec2 p=(tile*vec2(128.0,256.0)+4.0+fract(uv/vec2(1.0,2.0))*vec2(120.0,248.0))/512.0;
        return textureGrad(tex,p,dFdx(uv)*scale,dFdy(uv)*scale);
      }
      ${FACADE_GLSL}`);
    const architecture=material.name==='slice-architecture';
    if (architecture) {
      material.defaultAttributeValues = { aFlutter: [0] };
      shader.uniforms.uStreetTime = streetEnvironment.time;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFlutter; uniform float uStreetTime;\n' + STREET_WIND)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          if (aFlutter > 0.0) {
          vec2 anchor = (modelMatrix * vec4(position, 1.0)).xz;
          transformed.y += aFlutter * 0.012 * streetGust(uStreetTime, anchor);
          transformed.x += aFlutter * 0.006 * streetGust(uStreetTime, anchor); }`);
    }
    // Keep continuous metric UVs for the tangent frame; wrap only texture sampling.
    for(const chunk of ['map_fragment','normal_fragment_maps','roughnessmap_fragment','metalnessmap_fragment','emissivemap_fragment']) {
      const code=THREE.ShaderChunk[chunk].replace(/texture2D\(\s*(map|normalMap|roughnessMap|metalnessMap|emissiveMap)\s*,\s*(v\w+Uv)\s*\)/g,'sliceSample( $1, $2 )');
      let finish = '';
      if (architecture && chunk === 'normal_fragment_maps') finish = (cityWalls ? FACADE_RELIEF : '') + FACADE_DETAIL;
      if (cityWalls && chunk === 'roughnessmap_fragment') finish = '\nroughnessFactor *= 1.0 - 0.23 * facadeMoisture;';
      if (chunk === 'emissivemap_fragment' && material.name.startsWith('slice-glass') && material.name !== 'slice-glass-landmark') finish = `
        { vec2 cell = floor(vMapUv / vec2(1.0, 2.0));
          float h = fract(sin(dot(cell + floor(vFloodP.xz / 13.0), vec2(12.9898, 78.233))) * 43758.5453);
          ${material.name === 'slice-glass-city' ? 'if (vRoom.w > 0.0) h = vRoom.z;' : ''}
          float k = fract(h * 7.13 + 0.37);
          vec3 tone = mix(vec3(1.0, 0.88, 0.76), vec3(0.89, 0.94, 1.0), smoothstep(0.76, 0.96, h));
          totalEmissiveRadiance *= tone * (k > 0.86 ? 0.1 : k > 0.7 ? 0.6 : 1.0) * smoothstep(0.12 + 0.22 * h, 0.42 + 0.22 * h, uGlassNight); }`;
      shader.fragmentShader=shader.fragmentShader.replace(`#include <${chunk}>`,code+finish);
    }
    // weathering + per-building variation on walls (supersedes the old uniform ground grime); doors and roofs are untouched
    if(architecture) shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      ${facadeWeather(cityWalls)}`);
    if (cityWalls) {
      shader.uniforms.uEntryNight = night;
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uEntryNight;')
        .replace('#include <opaque_fragment>', `
          float entry = (1.0 - step(0.25, abs(vSliceSurface - 7.0))) * (1.0 - smoothstep(2.0, 2.8, vFloodP.y));
          outgoingLight += vec3(0.10, 0.055, 0.025) * entry * smoothstep(0.3, 0.7, uEntryNight) * step(0.45, facadeSeed);
          #include <opaque_fragment>`);
    }
    if(material.name==='slice-glass-office'){
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 aPane; varying vec3 vPane;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPane = aPane;');
    }
    if(material.name.startsWith('slice-glass')){
      const office=material.name==='slice-glass-office';
      const rooms=material.name==='slice-glass-city';
      const cityLighting=material.name!=='slice-glass-landmark';
      if(rooms) shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 aRoom; varying vec4 vRoom;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvRoom = aRoom;');
      // lit panes: whole-pane warm glow with slight per-cell tone shift (no sub-pane grain)
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        { vec2 c=floor(vMapUv/vec2(1.0,2.0)); float h=fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);
          ${rooms?'if (vRoom.w > 0.0) h = vRoom.z;':''}
          float k=fract(h*7.13+0.37), curtain=fract(h*13.7+0.11);
          vec3 tone=curtain<0.5?vec3(1.0,0.97+0.06*h,0.92+0.14*h):curtain<0.75?vec3(1.0,0.86,0.7):curtain<0.9?vec3(0.86,0.92,1.0):vec3(1.0,0.8,0.78); // warm, amber blind, cool TV/LED, rose curtain
          totalEmissiveRadiance*=(0.88+0.24*h)*tone*(k>0.86?0.1:k>0.7?0.6:1.0); }`); // ~14% dark, ~16% dimmed behind blinds
      shader.uniforms.uGlassNight=night;
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform float uGlassNight;
${office?'varying vec3 vPane;':''}
${rooms?'varying vec4 vRoom;':''}
${GLASS_REFLECTION}`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        vec3 glassView=normalize(vViewPosition);
        float grazing=pow(1.0-clamp(dot(normal,glassView),0.0,1.0),2.8);
        vec3 reflected=inverseTransformDirection(reflect(-glassView,normal),viewMatrix);
        float litWindow=1.0-step(0.25,abs(vSliceSurface-5.0));
        float reflectionWeight=(0.38+grazing*0.36)*(1.0-uGlassNight*litWindow*${cityLighting?'0.68':'0.82'})*(0.8+0.4*sliceNoise(vFloodP.xz/13.0+31.0)); // per-building glass reflectivity
        vec3 paneTint=vColor.rgb/max(dot(vColor.rgb,vec3(.3333)),.01); // per-lot glass family tints the sky reflection too
        ${rooms?ROOM_INTERIOR:''}
        outgoingLight=mix(outgoingLight,glassReflection(reflected,uGlassNight)*mix(vec3(1.0),paneTint,.85),reflectionWeight);
        ${office?OFFICE_RECESS:''}
        #include <opaque_fragment>`);
    }
    floodShader(shader, material.name.startsWith('slice-glass'));
  };
  return material;
}

export function townhouseMaterials({ landmark = false } = {}) {
  if (!shared) {
    const [map,normalMap,orm,emissiveMap]=makeMaps();
    const architecture=metricAtlas(new THREE.MeshStandardMaterial({name:'slice-architecture',vertexColors:true,map,normalMap,normalScale:new THREE.Vector2(.65,.65),roughnessMap:orm,metalnessMap:orm,roughness:1,metalness:1}), true);
    const glass=metricAtlas(new THREE.MeshStandardMaterial({name:'slice-glass',vertexColors:true,map,roughness:.24,metalness:0,emissiveMap}));
    glass.userData={analyticReflection:true,glow:true,glowColor:new THREE.Color('#fff2dc'),glowK:1.05,uNight:night}; // sky.js drives night for glass + floodlights
    shared={architecture,glass};
  }
  if (!landmark) return shared;
  if (!landmarkSet) {
    const glass = shared.glass.clone(); glass.name = 'slice-glass-landmark'; glass.userData = { ...shared.glass.userData };
    landmarkSet = { architecture: metricAtlas(shared.architecture.clone()), glass: metricAtlas(glass) };
  }
  return landmarkSet;
}

// Office lot only (building-kit.js): its own glass material on the same atlas and maps, so recess shading never reaches the townhouse, shop, midrise or landmark families.
let officeGlass;
export function officeFacadeMaterials() {
  if(officeGlass) return officeGlass;
  const {glass}=townhouseMaterials();
  const material=metricAtlas(new THREE.MeshStandardMaterial({name:'slice-glass-office',vertexColors:true,map:glass.map,roughness:.24,metalness:0,emissiveMap:glass.emissiveMap}));
  material.userData={...glass.userData}; // same night glow (sky.js drives uNight and emissive from this userData)
  return officeGlass={glass:material};
}
let cityRoomGlass;
export function roomGlassMaterial() {
  if (cityRoomGlass) return cityRoomGlass;
  const { glass } = townhouseMaterials();
  const material = glass.clone();
  material.name = 'slice-glass-city';
  material.userData = { ...glass.userData };
  return cityRoomGlass = metricAtlas(material);
}
const hash3=(x,y,z)=>{const n=Math.sin(x*12.9898+y*78.233+z*37.719)*43758.5453;return n-Math.floor(n);};

// City glass is batched as triangle pairs. Pack local UV, a world-anchored seed and aspect/4.
// A zero aspect keeps the existing reflection for irregular glass and thin edge faces.
export function addRoomCoordinates(geometry, worldX, worldZ) {
  const { position, normal } = geometry.attributes;
  const packed = new Uint16Array(position.count * 4), max = 65535;
  for (let q = 0; !geometry.index && q + 5 < position.count; q += 6) {
    if (Math.abs(normal.getY(q)) > 0.04) continue;
    const nx = normal.getX(q), nz = normal.getZ(q), n = Math.hypot(nx, nz);
    if (n < 0.99) continue;
    const ax = nz / n, az = -nx / n, plane = nx * position.getX(q) + nz * position.getZ(q);
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity, planar = true;
    for (let i = q; i < q + 6; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i), u = ax * x + az * z;
      planar &&= Math.abs(nx * x + nz * z - plane) < 0.003;
      left = Math.min(left, u); right = Math.max(right, u);
      bottom = Math.min(bottom, y); top = Math.max(top, y);
    }
    const w = right - left, h = top - bottom;
    if (!planar || w < 0.20 || h < 0.20) continue;
    const center = (left + right) * 0.5;
    const seed = hash3(Math.round((worldX + ax * center + nx * plane) * 4), Math.round((bottom + top) * 2), Math.round((worldZ + az * center + nz * plane) * 4));
    const aspect = THREE.MathUtils.clamp(w / h, 0.25, 4) * max / 4;
    let corners = 0;
    for (let i = q; i < q + 6; i++) {
      const u = (ax * position.getX(i) + az * position.getZ(i) - left) / w, v = (position.getY(i) - bottom) / h;
      if (Math.max(Math.min(u, 1 - u), Math.min(v, 1 - v)) > 0.015) {
        corners = 0;
        break;
      }
      corners |= 1 << (Math.round(u) + 2 * Math.round(v));
      packed[i * 4] = Math.round(u * max);
      packed[i * 4 + 1] = Math.round(v * max);
      packed[i * 4 + 2] = Math.round(seed * max);
      packed[i * 4 + 3] = Math.round(aspect);
    }
    if (corners !== 15) packed.fill(0, q * 4, (q + 6) * 4);
  }
  geometry.setAttribute('aRoom', new THREE.BufferAttribute(packed, 4, true));
}
// Pane-local coordinates for the office glass (six vertices per pane quad): x across the pane, y up it, z a deterministic per-pane seed. Positions are not changed.
function addPaneCoordinates(geometry){
  const pos=geometry.getAttribute('position');
  if(pos.count%6)throw new TypeError('Office glass is not made of pane quads');
  const out=new Float32Array(pos.count*3);
  for(let q=0;q<pos.count;q+=6){
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,z0=Infinity,z1=-Infinity;
    for(let i=q;i<q+6;i++){x0=Math.min(x0,pos.getX(i));x1=Math.max(x1,pos.getX(i));y0=Math.min(y0,pos.getY(i));y1=Math.max(y1,pos.getY(i));z0=Math.min(z0,pos.getZ(i));z1=Math.max(z1,pos.getZ(i));}
    const alongX=x1-x0>z1-z0,h0=alongX?x0:z0,hs=Math.max((alongX?x1:z1)-h0,1e-6),vs=Math.max(y1-y0,1e-6),seed=hash3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
    for(let i=q;i<q+6;i++){out[i*3]=((alongX?pos.getX(i):pos.getZ(i))-h0)/hs;out[i*3+1]=(pos.getY(i)-y0)/vs;out[i*3+2]=seed;}
  }
  geometry.setAttribute('aPane',new THREE.BufferAttribute(out,3));
  return geometry;
}
// Called by building-kit.js for the approved office lot: adds pane coordinates to the glass bucket and swaps only that bucket's material.
export function applyOfficeFacade(group){
  const glass=group.children[2];
  if(!glass||glass.name!=='office-glass')throw new TypeError('Unexpected office slice layout');
  addPaneCoordinates(glass.geometry);
  glass.material=officeFacadeMaterials().glass;
  return group;
}
