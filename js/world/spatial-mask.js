const overlaps = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;

// Index low walkable slabs once. Query the actual rotated footprint, not its bounding rectangle.
export function createPavementHeight(slabs) {
  const cells = new Map(), size = 8;
  for (const { x, z, w, d, y, h, ry = 0 } of slabs) {
    const top = y + h;
    if (!(top > 0 && top <= .35 && w >= .45 && d >= .45)) continue;
    const c = Math.cos(ry), s = Math.sin(ry), hw = w / 2, hd = d / 2;
    const dx = Math.abs(c) * hw + Math.abs(s) * hd, dz = Math.abs(s) * hw + Math.abs(c) * hd;
    const slab = { x, z, top, c, s, hw, hd };
    for (let i = Math.floor((x - dx) / size); i <= Math.floor((x + dx) / size); i++)
      for (let j = Math.floor((z - dz) / size); j <= Math.floor((z + dz) / size); j++) {
        const key = `${i}:${j}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(slab);
      }
  }
  return (x, z, ground) => {
    const nearby = cells.get(`${Math.floor(x / size)}:${Math.floor(z / size)}`);
    if (nearby) for (const slab of nearby) {
      if (slab.top <= ground) continue;
      const dx = x - slab.x, dz = z - slab.z;
      if (Math.abs(dx * slab.c - dz * slab.s) <= slab.hw && Math.abs(dx * slab.s + dz * slab.c) <= slab.hd) ground = slab.top;
    }
    return ground;
  };
}

export function createRectMask(rectangles, cellSize = 16) {
  const cells = new Map();
  const keys = r => {
    const out = [];
    for (let x = Math.floor(r.x0 / cellSize); x <= Math.floor(r.x1 / cellSize); x++)
      for (let z = Math.floor(r.z0 / cellSize); z <= Math.floor(r.z1 / cellSize); z++) out.push(`${x},${z}`);
    return out;
  };
  for (const r of rectangles) if (r.x1 - r.x0 > 1e-6 && r.z1 - r.z0 > 1e-6) for (const key of keys(r)) {
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(r);
  }
  return { intersects(r) {
    if (r.x1 - r.x0 <= 1e-6 || r.z1 - r.z0 <= 1e-6) return false;
    for (const key of keys(r)) for (const q of cells.get(key) ?? []) if (overlaps(r, q)) return true;
    return false;
  }, query(r) {
    const matches = new Set();
    for (const key of keys(r)) for (const q of cells.get(key) ?? []) if (overlaps(r,q)) matches.add(q);
    return [...matches];
  }, contains(r) {
    for (const key of keys(r)) for (const q of cells.get(key) ?? []) if (r.x0 >= q.x0 && r.x1 <= q.x1 && r.z0 >= q.z0 && r.z1 <= q.z1) return true;
    return false;
  } };
}

// Paving may overlay a lawn: compare their top heights instead of blocking the whole park rectangle.
export function createPedestrianSpace({ solids = [], boxes = [], circles = [], walkable = [], lawns = [], fallback = [] } = {}) {
  const footprint = ({ x, z, w, d, ry = 0 }) => {
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hx = (c * w + s * d) / 2, hz = (s * w + c * d) / 2;
    return { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz };
  };
  const footprints = boxes.map(footprint);
  footprints.push(...circles.map(({ x, z, r }) => ({ x0: x - r, x1: x + r, z0: z - r, z1: z + r })), ...solids);
  const floor = walkable.filter(b=>b.y+b.h>0&&b.y+b.h<=.35&&b.w>=.45&&b.d>=.45);
  const paved = floor.map(b=>({...footprint(b),top:b.y+b.h,box:b}));
  const lawnRects = lawns.filter(b=>b.y+b.h>0&&b.y+b.h<=.35&&b.w>=.45&&b.d>=.45).map(b=>({...footprint(b),top:b.y+b.h}));
  const blocked = createRectMask(footprints,4), paving = createRectMask(paved,4), lawnMask = createRectMask(lawnRects,4);
  const support = createRectMask([...fallback,...paved.filter(p=>!p.box.ry)],4);
  const corners = r => [[r.x0,r.z0],[r.x1,r.z0],[r.x1,r.z1],[r.x0,r.z1]];
  const clip = (polygon,a,b,sign) => {
    const out=[],distance=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=distance(p),dq=distance(q),ip=dp>=-1e-10,iq=dq>=-1e-10;
      if(ip)out.push(p);
      if(ip!==iq){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
    }
    return out;
  };
  const area = p => Math.abs(p.reduce((a,v,i)=>a+(v[0]-p[0][0])*(p[(i+1)%p.length][1]-p[0][1])-(p[(i+1)%p.length][0]-p[0][0])*(v[1]-p[0][1]),0))/2;
  const coveredRotated = (r,slabs) => {
    let fragments=[corners(r)];
    for(const slab of slabs){
      const b=slab.box;
      const polygon=b?.ry?[[-b.w/2,-b.d/2],[b.w/2,-b.d/2],[b.w/2,b.d/2],[-b.w/2,b.d/2]].map(([x,z])=>[b.x+x*Math.cos(b.ry)+z*Math.sin(b.ry),b.z-x*Math.sin(b.ry)+z*Math.cos(b.ry)]):corners(slab);
      const next=[];
      for(const f of fragments){
        let remainder=f;
        for(let i=0;i<4&&remainder.length>=3;i++){
          const a=polygon[i],b=polygon[(i+1)%4],outside=clip(remainder,a,b,-1);
          if(outside.length>=3&&area(outside)>1e-9)next.push(outside);
          remainder=clip(remainder,a,b,1);
        }
      }
      fragments=next;if(!fragments.length)return true;
    }
    return false;
  };
  const covered = (r,slabs) => {
    if(slabs.some(p=>p.box?.ry))return coveredRotated(r,slabs);
    let fragments=[r];
    for(const p of slabs){
      const next=[];
      for(const f of fragments){
        if(!overlaps(f,p)){next.push(f);continue;}
        const x0=Math.max(f.x0,p.x0),x1=Math.min(f.x1,p.x1),z0=Math.max(f.z0,p.z0),z1=Math.min(f.z1,p.z1);
        if(f.x0<x0)next.push({...f,x1:x0});if(f.x1>x1)next.push({...f,x0:x1});
        if(f.z0<z0)next.push({x0,x1,z0:f.z0,z1:z0});if(f.z1>z1)next.push({x0,x1,z0:z1,z1:f.z1});
      }
      fragments=next;if(!fragments.length)return true;
    }
    return false;
  };
  const reason = (x,z,radius) => {
    const body={x0:x-radius,x1:x+radius,z0:z-radius,z1:z+radius};
    if(blocked.intersects(body))return 'solid';
    const grass=lawnMask.query(body);
    if(!grass.length&&support.contains(body))return null;
    const slabs=paving.query(body);
    for(const lawn of grass){
      const overlap={x0:Math.max(body.x0,lawn.x0),x1:Math.min(body.x1,lawn.x1),z0:Math.max(body.z0,lawn.z0),z1:Math.min(body.z1,lawn.z1)};
      if(!covered(overlap,slabs.filter(p=>p.top+.001>=lawn.top)))return 'lawn';
    }
    if(walkable.length&&!covered(body,[...support.query(body),...slabs.filter(p=>p.box.ry)]))return 'edge';
    return null;
  };
  return {reason,allows:(x,z,radius)=>reason(x,z,radius)===null};
}
