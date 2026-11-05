# Copan

Rebuild with:

    blender -b --python tools/landmarks/copan/build_copan.py

The script writes this source scene and assets/processed/landmarks/copan.lod0.glb and copan.lod1.glb. Local origin is the lot centre at ground level. Blender source is Z-up; GLB is Y-up for Three.js. The S centreline is 34 m long with 5 m amplitude, 9.2 m body depth and 36 m height, with a 3.2 m commercial base and 32 horizontal floor bands.

Three PBR materials (Mass, Trim, Glass) in three material primitives. Warm sandstone mass (`#c0af8d`) and fins (`#d1bd91`) frame neutral warm-gray glass (`#4b4945`); 20/10 fine vertical piers soften the façade grid at LOD0/LOD1. One packed procedural emissive map marks irregular amber windows with occasional warm-white and cool panes, activated by the existing Three.js night glow. The map adds no lights or external assets; there is no baked lighting. Build checks validate normals, degenerates, triangle budgets, bounds, UVs, embedded map and Blender import round-trip.

The Three.js group mirrors the model horizontally around its existing lot centre so the solid side wall faces left in the city view. The curved front has fine, shallow vertical piers; the side wall has small window slits. Glass and core use matching curve subdivisions, preventing the core from crossing the glazing as vertical bands.

Three.js 0.169 GLTFLoader bounds for both: X ±20.1421 m, Y 0–36 m, Z ±9.63 m (40.2843 × 36 × 19.26 m). LOD0: 7,900 triangles, 442,192 bytes; LOD1: 2,956 triangles, 171,368 bytes. Both import with three meshes/material calls, zero invalid normals and zero degenerate triangles. Desktop captures were inspected in-project at day and night; the façade grid is subtle, glass stays neutral, side-wall slits face left, and the Copan placement is unchanged.

Color balance was refined against owner-supplied day/night Copan photos; the photos are visual references and are not bundled. Other references: [official Copan photo gallery](https://www.copansp.com.br/fotos.html) and [São Paulo municipal revitalization note](https://prefeitura.sp.gov.br/web/licenciamento/w/prefeitura-de-s%C3%A3o-paulo-avan%C3%A7a-em-revitaliza%C3%A7%C3%A3o-do-centro-com-investimento-hist%C3%B3rico-para-requalifica%C3%A7%C3%A3o-do-edif%C3%ADcio-copan). The gallery returned 502 during the original build; no third-party images, meshes or textures were copied.
