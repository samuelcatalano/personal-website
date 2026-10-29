import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
// Shared loader for pipeline GLBs (tools/pipeline): Meshopt geometry + KTX2/Basis textures. KTX2 needs the renderer to pick a GPU format,
// so scene.js calls initGlbLoader(renderer) once; GLBs without KTX2 textures load fine either way.
let renderer, ktx2;
export const initGlbLoader = (r) => { renderer = r; };
// The Basis transcoder ships with the pinned three build; resolve it through the importmap so the version never drifts.
const transcoderPath = () => new URL('./', import.meta.resolve('three/addons/libs/basis/basis_transcoder.js')).href;
export function loadGlb(url) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  if (renderer) loader.setKTX2Loader(ktx2 ??= new KTX2Loader().setTranscoderPath(transcoderPath()).detectSupport(renderer));
  return loader.loadAsync(url).then((g) => g.scene);
}
