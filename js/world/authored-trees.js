import * as THREE from 'three';
import { streetEnvironment, STREET_WIND } from './streetscape-state.js';
import { loadGlb } from './glb-loader.js';
import { impostorGeometry } from './tree-mesh.js';
import { addTreeUnderstory } from './tree-understory.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const VERSION = '5';
const FOLIAGE_CUTOFF = 0.42; // same cutoff as the exported leaf MASK (tools/vegetation/build_trees.py ALPHA_CUTOFF)
const SOURCES = [
  ['realistic-tree', 'realistic-tree.glb', ['realistic-tree']],
];
const rnd = (x, z, k) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
const LEAF_PALETTE = [0xe4d4f1, 0xffedb5].map((hex) => {
  const color = new THREE.Color(hex);
  return color.multiplyScalar(1 / Math.max(color.r, color.g, color.b)); // Keep the original neutral instance shade on bark.
});
const PALETTE_FRAGMENT = {
  leaves: [
    '#ifdef USE_COLOR',
    '  float treeShade = max(vColor.r, max(vColor.g, vColor.b));',
    '  vec3 treePalette = vColor / max(treeShade, 0.0001);',
    '  float treeChroma = max(vColor.r, max(vColor.g, vColor.b)) - min(vColor.r, min(vColor.g, vColor.b));',
    '  float treeTint = smoothstep(0.02, 0.18, treeChroma) * 0.62;',
    '  diffuseColor.rgb = mix(diffuseColor.rgb, treePalette, treeTint) * treeShade;',
    '#else',
    '  #include <color_fragment>',
    '#endif',
  ].join('\n'),
  trunk: [
    '#ifdef USE_COLOR',
    '  diffuseColor.rgb *= max(vColor.r, max(vColor.g, vColor.b));',
    '#else',
    '  #include <color_fragment>',
    '#endif',
  ].join('\n'),
  impostor: [
    '#ifdef USE_COLOR',
    '  float treeShade = max(vColor.r, max(vColor.g, vColor.b));',
    '  vec3 treePalette = vColor / max(treeShade, 0.0001);',
    '  float treeChroma = max(vColor.r, max(vColor.g, vColor.b)) - min(vColor.r, min(vColor.g, vColor.b));',
    '  float treeFoliage = 0.0;',
    '  #ifdef USE_MAP',
    '    float treeGreen = sampledDiffuseColor.g - max(sampledDiffuseColor.r, sampledDiffuseColor.b);',
    '    treeFoliage = smoothstep(0.003, 0.015, treeGreen);',
    '  #endif',
    '  float treeTint = smoothstep(0.02, 0.18, treeChroma) * 0.62 * treeFoliage;',
    '  diffuseColor.rgb = mix(diffuseColor.rgb, treePalette, treeTint) * treeShade;',
    '#else',
    '  #include <color_fragment>',
    '#endif',
  ].join('\n'),
};
function setPaletteShader(material, kind) {
  material.onBeforeCompile = (shader) => {
    // shortcut: sub-5 cm foliage sway keeps static shadow geometry; add matching depth deformation for closer cameras.
    if (kind !== 'trunk') {
      shader.uniforms.uStreetTime = streetEnvironment.time;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uStreetTime;\n' + STREET_WIND)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
        vec3 direction = vec3(0.92, 0.0, 0.38);
        vec3 localDirection = vec3(dot(instanceMatrix[0].xyz, direction) / dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz),
          dot(instanceMatrix[1].xyz, direction) / dot(instanceMatrix[1].xyz, instanceMatrix[1].xyz),
          dot(instanceMatrix[2].xyz, direction) / dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz));
        float tip = pow(clamp(position.y, 0.0, 1.0), 2.0);
        transformed += localDirection * (0.035 * tip * streetGust(uStreetTime, instanceMatrix[3].xz));
#endif`);
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', PALETTE_FRAGMENT[kind]);
  };
  material.customProgramCacheKey = () => 'authored-tree-palette-' + kind + '-wind-2';
}
const urls = SOURCES.map(([, file]) => new URL(`../../assets/processed/vegetation/${file}?v=${VERSION}`, import.meta.url).href);
const atlasUrl = new URL(`../../assets/processed/vegetation/tree-impostors.png?v=${VERSION}`, import.meta.url).href;

function disposeRoots(roots) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  roots.forEach((root) => root?.traverse((o) => {
    if (!o.isMesh) return;
    geometries.add(o.geometry);
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (!m) return;
      materials.add(m);
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'specularColorMap', 'specularIntensityMap']) if (m[key]) textures.add(m[key]);
    });
  }));
  geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose());
}

function makeTreeMaterial(source) {
  const material = source.clone();
  if (/leaf|leaves|foliage|cluster|vine|prune|crown/i.test(source.name) || source.transparent || source.alphaTest > 0) {
    material.transparent = false; material.depthWrite = true; material.alphaTest = Math.max(0.4, source.alphaTest || 0); material.side = THREE.DoubleSide;
  }
  setPaletteShader(material, /leaf|leaves|foliage/i.test(source.name) ? 'leaves' : 'trunk');
  return material;
}

