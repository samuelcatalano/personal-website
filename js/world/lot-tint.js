import { stops } from '../content.js';
import { inRegion, regions as routeRegions, routePoints, ukStart } from './layout.js';
import { SURFACE as S } from './building-slice-materials.js';
// Per-lot colour: regional wall, brick, roof and glass families chosen from the lot id. Shared by the rollout buildings and the hero shop frontages.
export const hash=id=>{let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n;};
export const route=routePoints(stops.length),bands=routeRegions(stops,route),ukX=route[ukStart(stops)].x;
export const REGION_SALT={paulista:0,london:1,countryside:2,glasgow:3};
export function regionForPlot(p){
  if(p.region&&REGION_SALT[p.region]!==undefined)return p.region;
  if(p.id.startsWith('paulista-')||p.x<ukX)return 'paulista';
  if(p.id.startsWith('glasgow-')||inRegion(bands,'scot',p.x))return 'glasgow';
  if(p.id.startsWith('country-')||inRegion(bands,'ctry',p.x))return 'countryside';
  return 'london';
}

// Vertex tints vary the shared metric atlas; materials and maps are never cloned.
const walls=[[1.12,1.14,1.16],[.55,.80,1.12],[.65,.92,.60],[1.18,.82,.45],[1.10,.65,.70],[.58,.64,.72],[1.10,1.04,.80],[.83,.75,.64],[1.15,.95,.62],[.72,.95,.88],[1.05,.55,.45],[.92,.88,1.08],[1.16,1.08,.92],[.62,.72,.58],[1.12,.90,.88],[.86,.94,1.08],[.88,1.02,.93],[1.14,1.08,.80],[.80,.82,.85],[1.15,.80,.66]]; // 14-19: painted pink, powder blue, mint, butter yellow, grey stone, terracotta
// Glass tint families (multipliers on the shared teal pane): 0 cool blue, 1 green-teal, 2 bronze, 3 silver, 4 smoked.
const glassTints=[[.82,1.03,1.25],[.79,1.10,.94],[1.35,1.08,.82],[1.24,1.16,1.07],[.58,.64,.7]];
const glassPick={london:[0,3,4,0,3,2],paulista:[1,2,3,1,0,4],countryside:[0,3,4,1,2,0],glasgow:[3,4,0,3,2,1],none:[0,1,3,2,4,0]};
// Roof targets in sRGB; vertex colour = target / atlas roof albedo, in linear space. Pitched = terrace/shop, flat = everything else.
const roofBase=[68,80,94],lin=(t,b)=>Math.pow(t/b,2.2);
const roofFor=t=>t.map((c,i)=>lin(c,roofBase[i]));
const roofs={
  pitched:{london:[[88,94,104],[168,92,66],[120,118,116],[110,82,66]],countryside:[[120,118,116],[110,112,116],[145,112,82],[88,94,104]],glasgow:[[88,94,104],[110,112,116],[88,94,104],[120,100,90]],paulista:[[168,92,66],[184,110,80],[130,128,124],[168,92,66]],none:[[88,94,104],[168,92,66],[120,118,116],[110,82,66]]},
  flat:[[176,178,176],[168,156,132],[128,136,142],[176,178,176],[168,156,132],[96,120,72],[128,136,142],[88,94,104]]
};
const bricks=[[1.05,.70,.50],[.58,.64,.74],[1.12,1.06,.86],[.72,.85,.74],[1.20,.66,.55],[.68,.54,.47],[.92,.48,.40],[1.0,.92,.70]];
export function tint(g,p,{walls:wallStrength=1}={}) { // walls: 0 = leave wall colours alone, 1 = full regional colour, between = a lighter touch
  const wallK=wallStrength===true?1:wallStrength===false?0:wallStrength,wallsOn=wallK>0;
  const region=regionForPlot(p),seed=hash(p.id)+REGION_SALT[region],wall=walls[seed%walls.length],roof=[[1,1,1],[.72,.82,.93],[1.08,.76,.62],[.58,.58,.64],[1.2,.62,.45]][Math.floor(seed/5)%5];
  const pickWall=list=>walls[list[seed%list.length]],regionalWall=region==='glasgow'?pickWall([6,8,12,17]):region==='paulista'?pickWall([0,6,12,3,9,10,19,14]):region==='london'?pickWall([6,7,12,14,15,16,17,18]):region==='countryside'?pickWall([1,5,9,16]):wall;
  const regionalBrick=region==='glasgow'?bricks[[2,5,7][Math.floor(seed/3)%3]]:region==='london'?bricks[[0,5,7][Math.floor(seed/3)%3]]:region==='countryside'?bricks[[2,3,7][Math.floor(seed/3)%3]]:bricks[Math.floor(seed/3)%bricks.length];
  const pitched=p.kind==='terrace'||p.kind==='shop',gt=glassTints[glassPick[region||'none'][Math.floor(seed/7)%6]];
  const roofTop=roofFor(pitched?roofs.pitched[region||'none'][Math.floor(seed/13)%4]:roofs.flat[Math.floor(seed/13)%8]);
  const wallValue = 0.86 + (Math.floor(seed / 223) % 15) * 0.02;
  for(const m of g.children){const a=m.geometry.attributes;
    for(let i=0;i<a.position.count;i++){
      const s=a.aSurface.getX(i),t0=!wallsOn&&(s===S.plaster||s===S.stone||s===S.brick)?[1,1,1]:s===S.plaster?regionalWall:s===S.stone?(region?regionalWall:p.kind==='office'?walls[(seed%3)*2]:[1,1,1]):s===S.brick?regionalBrick:s===S.roof?(pitched||a.normal.getY(i)>.7?roofTop:region==='glasgow'?walls[5]:roof):s===S.glass||s===S.litGlass?gt:[1,1,1];
      const isWall = s === S.plaster || s === S.stone || s === S.brick, t = isWall && wallK > 0 && wallK < 1 ? t0.map(v => 1 + (v - 1) * wallK) : t0;
      const value = wallsOn && isWall ? 1 + (wallValue - 1) * wallK : 1;
      a.color.setXYZ(i,a.color.getX(i)*t[0]*value,a.color.getY(i)*t[1]*value,a.color.getZ(i)*t[2]*value);
    }
  }
}
