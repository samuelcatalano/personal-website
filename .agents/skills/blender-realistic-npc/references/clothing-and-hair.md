# Clothing and hair

Keep garment silhouettes faithful to the reference: neckline, shoulder seam, sleeve length, waist, hems, footwear and visible layers. Model volume where it changes silhouette or contact; bake weave, pores and small folds into maps. Do not sculpt permanent walking folds before testing deformation.

Separate body, garments and hair in the editable source. Remove hidden body faces only in a derived runtime copy, after confirming poses and wardrobe boundaries; preserve the source body. Give collars, hems and shoes credible thickness without gratuitous inner surfaces. Skin garments deliberately and inspect shoulder, elbow, hip and knee extremes for intersections.

Choose mesh clumps or hair cards for the target distance. Render both sides deliberately: careless double-sided cards increase cost and transparent cards can sort against eyes, glass and sky. Prefer alpha-tested cards when their silhouette permits; test edges and shadows in day/night and motion. Do not convert all transparent materials globally to fix one character.

Use a compact material/atlas set. Share maps across instances, avoid baked directional light in base colour, and keep roughness/normal/occlusion in the correct colour spaces. Preserve source resolution; export only measured runtime resolution. Check scalp/hairline, eyebrows, eyelids, teeth and finger gaps at the closest intended camera.

Gate: neutral and target-light captures plus posed collision checks. Small details that disappear at scene distance must earn their resource cost.
