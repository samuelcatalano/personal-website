// Analytic sky/ground reflection: no scene capture, textures, transparency or extra pass.
export const GLASS_REFLECTION = /* glsl */`
vec3 glassReflection(vec3 r, float night) {
  float sky = smoothstep(-0.18, 0.72, r.y);
  vec3 c = mix(vec3(0.075,0.12,0.14),vec3(0.36,0.55,0.68),sky);
  float cloud = smoothstep(0.84,0.99,0.5+0.5*sin(r.x*7.0+r.z*5.0)) * smoothstep(0.0,0.35,r.y);
  c = mix(c,vec3(0.66,0.72,0.73),cloud*0.28);
  return mix(c,vec3(0.012,0.025,0.055),night*0.94);
}`;
