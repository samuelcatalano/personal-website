# Wembley landmark asset

Original Blender geometry for the low elliptical glazed bowl, rising red seating, two broad roof leaves that leave the pitch open, and one ground-anchored leaning lattice arch with roof stays. The arch is one structural truss, not two independent curves. Cool silver steel, dark blue glazing and a restrained cyan arch / cool interior glow carry the day-night palette.

References: the owner's supplied Wembley photos and [SQUIR3D's Sketchfab viewer](https://sketchfab.com/3d-models/wembley-stadium-london-9cd00249b7484f7c9b15373c461f36cc) plus [LibanCiel's aerial Sketchfab viewer](https://sketchfab.com/3d-models/wembley-stadium-london-england-57e16a6a2d544bf386cb998d03c2b9a6), viewed in-browser only. Neither third-party model was downloaded or used as an asset. Arch proportions follow the official [133 m height / 315 m span](https://help.wembleystadium.com/support/solutions/articles/7000028145-stats-and-facts) figures.

Run blender --background --factory-startup --python tools/landmarks/wembley/build_wembley.py from the repository root to regenerate the .blend and both GLBs. GLBs use the existing pre-scaled local frame and retain the placement envelope. Three PBR buckets (Mass, Trim, Glass), vertex colours only, no external textures or baked lighting.

Current LOD0/LOD1 budgets: 7,964 / 3,876 triangles (2026-11-23 W-05: glazed upper facade, rim lattice ring, stepped podium, arch mark on the side screens; plus a 12-triangle central LED band above the main entrance), three draws each. The central band is a blank cyan screen (same colour as the side screens): no sponsor name, text or logo. Desktop day/night captures: /tmp/wembley-one-arch-correction-2026-11-05/.
