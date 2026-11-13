import * as THREE from 'three';
import { bridgeStreetRoute } from './bridge-exits.js';

export const STREET_HALF = 2.8, STREET_OUTER = STREET_HALF+.12+.5;

export function createBridgeStreet(frame, river, index, {half=STREET_HALF,startHalf=3,lift=0}={}) {
  const local = ([x,z]) => new THREE.Vector3((x-frame.x)*frame.tx+(z-frame.z)*frame.tz,0,-(x-frame.x)*frame.tz+(z-frame.z)*frame.tx);
  const curve = new THREE.CurvePath();
  for (const [i,points] of bridgeStreetRoute(frame,river,index).entries()) {
    const p = points.map(local);
    if(i===0){p[0].y=lift;p[1].y=lift*.66;}
    curve.add(p.length===2 ? new THREE.LineCurve3(...p) : new THREE.CubicBezierCurve3(...p));
  }
  return {curve,length:curve.getLength(),half,startHalf};
}

export function bridgeStreetGeometry({curve,half,startHalf}) {
  const vertices = {road:[],line:[],pave:[],light:[]};
  const geometryCurve = new THREE.CurvePath();geometryCurve.curves.push(...curve.curves);
  const end = curve.getPointAt(1), direction = curve.getTangentAt(1);
  geometryCurve.add(new THREE.LineCurve3(end,end.clone().addScaledVector(direction,18)));
  const total = geometryCurve.getLength(), steps = Math.ceil(total/.75), points = geometryCurve.getSpacedPoints(steps);
  const tangent = new THREE.Vector3();
  const vertex = (i,offset,y) => {
    geometryCurve.getTangentAt(i/steps,tangent);
    const horizontal=Math.hypot(tangent.x,tangent.z);
    return [points[i].x+tangent.z/horizontal*offset,points[i].y+y,points[i].z-tangent.x/horizontal*offset];
  };
  const quad = (bucket,a,b,c,d) => vertices[bucket].push(...a,...b,...c,...a,...c,...d);
  const strip = (bucket,i,a,b,y,a1=a,b1=b) => quad(bucket,vertex(i,a,y),vertex(i,b,y),vertex(i+1,b1,y),vertex(i+1,a1,y));
  for (let i=0;i<steps;i++) {
    const width = half+(startHalf-half)*Math.max(0,1-i*total/steps/6), nextHalf=half+(startHalf-half)*Math.max(0,1-(i+1)*total/steps/6);
    // Winding follows the negative-z bridge direction; normals are made explicit below.
    strip('road',i,-width,width,.12,-nextHalf,nextHalf);
    if (i<8 || i%8<4) strip('line',i,-.06,.06,.142);
    for (const side of [-1,1]) {
      const a=side*width,b=side*(width+.62),a1=side*nextHalf,b1=side*(nextHalf+.62);
      strip('pave',i,Math.min(a,b),Math.max(a,b),.24,Math.min(a1,b1),Math.max(a1,b1));
      const k=side*(width+.06),k1=side*(nextHalf+.06);strip('light',i,k-.06,k+.06,.242,k1-.06,k1+.06);
      const face=[vertex(i,a,.12),vertex(i,a,.24),vertex(i+1,a1,.24),vertex(i+1,a1,.12)];
      quad('light',...(side>0?face.reverse():face));
    }
  }
  const geometries = {};
  for (const [bucket,array] of Object.entries(vertices)) {
    const geo = new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(array,3));
    // The two signed bridge frames must both produce upward-facing road and pavement.
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i+=3){
      const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2),n=b.clone().sub(a).cross(c.clone().sub(a));
      if(n.y<0){p.setXYZ(i+1,c.x,c.y,c.z);p.setXYZ(i+2,b.x,b.y,b.z)}
    }
    geo.computeVertexNormals();geometries[bucket]=geo;
  }
  return geometries;
}
