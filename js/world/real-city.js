import { createCityBuildings } from './building-kit.js';

export async function buildRealCity(plots, options) {
  const city = createCityBuildings(plots, options);
  city.name = 'real-city-pilot';
  return city;
}
