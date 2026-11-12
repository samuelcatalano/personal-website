import * as THREE from 'three';
import { shelterField } from './weather-math.js';

export const coverShader = `
uniform sampler2D uWeatherCover;
uniform vec4 uWeatherCoverBounds;
uniform float uWeatherCoverOn;
float weatherRoof(vec2 world) {
  if (uWeatherCoverOn < .5) return 0.0;
  vec2 uv = (world - uWeatherCoverBounds.xy) / uWeatherCoverBounds.zw;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture2D(uWeatherCover, uv).r * 127.5;
}`;

export const coverUniforms = cover => cover?.uniforms ?? {
  uWeatherCover: { value: null }, uWeatherCoverBounds: { value: new THREE.Vector4(0, 0, 1, 1) }, uWeatherCoverOn: { value: 0 },
};

export function createWeatherCover(footprints) {
  const field = shelterField(footprints);
  const texture = new THREE.DataTexture(field.data, field.width, field.height, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false; texture.needsUpdate = true;
  let disposed = false;
  return {
    field,
    uniforms: { uWeatherCover: { value: texture }, uWeatherCoverBounds: { value: new THREE.Vector4(...field.bounds) }, uWeatherCoverOn: { value: 1 } },
    dispose() { if (!disposed) { disposed = true; texture.dispose(); } },
  };
}