function mergeParts(parts, materialOrder = null) {
  if (parts.some((part) => part.materials.length !== 1)) throw new Error('Expected one material per authored tree primitive');
  const materials = materialOrder ?? parts.map((part) => part.materials[0]);
  parts.forEach(({ geometry, materials: source }) => {
    const index = materials.findIndex((material) => material.name === source[0].name);
    if (index < 0) throw new Error(`Unexpected authored tree material: ${source[0].name}`);
    geometry.clearGroups(); geometry.addGroup(0, geometry.index?.count ?? geometry.attributes.position.count, index);
  });
  const geometry = mergeGeometries(parts.map((part) => part.geometry), true);
  if (!geometry) throw new Error('Authored tree primitives have incompatible geometry attributes');
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, materials };
}

export async function createAuthoredTrees(placements) {
  const settled = await Promise.allSettled([...urls.map((url) => loadGlb(url)), new THREE.TextureLoader().loadAsync(atlasUrl)]);
  const failed = settled.find((r) => r.status === 'rejected');
  const atlas = settled.pop().value;
  const roots = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (failed) { atlas?.dispose(); disposeRoots(roots); throw failed.reason; }
  const geometries = new Set(), materials = new Set(), textures = new Set(), sourceGeometries = new Set(), sourceMaterials = new Set();
  try {
    atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
    const sourceMeshes = new Map();
    roots.forEach((root) => {
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (!o.isMesh) return;
        sourceGeometries.add(o.geometry);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (!m) return;
          sourceMaterials.add(m);
          for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'specularColorMap', 'specularIntensityMap']) if (m[key]) textures.add(m[key]);
        });
        const match = /^(realistic-tree)-LOD([01])(?:_\d+)?$/.exec(o.name);
        if (!match) return;
        const [, variant, level] = match, key = `${variant}:${level}`;
        const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld); geometry.computeBoundingBox(); geometries.add(geometry);
        if (!sourceMeshes.has(key)) sourceMeshes.set(key, []);
        sourceMeshes.get(key).push({ geometry, materials: Array.isArray(o.material) ? o.material : [o.material] });
      });
    });

    const variants = SOURCES.flatMap(([, , names]) => names).map((name, atlasIndex) => {
      const lod0Parts = sourceMeshes.get(`${name}:0`), lod1Parts = sourceMeshes.get(`${name}:1`);
      if (!lod0Parts?.length || !lod1Parts?.length) throw new Error(`Missing authored tree LOD: ${name}`);
      const lod0 = mergeParts(lod0Parts);
      lod0Parts.forEach(({ geometry }) => { geometry.dispose(); geometries.delete(geometry); });
      geometries.add(lod0.geometry);
      const lod1 = mergeParts(lod1Parts, lod0.materials).geometry;
      lod1Parts.forEach(({ geometry }) => { geometry.dispose(); geometries.delete(geometry); }); geometries.add(lod1);
      const box = lod0.geometry.boundingBox, size = box.getSize(new THREE.Vector3()), scale = 1 / Math.max(size.y, 1e-5), centerX = (box.min.x + box.max.x) / 2, centerZ = (box.min.z + box.max.z) / 2;
      [lod0.geometry, lod1].forEach((geometry) => {
        geometry.translate(-centerX, -box.min.y, -centerZ); geometry.scale(scale, scale, scale); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      });
      let radius = 0; const pos = lod0.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) radius = Math.max(radius, Math.hypot(pos.getX(i), pos.getZ(i)));
      if (!radius) throw new Error(`Invalid authored tree bounds: ${name}`);
      const treeMaterials = lod0.materials.map(makeTreeMaterial); treeMaterials.forEach((m) => materials.add(m));
      return { name, atlasIndex, radius, lod0: lod0.geometry, lod1, materials: treeMaterials };
    });
    sourceGeometries.forEach((g) => { g.dispose(); geometries.delete(g); }); sourceMaterials.forEach((m) => m.dispose());
    const group = new THREE.Group(); group.name = 'trees';
    const batches = [], object = new THREE.Object3D(), chunks = new Map(), CHUNK = 160;
    // The impostor atlas bakes leaves and bark together, so tint only green pixels.
    const impostorMat = new THREE.MeshLambertMaterial({ map: atlas, alphaTest: FOLIAGE_CUTOFF, side: THREE.DoubleSide }); setPaletteShader(impostorMat, 'impostor'); materials.add(impostorMat); textures.add(atlas);
    placements.forEach((p, i) => {
      const variantIndex = Math.min(variants.length - 1, Math.floor(rnd(p.x, p.z, 43) * variants.length)), variant = variants[variantIndex], chunk = Math.floor(p.x / CHUNK), key = `${variant.name}:${chunk}`;
      if (!chunks.has(key)) chunks.set(key, { variant, trees: [] });
      chunks.get(key).trees.push({ p, i });
    });

    chunks.forEach(({ variant, trees }) => {
      const lods = [
        new THREE.InstancedMesh(variant.lod0, variant.materials, trees.length),
        new THREE.InstancedMesh(variant.lod1, variant.materials, trees.length),
        new THREE.InstancedMesh(impostorGeometry(variant.atlasIndex, variants.length), impostorMat, trees.length),
      ], bounds = new THREE.Box3(), worldTrees = [];
      geometries.add(lods[2].geometry);
      lods.forEach((mesh, level) => {
        mesh.name = `trees-canopy-${variant.name}-lod${level}`; mesh.visible = level === 0; mesh.castShadow = mesh.receiveShadow = level < 2;
        mesh.userData.sourceIndices = trees.map((e) => e.i); group.add(mesh);
      });
      trees.forEach(({ p, i }, k) => {
        const base = p.base ?? 0.1, height = Math.min(6.2, (p.h + 0.65) * 1.2) * (0.8 + rnd(p.x, p.z, 2) * 0.25), width = Math.min(p.crown / (2 * variant.radius), height), yaw = rnd(p.x, p.z, 4) * Math.PI * 2;
        object.position.set(p.x, base + 0.02, p.z); object.rotation.set(0, yaw, 0); object.scale.set(width, height, width); object.updateMatrix();
        lods[0].setMatrixAt(k, object.matrix); lods[1].setMatrixAt(k, object.matrix);
        const billboardFit = Math.max(1, 2 * variant.radius) * 1.16, billboardX = width * billboardFit, billboardY = height * billboardFit;
        object.rotation.set(0, yaw, 0); object.scale.set(billboardX, billboardY, 1); object.updateMatrix(); lods[2].setMatrixAt(k, object.matrix);
        const shade = 0.92 + rnd(p.x, p.z, 8) * 0.16, palette = rnd(p.x, p.z, 19), tint = new THREE.Color().setRGB(shade, shade, shade);
        if (palette < 0.1) tint.copy(LEAF_PALETTE[0]).multiplyScalar(shade);
        else if (palette >= 0.9) tint.copy(LEAF_PALETTE[1]).multiplyScalar(shade);
        lods.forEach((mesh) => mesh.setColorAt(k, tint));
        const radius = Math.min(p.crown / 2, variant.radius * width), top = base + 0.02 + height;
        bounds.expandByPoint(new THREE.Vector3(p.x - radius, base, p.z - radius)); bounds.expandByPoint(new THREE.Vector3(p.x + radius, top, p.z + radius));
        worldTrees.push({ x: p.x, z: p.z, base, radius, billboardX, billboardY, yaw });
      });
      lods.forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); mesh.boundingSphere.radius += 0.06; });
      batches.push({ lods, bounds, trees: worldTrees, level: null, lastCameraX: -Infinity, lastCameraZ: -Infinity });
    });

    const shrubs = addTreeUnderstory(group, placements);
    group.userData.batches = batches;
    group.userData.update = (camera, time = 0) => {
      streetEnvironment.time.value = time;
      for (const batch of batches) {
        const d = batch.bounds.distanceToPoint(camera.position), prev = batch.level;
        batch.level = prev === null ? (d < 70 ? 0 : d < 150 ? 1 : 2) : prev === 0 ? (d > 80 ? (d > 160 ? 2 : 1) : 0) : prev === 1 ? (d < 60 ? 0 : d > 160 ? 2 : 1) : (d < 60 ? 0 : d < 140 ? 1 : 2);
        if (prev !== batch.level) batch.lods.forEach((mesh, i) => { mesh.visible = i === batch.level; });
        if (batch.level === 2 && (Math.abs(camera.position.x - batch.lastCameraX) > 0.25 || Math.abs(camera.position.z - batch.lastCameraZ) > 0.25)) {
          batch.trees.forEach((tree, i) => {
            object.position.set(tree.x, tree.base + 0.02, tree.z); object.rotation.set(0, Math.atan2(camera.position.x - tree.x, camera.position.z - tree.z), 0); object.scale.set(tree.billboardX, tree.billboardY, 1); object.updateMatrix();
            batch.lods[2].setMatrixAt(i, object.matrix);
          });
          batch.lods[2].instanceMatrix.needsUpdate = true; batch.lods[2].computeBoundingBox(); batch.lods[2].computeBoundingSphere(); batch.lods[2].boundingSphere.radius += 0.06; batch.lastCameraX = camera.position.x; batch.lastCameraZ = camera.position.z;
        }
      }
    };
    let disposed = false;
    group.userData.dispose = () => {
      if (disposed) return; disposed = true;
      geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose());
      if (shrubs) { shrubs.geometry.dispose(); shrubs.material.dispose(); }
    };
    return group;
  } catch (error) {
    atlas?.dispose(); geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); disposeRoots(roots); throw error;
  }
}
