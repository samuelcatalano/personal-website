// Pure metric-atlas pixels: shared by the scene fallback and its module worker.
export const SURFACE = Object.freeze({ plaster: 0, brick: 1, roof: 2, trim: 3, stone: 4, litGlass: 5, glass: 6, door: 7 });
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
function texel(surface, x, y, quality = false) {
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
  if (quality) {
    const pores = grain(u,v,80,160)-.5, mineral = grain(u,v,12,24)-.5;
    if (surface===SURFACE.brick || surface===SURFACE.stone) {
      const brick=surface===SURFACE.brick, rows=brick?24:8, columns=brick?4:2;
      const row=Math.floor(v*rows), bx=mod(u*columns+(row%2)*.5,1), by=mod(v*rows,1);
      const edge=Math.min(bx,1-bx,by*.65,(1-by)*.65);
      const lip=Math.min(1,Math.max(0,edge/(brick?.035:.025)));
      height=surface===SURFACE.brick ? -.0016*(1-lip)+pores*.00035 : -.0012*(1-lip)+mineral*.0007+pores*.00025;
      shade*=.98+lip*.02+mineral*.035+pores*.025;
      rough=Math.min(.98,rough+pores*.1+mineral*.05);
    } else if (surface===SURFACE.roof) {
      const row=Math.floor(v*6), ry=mod(v*6,1), rx=mod(u*4+(row%2)*.5,1);
      height=.002*(1-ry)-.0015*(ry<.025?1:0)+pores*.0003;
      shade*=.97+mineral*.04+pores*.025+Math.min(1,rx/.025)*.03;
      rough=.76+mineral*.1+pores*.05;
    } else if (surface===SURFACE.plaster) {
      height=pores*.00008+mineral*.00002;shade=1+pores*.009+mineral*.006;rough=.86+pores*.08;
    } else if (surface===SURFACE.trim) { height=pores*.00004;rough=.57+mineral*.06; }
  }
  const emission=surface===SURFACE.litGlass?.68:0;
  return {rgb:color.map(c=>Math.max(0,Math.min(255,c*shade))),height,rough,metal,emission};
}


export function makeAtlasPixels(quality = false) {
  const factor=quality?2:1,size=512*factor;
  const data = Array.from({length:4},()=>new Uint8ClampedArray(size*size*4));
  for (let surface=0;surface<8;surface++) for(let y=0;y<256*factor;y++) for(let x=0;x<128*factor;x++) {
    const px=x/factor,py=y/factor,p=texel(surface,px,py,quality), hx=texel(surface,px+1/factor,py,quality).height-texel(surface,px-1/factor,py,quality).height, hy=texel(surface,px,py+1/factor,quality).height-texel(surface,px,py-1/factor,quality).height;
    const nx=-hx*220*factor,ny=hy*220*factor,scale=1/Math.sqrt(nx*nx+ny*ny+1);
    const normal={x:nx*scale,y:ny*scale,z:scale};
    const i=(((1-Math.floor(surface/4))*256*factor+y)*size+(surface%4)*128*factor+x)*4;
    const emission=[162,123,77].map(c=>c*p.emission);
    [ [...p.rgb,255],[(normal.x*.5+.5)*255,(normal.y*.5+.5)*255,(normal.z*.5+.5)*255,255],[255,p.rough*255,p.metal*255,255],[...emission,255] ].forEach((rgba,k)=>data[k].set(rgba,i));
  }
  return data;
}
