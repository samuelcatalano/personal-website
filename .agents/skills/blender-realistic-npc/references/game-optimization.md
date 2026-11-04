# Game optimization

Measure the separate character first: exported bytes, primitives/draw calls, unique geometry triangles, vertices, bones, animated channels, materials, map dimensions and estimated decoded texture/buffer payload. File size is not GPU memory. Sum indices per primitive for unique asset triangles; scene submitted triangles include instances and rendering passes.

Choose ceilings from the target scene and number of simultaneously visible characters. A single high-detail portrait can be acceptable as one hero and unacceptable in a 200-person pool. Keep body/face silhouette at the closest camera, merge material regions where it saves real draws, and bake microdetail. Do not decimate across deform joints blindly or delete validation to satisfy a budget.

Build lower LODs only within the authorized slice. Simplify hidden faces, eyes, hair and tiny garments in that order when evidence supports it. Preserve skeleton compatibility and loop/contact behavior. Validate bounds across animation, not just rest pose. Avoid rendering both LODs or allocating resources on every distance transition. Share geometry, maps and appropriate materials across instances; each animated clone needs its own bone ownership and mixer state.

Use `validate_gltf.py --max-triangles N --max-materials N --max-textures N --max-bones N --max-bytes N` for structural budgets. It is not a complete Khronos conformance validator or a decoder for compressed extensions. Read its limitations and inspect compressed assets in the real loader.

Gate: fixed camera/theme/tier/resolution/DPR A/B, initialization separately from steady state, median/p95 and actual GPU backend. SwiftShader/emulated-mobile/rAF evidence is labelled accordingly; none proves physical GPU, VRAM or phone performance. Preserve unfavourable results.
