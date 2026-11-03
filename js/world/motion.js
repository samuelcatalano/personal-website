import * as THREE from 'three';
import { cloth } from './flags.js';

const FLAG_W = 240, FLAG_H = 140, TILE_W = 256, PAD_X = 8, ATLAS_W = TILE_W * 2;
const FLAG_BLUE = '#012169', SALTIRE_BLUE = '#0065BD', FLAG_RED = '#C8102E', FLAG_WHITE = '#FFFFFF';

function diagonal(ctx, x1, y1, x2, y2, width, color, offset = 0) {
  const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(x1 + nx * offset, y1 + ny * offset);
  ctx.lineTo(x2 + nx * offset, y2 + ny * offset);
  ctx.stroke();
}

function drawFlagArt(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = FLAG_W; canvas.height = FLAG_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = kind === 'saltire' ? SALTIRE_BLUE : FLAG_BLUE;
  ctx.fillRect(0, 0, FLAG_W, FLAG_H);
  if (kind === 'saltire') {
    diagonal(ctx, 0, 0, FLAG_W, FLAG_H, FLAG_H * 0.22, FLAG_WHITE);
    diagonal(ctx, FLAG_W, 0, 0, FLAG_H, FLAG_H * 0.22, FLAG_WHITE);
  } else {
    const mx = FLAG_W / 2, my = FLAG_H / 2, offset = FLAG_H * 0.055, saltire = FLAG_H * 0.24, redSaltire = FLAG_H * 0.075;
    diagonal(ctx, 0, 0, FLAG_W, FLAG_H, saltire, FLAG_WHITE);
    diagonal(ctx, FLAG_W, 0, 0, FLAG_H, saltire, FLAG_WHITE);
    // Counterchanged red diagonals keep the upper hoist corner the right way up.
    diagonal(ctx, 0, 0, mx, my, redSaltire, FLAG_RED, offset);
    diagonal(ctx, mx, my, FLAG_W, FLAG_H, redSaltire, FLAG_RED, -offset);
    diagonal(ctx, FLAG_W, 0, mx, my, redSaltire, FLAG_RED, offset);
    diagonal(ctx, mx, my, 0, FLAG_H, redSaltire, FLAG_RED, -offset);
    const whiteCross = FLAG_H * 0.32, redCross = FLAG_H * 0.16;
    ctx.fillStyle = FLAG_WHITE;
    ctx.fillRect(0, my - whiteCross / 2, FLAG_W, whiteCross);
    ctx.fillRect(mx - whiteCross / 2, 0, whiteCross, FLAG_H);
    ctx.fillStyle = FLAG_RED;
    ctx.fillRect(0, my - redCross / 2, FLAG_W, redCross);
    ctx.fillRect(mx - redCross / 2, 0, redCross, FLAG_H);
  }
  return canvas;
}

function createFlagTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W; canvas.height = FLAG_H;
  const ctx = canvas.getContext('2d');
  for (const [i, kind] of ['jack', 'saltire'].entries()) {
    const art = drawFlagArt(kind), x = i * TILE_W;
    ctx.drawImage(art, x + PAD_X, 0);
    ctx.drawImage(art, 0, 0, 1, FLAG_H, x, 0, PAD_X, FLAG_H);
    ctx.drawImage(art, FLAG_W - 1, 0, 1, FLAG_H, x + PAD_X + FLAG_W, 0, PAD_X, FLAG_H);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFlagGeometry() {
  const positions = [], uvs = [], wind = [], widths = [], indices = [];
  const columns = 16, rows = 4, rowSize = columns + 1;
  for (const flag of cloth) {
    const first = positions.length / 3, tileX = flag.kind === 'saltire' ? TILE_W : 0;
    for (let row = 0; row <= rows; row++) {
      const v = row / rows;
      for (let column = 0; column <= columns; column++) {
        const u = column / columns;
        positions.push(flag.x + flag.w * u, flag.y + flag.h * v, flag.z);
        uvs.push((tileX + PAD_X + FLAG_W * u) / ATLAS_W, v);
        wind.push(u); widths.push(flag.w);
      }
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = first + row * rowSize + column, b = a + 1, d = a + rowSize, c = d + 1;
      indices.push(a, b, c, a, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aWind', new THREE.Float32BufferAttribute(wind, 1));
  geometry.setAttribute('aWidth', new THREE.Float32BufferAttribute(widths, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFlagMaterial(uT) {
  const material = new THREE.MeshStandardMaterial({
    map: createFlagTexture(),
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  material.customProgramCacheKey = () => 'flag-cloth-wave';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uT = uT;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uT;\nattribute float aWind;\nattribute float aWidth;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nfloat flagPhase = aWind * 5.0 - uT * 3.2;\nfloat flagSlope = 0.12 * (sin(flagPhase) + aWind * 5.0 * cos(flagPhase));\nobjectNormal.x -= flagSlope;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat flagWave = sin(aWind * 5.0 - uT * 3.2);\ntransformed.z += flagWave * aWidth * 0.12 * aWind;');
  };
  return material;
}

// Ambient motion uses one scene clock; reduced motion leaves flags still.
export function buildMotion() {
  const uT = { value: 0 }, group = new THREE.Group();
  if (cloth.length) {
    const mesh = new THREE.Mesh(createFlagGeometry(), createFlagMaterial(uT));
    mesh.castShadow = false;
    mesh.frustumCulled = false; // ponytail: shortcut: uncullable cloth for five flags; add animated bounds if flag count grows.
    group.add(mesh);
  }
  return { group, uT };
}
