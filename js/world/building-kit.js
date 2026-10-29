import * as THREE from 'three';
import { classifyPlot, createCityRollout } from './city-rollout.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { surfaceNoiseTexture } from './textures.js';
import { isWembleyBenchmark } from './layout.js';
import { PALETTE as P } from './palette.js';
import { SHOP_LOT_IDS, SHOP_INTEGRATION_IDS, HERO_CLEANUP_IDS, HERO_REGION_IDS, createShopChunk, createShopIntegration } from './shop-slice.js';
import { HERO_LOT_IDS, createHeroIntegration } from './hero-integration.js';
import { TOWER_LOT_ID, createTowerSlice } from './tower-slice.js';
import { OFFICE_LOT_ID, createOfficeSlice } from './office-slice.js';
import { MIDRISE_LOT_ID, MIDRISE_REPLICATION_IDS, createMidriseSlice, createMidriseReplication } from './midrise-slice.js';
import { TOWNHOUSE_LOT_IDS, createTownhouseChunk, EXPERIMENT_LOT_IDS, createTownhouseExperiment } from './building-slice.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const wallTexture = surfaceNoiseTexture();
const material = (name, color, roughness = 0.88, map) => new THREE.MeshStandardMaterial({ name, color, roughness, ...(map ? { map } : {}) });
const facade = {
  terrace: [material('terrace-brick', P.brick, 0.9, wallTexture), material('terrace-stucco', P.sandstone, 0.9, wallTexture)],
  shop: [material('shop-stucco', P.cream, 0.9, wallTexture), material('shop-ochre', P.ochre, 0.9, wallTexture)],
  midrise: [material('midrise-stone', P.concreteMid, 0.9, wallTexture), material('midrise-sandstone', P.londonStock, 0.9, wallTexture)],
  office: [material('office-concrete', P.steel, 0.5, wallTexture), material('office-teal', P.teal, 0.4, wallTexture)],
  tower: [material('tower-glass', P.steel, 0.38, wallTexture), material('tower-blue', P.navy, 0.34, wallTexture)],
};
const roofs = {
  terrace: material('terrace-roof', P.roof), shop: material('shop-roof', P.redBrown),
  midrise: material('midrise-roof', P.stone), office: material('office-roof', P.ink),
  tower: material('tower-crown', P.navy, 0.42),
};
const glass = material('window-glass', P.glass, 0.26);
const recess = material('window-recess', P.ink, 0.6);
const frames = material('window-frame', P.offWhite);
const trim = material('architectural-trim', P.londonStock);
const benchmarkFacade = new THREE.MeshStandardMaterial({ name: 'benchmark-facade-family', color: 0xffffff, roughness: 0.82, metalness: 0.04, vertexColors: true });
const benchmarkDetails = new THREE.MeshStandardMaterial({ name: 'benchmark-architectural-details', color: 0xffffff, roughness: 0.72 });
const benchmarkProfiles = {
  terrace: { outline: [[-0.5, 0], [0.5, 0], [0.5, 0.81], [0, 1], [-0.5, 0.81]], columns: [-0.24, 0.24], rows: [0.34, 0.63] },
  shop: { outline: [[-0.5, 0], [0.5, 0], [0.5, 0.88], [0.34, 0.88], [0.34, 1], [-0.34, 1], [-0.34, 0.88], [-0.5, 0.88]], columns: [-0.3, 0, 0.3], rows: [0.57, 0.77] },
  midrise: { outline: [[-0.5, 0], [0.5, 0], [0.5, 0.76], [0.43, 0.76], [0.43, 1], [-0.43, 1], [-0.43, 0.76], [-0.5, 0.76]], columns: [-0.34, -0.11, 0.11, 0.34], rows: [0.16, 0.32, 0.48, 0.64] },
  office: { outline: [[-0.5, 0], [0.5, 0], [0.5, 0.72], [0.42, 0.72], [0.42, 0.9], [0.36, 1], [-0.36, 1], [-0.42, 0.9], [-0.42, 0.72], [-0.5, 0.72]], columns: [-0.31, -0.1, 0.1, 0.31], rows: [0.13, 0.25, 0.37, 0.49, 0.61] },
  tower: { outline: [[-0.5, 0], [0.5, 0], [0.5, 0.56], [0.43, 0.56], [0.43, 0.76], [0.35, 0.76], [0.35, 0.91], [0.26, 1], [-0.26, 1], [-0.35, 0.91], [-0.35, 0.76], [-0.43, 0.76], [-0.43, 0.56], [-0.5, 0.56]], columns: [-0.29, 0, 0.29], rows: [0.09, 0.19, 0.29, 0.39, 0.49] },
};
const profileGeometry = Object.fromEntries(Object.entries(benchmarkProfiles).map(([kind, profile]) => {
  const shape = new THREE.Shape();
  profile.outline.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const openings = [];
  for (const y of profile.rows) for (const x of profile.columns) openings.push({ x, y, w: 0.1, h: 0.11 });
  if (kind === 'shop') openings.push({ x: -0.16, y: 0.17, w: 0.38, h: 0.24, shopfront: true });
  openings.push({ x: kind === 'shop' ? 0.37 : 0.33, y: 0.15, w: 0.1, h: 0.25, door: true });
  for (const o of openings) {
    const hole = new THREE.Path();
    hole.moveTo(o.x - o.w / 2, o.y - o.h / 2); hole.lineTo(o.x - o.w / 2, o.y + o.h / 2);
    hole.lineTo(o.x + o.w / 2, o.y + o.h / 2); hole.lineTo(o.x + o.w / 2, o.y - o.h / 2); hole.closePath();
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1, steps: 1 });
  geometry.translate(0, 0, -0.5);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
  return [kind, geometry];
}));
const benchmarkTint = { terrace: '#a65c43', shop: '#d6c39d', midrise: '#b8b5aa', office: '#68899a', tower: '#527b8b' };

