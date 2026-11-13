import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function load(file, globals) {
  const source = readFileSync(new URL(`../js/world/${file}.js`, import.meta.url), 'utf8')
    .replace(/^import .*;.*$/gm, '').replace(/^export /gm, '');
  const context = vm.createContext(globals);
  vm.runInContext(source, context);
  return context;
}

test('landmark environment releases temporary scenes and both targets once', () => {
  const resources = [];
  class Resource { constructor() { this.disposals = 0; resources.push(this); } dispose() { this.disposals++; } }
  class Color { clone() { return this; } lerp() { return this; } multiplyScalar() { return this; } }
  class Scene { constructor() { this.children = []; } add(mesh) { this.mesh = mesh; this.children.push(mesh); } }
  class PMREMGenerator extends Resource { fromScene(scene) { assert.ok(scene.mesh); const target = new Resource(); target.texture = {}; return target; } }
  class Mesh { constructor(geometry, material) { Object.assign(this, { geometry, material }); } }
  const sky = { zen: new Color(), hor: new Color() };
  const c = load('landmark-env', { THREE: { Color, Scene, PMREMGenerator, Mesh, SphereGeometry: Resource, ShaderMaterial: Resource }, DAY: sky, NIGHT: sky, SUN_DIR: {} });
  const env = c.createLandmarkEnv({});
  assert.deepEqual(resources.map(r => r.disposals), [1, 1, 1, 0, 1, 1, 0]);
  env.dispose(); env.dispose();
  assert.deepEqual(resources.map(r => r.disposals), [1, 1, 1, 1, 1, 1, 1]);
});

test('postprocessing releases each pass and composer once', () => {
  const passes = [];
  class Pass { constructor() { this.disposals = 0; passes.push(this); } dispose() { this.disposals++; } }
  class ShaderPass extends Pass { constructor(shader) { super(); this.uniforms = shader.uniforms; } }
  class Composer { constructor(_renderer, target) { this.targets = [target, new Target()]; this.passes = []; this.disposals = 0; Composer.instance = this; } addPass(pass) { this.passes.push(pass); } dispose() { this.disposals++; this.targets.forEach(target => target.dispose()); } }
  class Target { dispose() { this.disposals = (this.disposals ?? 0) + 1; } }
  class Vector2 { constructor(x = 1, y = 1) { Object.assign(this, { x, y }); } }
  class Vector3 {}
  const c = load('post', { THREE: { Vector2, Vector3, WebGLRenderTarget: Target, DepthTexture: class {}, HalfFloatType: 1, ShaderMaterial: class {}, Color: class {} }, EffectComposer: Composer, Pass, FullScreenQuad: class { dispose() {} render() {} }, RenderPass: Pass, AOPass: Pass, ShaderPass, UnrealBloomPass: Pass, OutputPass: Pass, URLSearchParams });
  const post = c.createPost({ getSize: () => new Vector2(), getPixelRatio: () => 1 }, {}, {});
  post.dispose(); post.dispose();
  assert.equal(Composer.instance.disposals, 1);
  assert.ok(Composer.instance.targets.every(target => target.disposals === 1));
  assert.ok(passes.every(pass => pass.disposals === 1));
});
