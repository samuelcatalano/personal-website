# Mini Cooper S Hardtop 2011

Current runtime asset: `assets/vehicles/mini-cooper-2011.glb`. The F56 file is retained as legacy history; `vehicle-assets.js` now selects the 2011 model for both hero and ambient Minis.

Owner-supplied source by Nieve5677, CC-BY-4.0. Attribution and source URL: `ASSET_SOURCES.md`.

Run `prepare_mini_2011.py` in Blender Python (CLI `blender -b -P ...` or console `exec(compile(open(path).read(), path, 'exec'), {})`). The script normalizes the supplied model to 3.73 m, preserves source triangles, welds duplicate vertices, separates whole connected wheel parts into FL/FR/RL/RR pivots, and paints the body and bonnet pearl white with red roof/mirrors and twin red bonnet stripes matching the previous Mini (x 1.0–1.72 m, lateral bands ±0.09–0.27 m). Existing runtime materials preserve ambient palettes, lighting, wheel rolling and hero front steering.

Export: about 992k triangles, 20.5 MB, no external textures. This preserves substantially more geometry than the legacy F56; no performance benchmark is claimed.

Desktop verification: `tests/vehicles.browser.py` passed (4,500 traffic frames, zero safety corrections); close-up checked with all wheels rotated and front wheels steered. Mobile was deliberately not tested per owner instructions.
