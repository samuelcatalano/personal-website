import * as THREE from 'three';
import { createOfficeSlice } from './office-slice.js';
import { createTowerSlice } from './tower-slice.js';

const envelopes = [
  ['paulista-hero-0', 'office', -263, -67, 10.06, 10.06, 36],
  ['paulista-hero-1', 'tower', -246, -67, 9.86, 9.86, 50],
];

export function createHeroBackground(plots) {
  if (plots.length !== envelopes.length) throw new TypeError('Expected the two existing hero towers');
  const group = new THREE.Group();
  group.name = 'hero-background';
  for (const [i, spec] of envelopes.entries()) {
    const plot = plots.find(p => p.id === spec[0]);
    if (!plot || [plot.id, plot.kind, plot.x, plot.z, plot.width, plot.depth, plot.height].some((v, k) =>
      typeof v === 'number' ? !Number.isFinite(v) || Math.abs(v - spec[k]) > 1e-6 : v !== spec[k])) {
      throw new TypeError('Incompatible hero background envelope');
    }
    // The two source positions lie in adjacent 32m cells; retain independent culling bounds.
    if (i === 1) continue; // owner request: no tower beside the Sé's left side (plot id stays reserved so the rollout skips it)
    group.add(createOfficeSlice(plot));
  }
  let disposed = false;
  group.userData = { plotIds: envelopes.map(p => p[0]), dispose() {
    if (disposed) return;
    disposed = true;
    group.traverse(mesh => { if (mesh.isMesh) mesh.geometry.dispose(); });
  } };
  return group;
}
