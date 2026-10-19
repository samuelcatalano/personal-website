import * as THREE from 'three';
import { createBuilding } from './building-kit.js';

export async function buildRealCity(plots) {
  const city = new THREE.Group();
  city.name = 'real-city-pilot';
  return city.add(...plots.slice(0, 5).map(createBuilding));
}
