# Riverside Museum asset

Run `blender -b --python tools/landmarks/riverside/build_riverside.py` to regenerate the `.blend` and both processed GLBs. The source reproduces the 13-point folded roof as original low-poly geometry, with warm silver zinc panels, a deep graphite fascia, a regular orthogonal mullion grid, V-bracing behind the glazing, framed end walls and a continuous plinth. The runtime scales the model uniformly by 1.125 around its existing anchor (36 × 16.875 × 18.3375 m). `LOD1` is hidden in the saved Blender scene; both levels keep the same local envelope.

Each GLB has one mesh/material per bucket named `Mass`, `Trim` and `Glass`, and exports no lights or textures. `Glass` uses blue-tinted physical transmission (0.8), IOR 1.52 and roughness 0.08; the runtime environment intensity is 1.2. The temporary studio preview goes to `/tmp/riverside-lod0-preview.png`.

Visual cues: [Glasgow Life](https://www.glasgowlife.org.uk/museums/venues/riverside-museum/about-riverside), [BAM case study](https://www.bam.co.uk/case-studies/riverside-museum-glasgow) and the user's five supplied day/night façade references. Night lighting is a subdued yellow-green interior wash with restrained cool roof-edge strips. No source meshes, photos or textures are used.
