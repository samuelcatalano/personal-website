// Analytic sky/ground reflection: no scene capture, textures, transparency or extra pass.
export const GLASS_REFLECTION = /* glsl */`
vec3 glassReflection(vec3 r, float night) {
  // The miniature camera looks down, so most reflections point below the horizon: that half reads as deep
  // reflected blue (opposite towers and haze), not dark ground, with a bright haze band at the horizon.
  float sky = smoothstep(-0.55, 0.65, r.y);
  vec3 c = mix(vec3(0.05,0.12,0.24),vec3(0.24,0.47,0.78),sky);
  c += vec3(0.11,0.12,0.12) * exp(-abs(r.y + 0.04) * 8.0);
  float cloud = smoothstep(0.84,0.99,0.5+0.5*sin(r.x*7.0+r.z*5.0)) * smoothstep(0.0,0.35,r.y);
  c = mix(c,vec3(0.66,0.72,0.73),cloud*0.28);
  return mix(c,vec3(0.012,0.025,0.055),night*0.94);
}`;
