import * as THREE from 'three';
// Hero vehicle particles: exhaust steam in the cold (London, Glasgow, nights) and wheel spray on a wet road.
// One Points draw with a small CPU-simulated pool; particles live in world space so they trail behind the vehicle.
const N = 300;
export function createVehicleFx(scene, { reducedMotion = false } = {}) {
  if (reducedMotion) return { update() {}, dispose() {} };
  const pos = new Float32Array(N * 3), alpha = new Float32Array(N), size = new Float32Array(N), kind = new Float32Array(N);
  const vel = Array.from({ length: N }, () => new THREE.Vector3()), age = new Float32Array(N).fill(9), life = new Float32Array(N).fill(1), grow = new Float32Array(N), base = new Float32Array(N);
  pos.fill(-10000);
  const geometry = new THREE.BufferGeometry()
    .setAttribute('position', new THREE.BufferAttribute(pos, 3))
    .setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    .setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    .setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  const uniforms = { uHalfH: { value: 450 }, uNight: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false,
    vertexShader: `attribute float aAlpha, aSize, aKind; uniform float uHalfH; varying float vA, vK;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aAlpha; vK = aKind;
        gl_PointSize = aSize * projectionMatrix[1][1] * uHalfH / max(-mv.z, 0.5); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uNight; varying float vA, vK;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); a *= a * vA; if (a < 0.01) discard;
        vec3 c = mix(vec3(0.84, 0.86, 0.9), vec3(0.78, 0.88, 0.97), vK) * mix(1.0, 0.38, uNight); gl_FragColor = vec4(c, a); }`,
  });
  const points = new THREE.Points(geometry, material); points.frustumCulled = false; points.renderOrder = 6; scene.add(points);
  let cursor = 0, steamDebt = 0, sprayDebt = 0;
  const spawn = (x, y, z, vx, vy, vz, s, g, l, k, a) => {
    const i = cursor; cursor = (cursor + 1) % N;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i].set(vx, vy, vz); age[i] = 0; life[i] = l; base[i] = s; grow[i] = g; kind[i] = k; alpha[i] = a;
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  return {
    // p: world position of the vehicle, h: yaw, len/half: its size, speed in m/s, rain/cold 0..1, night 0..1, halfH: drawing-buffer height / 2
    update(dt, { p, h, len, halfW, speed, rain, cold, night, halfH }) {
      if (!dt) return;
      uniforms.uHalfH.value = halfH; uniforms.uNight.value = night;
      const fx = Math.cos(h), fz = -Math.sin(h), sx = Math.sin(h), sz = Math.cos(h); // forward and right on the ground plane
      steamDebt += dt * cold * (3.2 + Math.min(speed, 10) * 0.25);
      while (steamDebt >= 1) { steamDebt -= 1; // exhaust: a thin pipe low at the rear corner, rises and widens while it fades
        spawn(p.x - fx * (len / 2 + 0.05) + sx * halfW * 0.45, 0.34, p.z - fz * (len / 2 + 0.05) + sz * halfW * 0.45, -fx * rnd(0.4, 1.2) + rnd(-0.15, 0.15), rnd(0.35, 0.7), -fz * rnd(0.4, 1.2) + rnd(-0.15, 0.15), 0.28, 1.5, rnd(1.6, 2.6), 0, 0.5);
      }
      sprayDebt += dt * rain * Math.min(speed / 6, 1) * 150;
      while (sprayDebt >= 1) { sprayDebt -= 1; // spray: thrown up and back from the rear wheels, short and light
        const side = Math.random() < 0.5 ? -1 : 1;
        spawn(p.x - fx * len * 0.3 + sx * side * halfW, 0.12, p.z - fz * len * 0.3 + sz * side * halfW, -fx * rnd(1, 2.6) + sx * side * rnd(0.2, 1), rnd(0.9, 2.2), -fz * rnd(1, 2.6) + sz * side * rnd(0.2, 1), 0.24, 2.2, rnd(0.5, 0.9), 1, 0.7);
      }
      for (let i = 0; i < N; i++) {
        if (age[i] >= life[i]) { alpha[i] = 0; continue; }
        age[i] += dt; const k = age[i] / life[i];
        pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt;
        if (kind[i] > 0.5) vel[i].y -= 6 * dt; else vel[i].multiplyScalar(1 - 0.5 * dt); // spray falls back, steam slows
        size[i] = base[i] * (1 + grow[i] * k); alpha[i] = (kind[i] > 0.5 ? 0.42 : 0.5) * (1 - k) * Math.min(1, k * 8);
        if (age[i] >= life[i]) alpha[i] = 0;
      }
      geometry.attributes.position.needsUpdate = geometry.attributes.aAlpha.needsUpdate = geometry.attributes.aSize.needsUpdate = geometry.attributes.aKind.needsUpdate = true;
    },
    dispose() { scene.remove(points); geometry.dispose(); material.dispose(); },
  };
}