function addBox(group, mat, x, y, z, width, height, depth) {
  const mesh = new THREE.Mesh(box, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addInstances(group, mat, details, castShadow = true) {
  if (!details.length) return;
  const mesh = new THREE.InstancedMesh(box, mat, details.length);
  const transform = new THREE.Object3D();
  details.forEach(([x, y, z, w, h, d, color], i) => {
    transform.position.set(x, y, z);
    transform.scale.set(w, h, d);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
    if (color) mesh.setColorAt(i, new THREE.Color(color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function coloredGeometry(source, matrix, tint) {
  let geometry = source.clone().applyMatrix4(matrix);
  if (geometry.index) { const flat = geometry.toNonIndexed(); geometry.dispose(); geometry = flat; }
  const color = new THREE.Color(tint), attribute = new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3), 3);
  for (let i = 0; i < attribute.count; i++) attribute.setXYZ(i, color.r, color.g, color.b);
  geometry.setAttribute('color', attribute);
  return geometry;
}

export function createBuilding(plot, benchmark = false) {
  const { kind, width: w, depth: d, height: h } = plot;
  if (!facade[kind] || ![plot.x, plot.z, w, d, h].every(Number.isFinite) || w <= 0 || d <= 0 || h <= 0) {
    throw new TypeError('Invalid building plot');
  }
  let style = Number.isInteger(plot.style) ? Math.abs(plot.style) : 0;
  if (plot.id && !Number.isInteger(plot.style)) for (const char of plot.id) style = (style * 31 + char.charCodeAt(0)) >>> 0;
  const building = new THREE.Group();
  building.name = plot.id || kind;
  building.position.set(plot.x, 0, plot.z);
  building.userData.kind = kind;

  benchmark = benchmark && isWembleyBenchmark(plot);
  const roofH = benchmark && kind === 'terrace' ? 0 : kind === 'terrace' ? Math.min(1.2, d * 0.16, h * 0.2) : Math.min(0.45, h * 0.1);
  const bodyHeight = h - roofH;
  if (benchmark) {
    const shell = new THREE.Mesh(profileGeometry[kind], benchmarkFacade);
    shell.position.y = 0; shell.scale.set(w, bodyHeight, d); shell.userData.benchmarkTint = benchmarkTint[kind];
    shell.castShadow = shell.receiveShadow = true; building.add(shell);
  } else addBox(building, facade[kind][style % facade[kind].length], 0, bodyHeight / 2, 0, w, bodyHeight, d);
  const roofY = bodyHeight;
  if (!benchmark && (kind !== 'terrace' || h <= 3)) addBox(building, roofs[kind], 0, roofY + roofH / 2, 0, w * 0.96, roofH, d * 0.96);

  // Top features vary by archetype while staying inside the reserved footprint.
  if (benchmark && kind === 'terrace') {
    // The gabled shell supplies the roof silhouette inside the original lot.
  } else if (kind === 'terrace') {
    if (h > 3) {
      const pitch = Math.min(0.28, roofH / d * 0.75);
      for (const side of [-1, 1]) {
        const roof = addBox(building, roofs.terrace, 0, bodyHeight + roofH * 0.35, side * d * 0.22, w * 0.98, 0.14, d * 0.52);
        roof.rotation.x = side * pitch;
      }
      addBox(building, roofs.terrace, 0, bodyHeight + roofH - 0.04, 0, w * 0.98, 0.08, 0.14);
    }
  } else if (kind === 'shop') {
    const awningH = h * 0.04;
    addBox(building, trim, 0, Math.min(h - awningH / 2, bodyHeight * 0.62), d / 2 - d * 0.06, w * 0.92, awningH, d * 0.12);
  } else if (kind === 'midrise') {
    addBox(building, trim, 0, bodyHeight * 0.52, 0, w, Math.min(0.12, h * 0.04), d);
  } else if (kind === 'office') {
    addBox(building, roofs.office, 0, h * 0.92, 0, w * 0.58, h * 0.04, d * 0.58);
  } else {
    addBox(building, roofs.tower, 0, h * 0.96, 0, w * 0.3, h * 0.03, d * 0.3);
  }

  if (benchmark) {
    const profile = benchmarkProfiles[kind], glass = [], frame = [], doors = [];
    for (const y of profile.rows) for (const x of profile.columns) {
      const ww = w * 0.1, wh = bodyHeight * 0.11, z = d / 2 - Math.min(0.09, d * 0.035), rail = Math.min(0.045, ww * 0.06);
      glass.push([w * x, bodyHeight * y, z, ww * 0.94, wh * 0.94, 0.035]);
      frame.push([w * (x - 0.05 + 0.003), bodyHeight * y, d / 2 - 0.015, rail, wh, 0.045], [w * (x + 0.05 - 0.003), bodyHeight * y, d / 2 - 0.015, rail, wh, 0.045]);
      frame.push([w * x, bodyHeight * (y - 0.055 + 0.003), d / 2 - 0.015, ww, rail, 0.045], [w * x, bodyHeight * (y + 0.055 - 0.003), d / 2 - 0.015, ww, rail, 0.045]);
    }
    if (kind === 'shop') glass.push([-w * 0.16, bodyHeight * 0.17, d / 2 - 0.04, w * 0.37, bodyHeight * 0.235, 0.04]);
    const dx = kind === 'shop' ? 0.37 : 0.33;
    doors.push([w * dx, bodyHeight * 0.15, d / 2 - 0.025, w * 0.095, bodyHeight * 0.24, 0.035]);
    addInstances(building, benchmarkDetails, [
      ...glass.map(item => [...item, '#78aebf']),
      ...frame.map(item => [...item, '#e5d8bd']),
      ...doors.map(item => [...item, '#493d34']),
    ], false);
    return building;
  }

  const floors = Math.max(1, Math.floor(bodyHeight / (kind === 'terrace' || kind === 'shop' ? 2.6 : 3.1)));
  const columns = Math.max(2, Math.floor(w / (kind === 'terrace' ? 2.1 : 2.4)));
  const sideColumns = Math.max(1, Math.floor(d / 2.4));
  const windows = [], recesses = [], borders = [];
  const winW = Math.min(0.85, w / columns * 0.46), winH = Math.min(1.35, bodyHeight / floors * 0.48);
  const frameW = Math.min(winW + 0.1, w / columns * 0.9), frameH = Math.min(winH + 0.1, bodyHeight / floors * 0.9);
  const frontDepth = Math.min(0.035, d * 0.04), paneDepth = Math.min(0.025, d * 0.025), sideWidth = Math.min(0.03, w * 0.05);
  const frameZ = d / 2 - frontDepth / 2, paneZ = d / 2 - Math.min(0.08, d * 0.06), rail = Math.min(0.07, w / columns * 0.08);
  for (let floor = 0; floor < floors; floor++) for (let column = 0; column < columns; column++) {
    const x = -w / 2 + (column + 0.5) * w / columns;
    const y = (floor + 0.55) * bodyHeight / floors;
    if (kind !== 'shop' || floor > 0) {
      windows.push([x, y, paneZ, winW, winH, paneDepth]);
      recesses.push([x, y, paneZ - paneDepth * 0.7, frameW, frameH, paneDepth]);
      const top = y + frameH / 2 - rail / 2, bottom = y - frameH / 2 + rail / 2;
      borders.push([x - frameW / 2 + rail / 2, y, frameZ, rail, frameH, frontDepth], [x + frameW / 2 - rail / 2, y, frameZ, rail, frameH, frontDepth]);
      borders.push([x, top, frameZ, frameW, rail, frontDepth], [x, bottom, frameZ, frameW, rail, frontDepth]);
      borders.push([x, y, frameZ, Math.min(0.035, frameW * 0.035), winH, frontDepth]);
    }
    if (kind !== 'shop') for (let sideColumn = 0; sideColumn < sideColumns; sideColumn++) {
      const z = -d / 2 + (sideColumn + 0.5) * d / sideColumns;
      windows.push([w / 2 - sideWidth / 2, y, z, sideWidth, winH, Math.min(0.85, d / sideColumns * 0.46)]);
    }
  }
  addInstances(building, recess, recesses);
  addInstances(building, glass, windows);
  addInstances(building, frames, borders);
  if (kind === 'shop') {
    const storeHeight = Math.min(bodyHeight * 0.3, 2.4);
    const storeDepth = Math.min(0.01, d * 0.01), storeZ = d / 2 - storeDepth / 2;
    addInstances(building, glass, [[0, storeHeight / 2, storeZ, w * 0.55, storeHeight, storeDepth]]);
    addInstances(building, trim, [[0, storeHeight, d / 2 - Math.min(0.04, d * 0.02) / 2, w * 0.65, 0.08, Math.min(0.04, d * 0.02)]]);
  } else if (kind === 'terrace' && bodyHeight > 1) {
    const balconyY = Math.min(bodyHeight * 0.52, h - 0.12);
    const balconyDepth = Math.min(0.12, d * 0.025);
    addInstances(building, trim, [[0, balconyY, d / 2 - balconyDepth / 2, w * 0.5, 0.08, balconyDepth], [0, balconyY - 0.22, d / 2 - balconyDepth / 2, w * 0.5, 0.04, balconyDepth], [-w * 0.22, balconyY - 0.11, d / 2 - balconyDepth / 2, 0.04, 0.22, balconyDepth], [w * 0.22, balconyY - 0.11, d / 2 - balconyDepth / 2, 0.04, 0.22, balconyDepth]]);
  }
  return building;
}

export function createCityBuildings(plots,{rollout=true}={}) {
  const city = new THREE.Group(), batches = new Map(), benchmarkBodies = [], townhouses = [], experimentPlots = [], kinds = new Set(), benchmarkKinds = new Set();
  let buildingCount = 0, benchmarkCount = 0, sliceCount = 0;
  const midrisePlots=[],heroPlots=[],shopPlots=[],shopIntegrationPlots=[],cleanupPlots=[],regionPlots=[],rolloutPlots=[];
  for (const plot of plots) {
    const benchmark = isWembleyBenchmark(plot);
    buildingCount++;
    kinds.add(plot.kind);
    if (benchmark) { benchmarkCount++; benchmarkKinds.add(plot.kind); }
    if (plot.id?.startsWith('lot-front-105--81.5-')) continue;
    if (TOWNHOUSE_LOT_IDS.includes(plot.id)) {
      townhouses.push(plot);
      sliceCount++;
      continue;
    }
    if (EXPERIMENT_LOT_IDS.includes(plot.id)) { experimentPlots.push(plot); continue; }
    if (HERO_REGION_IDS.includes(plot.id)) { regionPlots.push(plot); continue; }
    if (HERO_CLEANUP_IDS.includes(plot.id)) { cleanupPlots.push(plot); continue; }
    if (SHOP_INTEGRATION_IDS.includes(plot.id)) { shopIntegrationPlots.push(plot); continue; }
    if (SHOP_LOT_IDS.includes(plot.id)) { shopPlots.push(plot); continue; }
    if (HERO_LOT_IDS.includes(plot.id)) { heroPlots.push(plot); continue; }
    if (plot.id === TOWER_LOT_ID) { city.add(createTowerSlice(plot)); continue; }
    if (plot.id === OFFICE_LOT_ID) { city.add(createOfficeSlice(plot)); continue; }
    if (plot.id === MIDRISE_LOT_ID) { city.add(createMidriseSlice(plot)); continue; }
    if (MIDRISE_REPLICATION_IDS.includes(plot.id)) { midrisePlots.push(plot); continue; }
    if (rollout && classifyPlot(plot)) { rolloutPlots.push(plot); continue; }
    const building = createBuilding(plot, benchmark);
    building.updateMatrix();
    for (const child of building.children) {
      child.updateMatrix();
      const matrix = new THREE.Matrix4().makeTranslation(plot.x, 0, plot.z).multiply(child.matrix);
      const mat = child.material;
      if (mat === benchmarkFacade) {
        benchmarkBodies.push(coloredGeometry(child.geometry, matrix, child.userData.benchmarkTint || building.userData.benchmarkTint));
        continue;
      }
      if (mat === benchmarkDetails && child.isInstancedMesh) {
        const instance = new THREE.Matrix4(), color = new THREE.Color();
        for (let i = 0; i < child.count; i++) {
          child.getMatrixAt(i, instance); child.getColorAt(i, color);
          benchmarkBodies.push(coloredGeometry(child.geometry, matrix.clone().multiply(instance), color));
        }
        continue;
      }
      let materials = batches.get(child.geometry);
      if (!materials) batches.set(child.geometry, materials = new Map());
      let batch = materials.get(mat);
      if (!batch) materials.set(mat, batch = []);
      const tint = child.userData.benchmarkTint || building.userData.benchmarkTint;
      const color = tint ? new THREE.Color(tint) : null;
      if (child.isInstancedMesh) {
        const instance = new THREE.Matrix4();
        const instanceColor = new THREE.Color();
        for (let i = 0; i < child.count; i++) {
          child.getMatrixAt(i, instance);
          const tintColor = child.instanceColor ? (child.getColorAt(i, instanceColor), instanceColor.clone()) : color;
          batch.push({ matrix: matrix.clone().multiply(instance), color: tintColor, castsShadow: child.castShadow });
        }
      } else batch.push({ matrix, color, castsShadow: child.castShadow });
    }
  }
  if (rolloutPlots.length) {
    const group=createCityRollout(rolloutPlots,plots);city.add(group);
  }
  if (regionPlots.length) { const chunk=createShopChunk(regionPlots,plots);chunk.name='hero-adjacent-region';city.add(chunk); }
  if (cleanupPlots.length) { const chunk=createShopChunk(cleanupPlots,plots);chunk.name='hero-background-cleanup';city.add(chunk); }
  if (shopIntegrationPlots.length) city.add(createShopIntegration(shopIntegrationPlots,plots));
  if (shopPlots.length) city.add(createShopChunk(shopPlots,plots));
  if (heroPlots.length) city.add(createHeroIntegration(heroPlots,plots));
  if (midrisePlots.length) city.add(createMidriseReplication(midrisePlots));
  if (townhouses.length) city.add(createTownhouseChunk(townhouses));
  if (experimentPlots.length) {
    const experiment = createTownhouseExperiment(experimentPlots, plots);city.add(experiment);
    city.userData.update = camera => experiment.userData.update(camera);
    city.userData.dispose = () => experiment.userData.dispose();
  }
  if (benchmarkBodies.length) {
    const geometry = mergeGeometries(benchmarkBodies, false);
    benchmarkBodies.forEach(item => item.dispose());
    if (!geometry) throw new Error('Unable to merge benchmark facade geometries');
    const mesh = new THREE.Mesh(geometry, benchmarkFacade);
    mesh.name = 'wembley-benchmark-facades';
    mesh.userData.buildingCount = benchmarkCount - sliceCount;
    mesh.castShadow = mesh.receiveShadow = true;
    city.add(mesh);
  }
  for (const [geometry, materials] of batches) for (const [mat, transforms] of materials) {
    const mesh = new THREE.InstancedMesh(geometry, mat, transforms.length);
    transforms.forEach(({ matrix, color }, i) => { mesh.setMatrixAt(i, matrix); if (color) mesh.setColorAt(i, color); });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.castShadow = transforms.some(item => item.castsShadow);
    mesh.receiveShadow = true;
    city.add(mesh);
  }
  const slices = city.children.filter(o=>['midrise-slice','office-slice','tower-slice','hero-zone-architecture','shop-slice','shop-integration','citywide-architecture'].includes(o.userData.archetype));
  if (slices.length) {
    const dispose = city.userData.dispose;let disposed = false;
    city.userData.dispose = () => { if (disposed) return;disposed = true;dispose?.();for (const group of slices) { if(group.userData.dispose)group.userData.dispose();else for (const mesh of group.children) mesh.geometry.dispose(); } };
  }
  const rolloutGroup=city.getObjectByName('citywide-architecture');
  if (rolloutGroup) { const update=city.userData.update;city.userData.update=camera=>{update?.(camera);rolloutGroup.userData.update(camera);}; }
  city.userData.buildingCount = buildingCount;
  city.userData.sliceCount = sliceCount;
  city.userData.benchmarkCount = benchmarkCount;
  city.userData.benchmarkKinds = [...benchmarkKinds];
  city.userData.kinds = [...kinds];
  return city;
}
