import { makeAtlasPixels } from './building-atlas.js';
const pixels=[makeAtlasPixels(true),makeAtlasPixels(false)];
postMessage(pixels,pixels.flat().map(array=>array.buffer));
