import * as THREE from 'three';
import { GLASS_REFLECTION } from './glass-reflection.js';

// One metric atlas: each padded tile covers 1 x 2 metres, independent of lot size.
export const SURFACE = Object.freeze({ plaster: 0, brick: 1, roof: 2, trim: 3, stone: 4, litGlass: 5, glass: 6, door: 7 });
let shared;
const hash = (x, y) => { let n = Math.imul(x + 131, 374761393) ^ Math.imul(y + 719, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return (n >>> 0) / 4294967295; };
const mod = (x, n) => (x % n + n) % n;
const palette = [[201,190,167],[153,91,66],[72,82,93],[205,196,174],[181,170,149],[62,86,100],[62,86,100],[52,67,69]];

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
    rough=joint?.95:(brick?.9:.75)+tone*.05;
  }else if(surface===SURFACE.roof){
    const row=Math.floor(v*6),column=Math.floor(u*4+(row%2)*.5);
    const rx=mod(u*4+(row%2)*.5,1),ry=mod(v*6,1);
    const tone=hash(mod(column,4),row)-.5;
    shade=.96+tone*.09+fine*.012;
    if(rx<.018||ry<.03)shade*=.87;
    height=ry<.03?-.0006:.0006*(1-ry);rough=.79+tone*.06;
  }else if(surface===SURFACE.glass||surface===SURFACE.litGlass){
    // flat, dark, cool pane: sky reflection comes from glass-reflection.js, not baked gradients
    color=[62,86,100];shade=.95+(hash(Math.floor(u*8),Math.floor(v*16))-.5)*.04;
    height=0;rough=.24;
  }else if(surface===SURFACE.trim){
    height=fine*.00004;rough=.6;metal=0;shade=1+fine*.01;
  }else if(surface===SURFACE.door){
    const edge=Math.min(mod(u*2,1),1-mod(u*2,1),mod(v*3,1),1-mod(v*3,1));
    shade=edge<.07?.81:1+fine*.012;height=edge<.07?-.001:0;rough=.69;
  }else{
    // plaster: metre-scale tone drift (+-2.5%), fine trowel grain, slight roughness variation
    const micro=grain(u,v,30,62)-.5,soft=grain(u,v,2,4)-.5;
    shade=1+soft*.05+micro*.02+fine*.008;
    height=micro*.00015+fine*.00004;rough=.85+soft*.06+micro*.03;
  }
  const emission=surface===SURFACE.litGlass?.78:0;
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
    texture.colorSpace=i===0||i===3?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.anisotropy=4;
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
        e += t.rgb * (window * step(3.2, y) * step(0.72, r) * (0.2 + 0.12 * floodHash(vec3(bay + 7.0, side))) + window * base * step(0.98, r) * 0.08); }
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

function metricAtlas(material) {
  material.customProgramCacheKey=()=> material.name+'-metric-atlas-v6';
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float aSurface; varying float vSliceSurface; varying float vSliceY;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSliceSurface = aSurface; vSliceY = (modelMatrix * vec4(position,1.0)).y;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying float vSliceSurface; varying float vSliceY;
      vec4 sliceSample(sampler2D tex,vec2 uv){
        vec2 tile=vec2(mod(vSliceSurface,4.0),floor(vSliceSurface/4.0));
        vec2 scale=vec2(120.0/512.0,124.0/512.0);
        vec2 p=(tile*vec2(128.0,256.0)+4.0+fract(uv/vec2(1.0,2.0))*vec2(120.0,248.0))/512.0;
        return textureGrad(tex,p,dFdx(uv)*scale,dFdy(uv)*scale);
      }`);
    // Keep continuous metric UVs for the tangent frame; wrap only texture sampling.
    for(const chunk of ['map_fragment','normal_fragment_maps','roughnessmap_fragment','metalnessmap_fragment','emissivemap_fragment']) {
      const code=THREE.ShaderChunk[chunk].replace(/texture2D\(\s*(map|normalMap|roughnessMap|metalnessMap|emissiveMap)\s*,\s*(v\w+Uv)\s*\)/g,'sliceSample( $1, $2 )');
      shader.fragmentShader=shader.fragmentShader.replace(`#include <${chunk}>`,code);
    }
    // subtle ground grime: <=7% darkening on walls, fading over 1.5 m
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      if(vSliceSurface<4.5&&vSliceSurface!=2.0) diffuseColor.rgb*=1.0-0.07*(1.0-smoothstep(0.0,1.5,vSliceY));`);
    if(material.name==='slice-glass'){
      // lit panes: whole-pane warm glow with slight per-cell tone shift (no sub-pane grain)
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        { vec2 c=floor(vMapUv/vec2(1.0,2.0)); float h=fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);
          totalEmissiveRadiance*=(0.88+0.24*h)*vec3(1.0,0.97+0.06*h,0.92+0.14*h); }`);
      shader.uniforms.uGlassNight=night;
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform float uGlassNight;
${GLASS_REFLECTION}`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        vec3 glassView=normalize(vViewPosition);
        float grazing=pow(1.0-clamp(dot(normal,glassView),0.0,1.0),2.8);
        vec3 reflected=inverseTransformDirection(reflect(-glassView,normal),viewMatrix);
        float litWindow=1.0-step(0.25,abs(vSliceSurface-5.0));
        float reflectionWeight=(0.38+grazing*0.36)*(1.0-uGlassNight*litWindow*0.82);
        outgoingLight=mix(outgoingLight,glassReflection(reflected,uGlassNight),reflectionWeight);
        #include <opaque_fragment>`);
    }
    floodShader(shader, material.name==='slice-glass');
  };
  return material;
}

export function townhouseMaterials() {
  if(shared) return shared;
  const [map,normalMap,orm,emissiveMap]=makeMaps();
  const architecture=metricAtlas(new THREE.MeshStandardMaterial({name:'slice-architecture',vertexColors:true,map,normalMap,normalScale:new THREE.Vector2(.65,.65),roughnessMap:orm,metalnessMap:orm,roughness:1,metalness:1}));
  const glass=metricAtlas(new THREE.MeshStandardMaterial({name:'slice-glass',vertexColors:true,map,roughness:.24,metalness:0,emissiveMap}));
  glass.userData={analyticReflection:true,glow:true,glowColor:new THREE.Color('#fff2dc'),glowK:1.05,uNight:night}; // sky.js drives night for glass + floodlights
  return shared={architecture,glass};
}
