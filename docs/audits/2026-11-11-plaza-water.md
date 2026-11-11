# Fountain water — 2026-11-11

Owner requested going further with realistic moving water. All earlier plaza/NPC/streetscape refinements remain in place. [Contract](../plans/2026-11-10-plaza-water.md). No commit or push.

## Delivered

- Small GPU-displaced surface waves: two directional components and six damped circular fields centred on the jet landing points. Inner/outer surface edges stay pinned to the existing basin.
- Six smoother streams, each with moving cross-section, subtle lateral sway and flowing highlights. Nozzle positions stay fixed; the stream ends follow the local wave height. Tube arc-length UVs are mapped back to the Bezier parameter so deformation scales around the actual stream centreline.
- Dielectric Fresnel-style analytic reflection, lower roughness and zero metalness. Shallow stone-floor detail is distorted by the surface normal, with subdued moving caustic cues. Fine floor/caustic detail fades at small projected sizes.
- Small pulsing foam patches at impacts and restrained warm rim-light bounce at night. No extra particles, lights, texture assets, transparency pass or scene-reflection render.
- The existing shared scene clock controls every effect. Fixed time produces identical pixels; reduced motion therefore holds a still water state without disabling WebGL.

Only production file changed in this pass: `js/world/plaza-water.js`. Buffer positions stay immutable on the CPU; displacement runs in the vertex shader. Bounds include 4 cm of conservative motion clearance. The basin, plaza furniture, paths, lights and tree positions are unchanged.

## Verification

- `node --test tests/`: **224 passed, 0 failed**.
- New `tests/plaza-water.browser.py`: verified red before implementation, then green in real Chrome. 9,173 changed material pixels at 320 px between t=2 and t=2.7; 68 changed pixels with a deliberately flat-white material prove moving geometry silhouettes rather than lighting alone. Fixed-time replay changes 0 pixels. No WebGL/console errors and CPU vertex buffers stay unchanged.
- `tests/hero-plaza.browser.py`: passed with the final 11,772-triangle plaza, all 25 physical footprints clear of both original pedestrian routes, retained tree-trunk clearance and unchanged portal opening.
- Integrated start/day+night and controlled 375 px day/night: WebGL active; no recorded console errors, JS errors or unhandled rejections.
- [Motion preview](../evidence/plaza-water/water-motion.mp4): 90 actual WebGL renders, encoded as 3 seconds at 30 fps, with controlled lighting and an offline deterministic scene clock. This is a close-view motion demonstration, not a measured site FPS claim. First/last frames differ in 20,199 pixels. The preview renders the real plaza mesh with controlled lighting.
- Video verified by ffprobe: 3.000 seconds, 720 × 480, H.264, approximately 149 KiB. [Validation values and baseline hash](../evidence/plaza-water/validation.json).

## Workload

Water: 1,968 triangles. Whole plaza: **11,772**, up from 11,028 and below the unchanged 12,000 ceiling. Still **4 meshes, 3 materials, 4 shared textures**, one water draw, zero additional dynamic lights or passes. No extra production texture download or per-frame CPU geometry rebuild.

## Images and limits

- [Integrated day](../evidence/plaza-water/integrated-day.jpg), [integrated night](../evidence/plaza-water/integrated-night.jpg); [375 px day](../evidence/plaza-water/mobile-day.jpg), [375 px night](../evidence/plaza-water/mobile-night.jpg).
- [Close day](../evidence/plaza-water/after-day.jpg), [close night](../evidence/plaza-water/after-night.jpg).
- [Day comparison](../evidence/plaza-water/day-comparison.jpg), [night comparison](../evidence/plaza-water/night-comparison.jpg): before on the left, after on the right.

Refraction/floor visibility, caustics, foam and sky/rim reflection are analytic approximations; this is not a fluid solver or a scene-geometry refraction capture. No physical-phone, Lighthouse or full-city FPS benchmark. The previous broader browser-suite issues remain outside this pass; no release-wide GO implied.
