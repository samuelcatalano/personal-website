import { createCityBuildings } from './building-kit.js';

export async function buildRealCity(plots, options) {
  // A lot listed twice would be built twice on top of itself: reject it up front (same id, or the same object).
  const seen = new Set();
  for (const p of plots) {
    const key = p.id ?? p;
    if (seen.has(key)) throw new TypeError('duplicate benchmark lots must be rejected');
    seen.add(key);
  }
  const city = createCityBuildings(plots, options);
  city.name = 'real-city-pilot';
  return city;
}
