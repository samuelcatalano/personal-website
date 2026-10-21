import { buildVehicle, buildCar } from './vehicles.js';
// Thin adapters kept for older callers and tests: the buses and the Mini are built by buildVehicle (vehicles.js).
export { buildMini } from './vehicles.js';
export const buildBus = (region = 'london') => buildVehicle(region === 'glasgow' ? 'glasgow' : 'london', { hero: true });
export const car = ({ c, taxi }) => buildCar(taxi ? 'cab' : 'sedan', c);
