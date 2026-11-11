import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLASS_REFLECTION } from './glass-reflection.js';
import { streetEnvironment } from './streetscape-state.js';

// Height and analytic slope share the same six impact sources in both shader stages.
const BASIN_FIELD = /* glsl */`
vec3 basinField(vec2 p, float t) {
  vec2 a = vec2(.86,.51), b = vec2(-.43,.90);
  float u = dot(p,a)*3.2-t*1.25, v = dot(p,b)*5.4+t*1.65;
  float h = .0035*sin(u)+.0025*sin(v);
  vec2 slope = .0112*cos(u)*a+.0135*cos(v)*b;
  for(int i=0;i<6;i++) {
    float angle=float(i)*1.04719755;
    vec2 d=p-vec2(cos(angle),sin(angle))*.95;
    float r=length(d), phase=r*18.0-t*3.0+float(i)*.7, decay=exp(-r*1.6);
    h += .0018*sin(phase)*decay;
    slope += .0018*decay*(18.0*cos(phase)-1.6*sin(phase))*d/max(r,.035);
  }
  float pin=smoothstep(.64,.82,length(p))*(1.0-smoothstep(2.3,2.5,length(p)));
  return vec3(h,slope)*pin;
}`;

export function createPlazaWater() {
  const curves=[];
  const parts = [new THREE.RingGeometry(.64, 2.50, 64, 6).rotateX(-Math.PI / 2).translate(0, .34, 0)];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,.73,0), new THREE.Vector3(Math.cos(a)*.35,1.45,Math.sin(a)*.35), new THREE.Vector3(Math.cos(a)*.95,.34,Math.sin(a)*.95));
    curves.push(curve);parts.push(new THREE.TubeGeometry(curve, 20, .025, 5, false));
  }
  parts.forEach((g,k)=>{
    const data=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<g.attributes.position.count;i++){data[i*3]=k?1:0;data[i*3+1]=k?curves[k-1].getUtoTmapping(g.attributes.uv.getX(i)):0;data[i*3+2]=Math.max(0,k-1)*Math.PI/3;}
    g.setAttribute('aWater',new THREE.BufferAttribute(data,3));
  });
  const geometry = mergeGeometries(parts); parts.forEach(g => g.dispose());
  const night = { value: 0 };
  const material = new THREE.MeshStandardMaterial({ name: 'hero-fountain-water-material', color: '#71918a', roughness: .14, metalness: 0, emissive: '#000000' });
  material.userData = { glow: true, glowColor: new THREE.Color('#597b72'), glowK: .05, uNight: night };
  material.customProgramCacheKey = () => 'hero-fountain-water-3';
  material.onBeforeCompile = shader => {
    shader.uniforms.uPlazaTime = streetEnvironment.time; shader.uniforms.uPlazaNight = night;
    const common='\nuniform float uPlazaTime; varying vec3 vBasin, vWater;\n'+BASIN_FIELD;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aWater;'+common)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vBasin=position;vWater=aWater;
        if(aWater.x<.5) transformed.y+=basinField(position.xz,uPlazaTime).x;
        else {
          float t=aWater.y, a=aWater.z;
          vec3 p0=vec3(0,.73,0), p1=vec3(cos(a)*.35,1.45,sin(a)*.35), p2=vec3(cos(a)*.95,.34,sin(a)*.95);
          vec3 centre=mix(mix(p0,p1,t),mix(p1,p2,t),t);
          float flow=.78+.22*sin(t*45.0-uPlazaTime*9.0+a);
          transformed=centre+(position-centre)*flow;
          float sway=sin(t*3.14159265)*.018*sin(t*18.0-uPlazaTime*5.0+a);
          transformed.xz+=vec2(-sin(a),cos(a))*sway;
          transformed.y+=basinField(p2.xz,uPlazaTime).x*pow(t,8.0);
        }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>'+common+'\nuniform float uPlazaNight;\n'+GLASS_REFLECTION)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if(vWater.x<.5){vec3 field=basinField(vBasin.xz,uPlazaTime);normal=normalize(mat3(viewMatrix)*vec3(-field.y,1.0,-field.z));}`)
      .replace('#include <opaque_fragment>', `
        vec3 viewDirection=normalize(vViewPosition);
        float fresnel=.02+.98*pow(1.0-max(dot(normal,viewDirection),0.0),5.0);
        vec3 reflected=inverseTransformDirection(reflect(-viewDirection,normal),viewMatrix);
        vec3 sky=glassReflection(reflected,uPlazaNight);
        if(vWater.x<.5){
          float radius=length(vBasin.xz), foam=0.0;
          for(int i=0;i<6;i++){
            float a=float(i)*1.04719755, r=length(vBasin.xz-vec2(cos(a),sin(a))*.95);
            foam+=exp(-r*r/0.018)*(.55+.2*sin(r*60.0-uPlazaTime*8.0+float(i)));
          }
          float caustic=pow(.5+.5*sin(vBasin.x*12.0+sin(vBasin.z*8.0+uPlazaTime)) * sin(vBasin.z*11.0-uPlazaTime*.8),5.0);
          vec3 surfaceNormal=inverseTransformDirection(normal,viewMatrix);
          vec2 floorUV=(vBasin.xz+surfaceNormal.xz*.16)/vec2(.65,.85);
          floorUV.x+=mod(floor(floorUV.y),2.0)*.5;
          vec2 joint=min(fract(floorUV),1.0-fract(floorUV));
          float aa=max(max(fwidth(floorUV.x),fwidth(floorUV.y)),.002);
          float detail=1.0-smoothstep(.15,.45,aa);
          float mortar=1.0-smoothstep(.008,.008+aa,min(joint.x,joint.y));
          float slab=fract(sin(dot(floor(floorUV),vec2(12.9898,78.233)))*43758.5453);
          outgoingLight*=vec3(.89,.97,.91)*mix(.86,1.0,smoothstep(.8,2.5,radius))*(1.0+detail*(-.03+.06*slab-.13*mortar));
          outgoingLight=mix(outgoingLight,sky,.035+.80*fresnel);
          outgoingLight+=vec3(.025,.029,.019)*caustic*detail*(1.0-uPlazaNight);
          outgoingLight+=vec3(.045,.026,.009)*smoothstep(2.25,2.5,radius)*(.6+.4*fresnel)*uPlazaNight;
          outgoingLight=mix(outgoingLight,vec3(.62,.69,.65)*(1.0-uPlazaNight*.78),clamp(foam,0.0,1.0)*.52);
        }else{
          float flow=.5+.5*sin(vWater.y*65.0-uPlazaTime*12.0+vWater.z);
          outgoingLight=mix(outgoingLight,mix(sky,vec3(.52,.64,.61)*(1.0-uPlazaNight*.8),.45),.28+.45*fresnel);
          outgoingLight+=vec3(.11,.13,.12)*pow(flow,5.0)*(1.0-uPlazaNight*.85);
        }
        #include <opaque_fragment>`);
  };
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'hero-fountain-water';
  mesh.receiveShadow = true;
  geometry.computeBoundingBox();geometry.boundingBox.expandByScalar(.04);
  geometry.computeBoundingSphere();geometry.boundingSphere.radius+=.04;
  mesh.userData.dispose = () => { geometry.dispose(); material.dispose(); };
  return mesh;
}
