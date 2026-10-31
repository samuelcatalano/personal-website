import * as THREE from 'three';
import { PALETTE as P } from './palette.js';

const color = hex => new THREE.Color(hex).toArray();
const triangle = (positions, colors, a, b, c, hex) => {
  positions.push(...a, ...b, ...c);
  const rgb = color(hex);
  colors.push(...rgb, ...rgb, ...rgb);
};
const quad = (positions, colors, a, b, c, d, hex) => {
  triangle(positions, colors, a, b, c, hex);
  triangle(positions, colors, a, c, d, hex);
};
const box = (positions, colors, x, y, z, w, h, d, hex) => {
  const x0 = x - w / 2, x1 = x + w / 2, y1 = y + h, z0 = z - d / 2, z1 = z + d / 2;
  quad(positions, colors, [x0,y,z0], [x1,y,z0], [x1,y,z1], [x0,y,z1], hex);
  quad(positions, colors, [x0,y1,z0], [x0,y1,z1], [x1,y1,z1], [x1,y1,z0], hex);
  quad(positions, colors, [x0,y,z0], [x0,y1,z0], [x1,y1,z0], [x1,y,z0], hex);
  quad(positions, colors, [x0,y,z1], [x1,y,z1], [x1,y1,z1], [x0,y1,z1], hex);
  quad(positions, colors, [x0,y,z0], [x0,y,z1], [x0,y1,z1], [x0,y1,z0], hex);
  quad(positions, colors, [x1,y,z0], [x1,y1,z0], [x1,y1,z1], [x1,y,z1], hex);
};
const octahedron = (positions, colors, x, y, z, rx, ry, rz, hex) => {
  const top = [x,y+ry,z], bottom = [x,y-ry,z], left = [x-rx,y,z], right = [x+rx,y,z], front = [x,y,z+rz], back = [x,y,z-rz];
  for (const [a,b] of [[left,front],[front,right],[right,back],[back,left]]) triangle(positions, colors, top, a, b, hex);
  for (const [a,b] of [[front,left],[right,front],[back,right],[left,back]]) triangle(positions, colors, bottom, a, b, hex);
};

export function createPlantGeometry(kind) {
  const positions = [], colors = [];
  if (kind === 'flower') {
    const heads = [[-0.3,-0.1,P.red],[0,0.12,P.tulip],[0.3,-0.08,P.violet]];
    for (const [x,z,petal] of heads) {
      box(positions, colors, x, 0, z, 0.045, 0.68, 0.045, P.leaf);
      octahedron(positions, colors, x, 0.76, z, 0.14, 0.12, 0.14, petal);
      octahedron(positions, colors, x, 0.76, z, 0.045, 0.045, 0.045, P.sand);
      octahedron(positions, colors, x + 0.08, 0.38, z, 0.11, 0.035, 0.045, P.leaf);
    }
  } else if (kind === 'shrub') {
    for (const [x,y,z,rx,ry,rz,hex] of [
      [-0.23,0.31,-0.04,0.22,0.31,0.29,P.hedge], [0,0.56,0,0.31,0.42,0.35,P.leaf],
      [0.24,0.44,0.05,0.22,0.31,0.29,P.grass], [-0.05,0.47,0.27,0.23,0.3,0.22,P.leaf], [0.1,0.45,-0.27,0.23,0.3,0.22,P.hedge],
    ]) octahedron(positions, colors, x,y,z,rx,ry,rz,hex);
  } else if (kind === 'hedge') {
    for (const x of [-0.32,-0.16,0,0.16,0.32]) octahedron(positions, colors, x,0.37,0,0.14,0.37,0.42, x ? P.hedge : P.leaf);
  } else throw new Error(`Unknown plant kind: ${kind}`);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
