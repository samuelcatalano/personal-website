import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
// The module owns the cached geometry/materials; worlds own only their cloned roots.
let source;
export function loadWellingtonAsset() {
  return source ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL('../../assets/landmarks/wellington.glb?v=sculpt2-lossless1', import.meta.url).href)
    .then(g => g.scene).catch(() => null);
}
export async function upgradeWellington(group, isDisposed, pending = loadWellingtonAsset()) {
  const visual = await pending;
  if (!visual || isDisposed()) return;
  const clone = visual.clone(true);
  clone.name = 'wellington-glb';
  clone.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  group.userData.dispose();
  group.clear().add(clone);
  // Cached resources survive teardown and may be used by another live world.
  group.userData.dispose = () => group.clear();
}
