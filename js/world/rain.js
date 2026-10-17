import * as THREE from 'three';
// Drizzle: thin slanted streaks wrapped in a box around the bus, fall animated in the vertex shader. Absent under reduced motion.
const BOX = [70, 40, 70], FALL = 22, SLANT = 3, LEN = 1.6;
export function createRain(scene, { reducedMotion = false } = {}) {
  if (reducedMotion) return { update() {} };
  const n = innerWidth < 768 ? 250 : 600, base = new Float32Array(n * 6), end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * BOX[0], y = Math.random() * BOX[1], z = Math.random() * BOX[2];
    base.set([x, y, z, x, y, z], i * 6); end[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(base, 3)).setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uOp: { value: 0 }, uCol: { value: new THREE.Color(0xb8c6d6) } },
    vertexShader: `uniform float uT; uniform vec3 uC; attribute float aEnd;
      void main(){ vec3 s = vec3(${BOX.map((v) => v.toFixed(1)).join(',')}), v = vec3(${SLANT.toFixed(1)}, -${FALL.toFixed(1)}, 0.0);
        vec3 p = mod(position + v * uT - uC + s * 0.5, s) - s * 0.5 + uC;
        p -= normalize(v) * ${LEN.toFixed(1)} * aEnd;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: 'uniform float uOp; uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, uOp); }',
  });
  const rain = new THREE.LineSegments(g, m);
  rain.frustumCulled = false; rain.renderOrder = 998; rain.visible = false;
  scene.add(rain);
  return {
    update(time, center, amount) {
      rain.visible = amount > 0.01;
      if (!rain.visible) return;
      m.uniforms.uT.value = time; m.uniforms.uC.value.set(center.x, center.y + 8, center.z); m.uniforms.uOp.value = 0.55 * amount;
    },
  };
}
