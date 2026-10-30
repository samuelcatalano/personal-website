"""Build the project-authored tower facade/crown module library and export its raw GLB.

Run with: blender -b --factory-startup -P tools/buildings/tower-kit/build_tower_kit.py
Facade modules stay within 0.19 m of the glazed wall plane (the lot reserves a 0.2 m margin) and avoid the 0.10 m
plane of the procedural ribs. Crown modules sit on the crown cap and are <= 2.7 m tall (the kit crown reserves
2.78 m under the plot height). Boxes/cylinders only: no textures, no third-party meshes.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../kit-common"))
from kitlib import Kit, ROOT

kit = Kit("TowerKit", "Tower",
          {"mass": ((0.45, 0.52, 0.60, 1), 0.80), "trim": ((0.88, 0.91, 0.94, 1), 0.65), "glass": ((0.22, 0.45, 0.58, 1), 0.22)},
          os.path.join(ROOT, "assets/processed/buildings/tower-kit.glb"),
          {"fin": 4, "spandrel": 3, "rail": 2, "lobby": 3, "crown": 4, "louvre": 2})
A = {
    "fin": "bottom centre of a vertical fin on the glazed plane (3 m tall, stretch Y over a tier)",
    "spandrel": "bottom centre of a floor-edge band on the glazed plane (4 m wide x 0.4 m, stretch X)",
    "rail": "bottom centre of a terrace rail tile on the ledge (2 m wide x 1 m tall)",
    "lobby": "bottom centre of the lobby entrance bay on the glazed plane (3 m wide x 4.5 m tall)",
    "crown": "centre of the crown cap footprint (6 x 6 m nominal, uniform scale to fit)",
    "louvre": "bottom centre of a mechanical-floor louvre panel on the glazed plane (4 x 3 m, stretch X/Y)",
}

m = kit.module("fin_square_01", "fin", A["fin"])
m.box("trim", "fin", (0, 1.5, .095), (.14, 3, .15))
for s in (-1, 1):
    m.box("trim", "edge_bead", (s * .052, 1.5, .145), (.045, 3, .075))
m.box("trim", "base_collar", (0, .055, .095), (.20, .11, .19)); m.box("trim", "top_collar", (0, 2.945, .095), (.20, .11, .19))
m = kit.module("fin_blade_02", "fin", A["fin"])
m.box("trim", "blade", (0, 1.5, .105), (.05, 3, .17))
for s in (-1, 1):
    m.box("trim", "blade_bead", (s * .04, 1.5, .16), (.03, 3, .06))
m.box("trim", "base_collar", (0, .055, .08), (.10, .11, .18)); m.box("trim", "top_collar", (0, 2.945, .08), (.10, .11, .18))
m = kit.module("fin_twin_03", "fin", A["fin"])
for s in (-1, 1):
    m.box("trim", "post", (s * .06, 1.5, .09), (.05, 3, .14))
m = kit.module("fin_flanged_04", "fin", A["fin"]); m.box("trim", "web", (0, 1.5, .08), (.12, 3, .12)); m.box("trim", "flange", (0, 1.5, .175), (.22, 3, .03))

m = kit.module("spandrel_ledge_01", "spandrel", A["spandrel"]); m.box("mass", "ledge", (0, .2, .07), (4, .4, .10))
m = kit.module("spandrel_frit_02", "spandrel", A["spandrel"])
m.box("glass", "pane", (0, .2, .05), (3.96, .3, .012)); m.box("trim", "top", (0, .38, .09), (4, .04, .12)); m.box("trim", "bottom", (0, .02, .09), (4, .04, .12))
m = kit.module("spandrel_twin_03", "spandrel", A["spandrel"]); m.box("trim", "a", (0, .05, .075), (4, .04, .13)); m.box("trim", "b", (0, .35, .075), (4, .04, .13))

m = kit.module("rail_post_01", "rail", A["rail"]); m.box("trim", "top", (0, .98, 0), (2, .04, .05)); m.box("trim", "mid", (0, .5, 0), (2, .025, .025))
for x in (-.97, 0, .97):
    m.cyl("trim", "post", (x, .5, 0), .02, 1.0, 6, "Y")
m = kit.module("rail_glass_02", "rail", A["rail"]); m.box("glass", "pane", (0, .5, 0), (1.96, .8, .02)); m.box("trim", "top", (0, .93, 0), (2, .04, .05)); m.box("trim", "base", (0, .05, 0), (2, .1, .06))

def portal(m, fins, canopy_w):
    for s in (-1, 1):
        m.box("trim", "post", (s * 1.5, 2.15, .10), (.14, 4.3, .16))
    m.box("trim", "head", (0, 3.9, .10), (3.1, .18, .16)); m.box("glass", "pane", (0, 1.9, .03), (2.7, 3.7, .012))
    for x in fins:
        m.box("trim", "mullion", (x, 1.8, .06), (.05, 3.6, .05))
    m.box("mass", "canopy", (0, 4.35, .095), (canopy_w, .14, .19)); m.box("trim", "fascia", (0, 4.46, .15), (canopy_w, .06, .08))
portal(kit.module("lobby_portal_01", "lobby", A["lobby"]), (-.45, 0, .45), 3.6)
m = kit.module("lobby_rods_02", "lobby", A["lobby"])
m.box("glass", "pane", (0, 1.9, .03), (2.9, 3.7, .012)); m.box("mass", "canopy", (0, 4.35, .095), (3.8, .12, .19)); m.box("trim", "fascia", (0, 4.46, .15), (3.8, .06, .08))
for s in (-1, 1):
    m.box("trim", "rod", (s * 1.7, 2.2, .06), (.03, 4.3, .03)); m.box("trim", "jamb", (s * 1.45, 1.9, .06), (.08, 3.7, .08))
m = kit.module("lobby_finned_03", "lobby", A["lobby"])
m.box("glass", "pane", (0, 1.9, .03), (2.9, 3.7, .012))
for i in range(5):
    m.box("trim", "fin", (-1.4 + i * .7, 2.15, .10), (.08, 4.3, .17))
m.box("mass", "canopy", (0, 4.35, .095), (3.2, .12, .19))

m = kit.module("crown_flat_fins_01", "crown", A["crown"])
m.box("mass", "cap", (0, .15, 0), (5.2, .3, 5.2)); m.box("trim", "frame_a", (0, 2.4, 2.55), (5.4, .12, .12)); m.box("trim", "frame_b", (0, 2.4, -2.55), (5.4, .12, .12))
for s in (-1, 1):
    m.box("trim", "frame_c", (s * 2.65, 2.4, 0), (.12, .12, 5.0))
for i in range(6):
    x = -2.5 + i
    for z in (-2.55, 2.55):
        m.box("trim", "fin", (x, 1.35, z), (.14, 2.1, .14))
m = kit.module("crown_stepped_02", "crown", A["crown"])
m.box("mass", "t1", (0, .3, 0), (4.8, .6, 4.8)); m.box("mass", "t2", (0, .95, 0), (3.4, .7, 3.4)); m.box("mass", "t3", (0, 1.7, 0), (2.0, .8, 2.0)); m.box("trim", "cap", (0, 2.14, 0), (2.2, .08, 2.2))
for s in (-1, 1):
    m.box("trim", "t1_coping", (s * 2.42, .62, 0), (.12, .06, 4.8)); m.box("trim", "t1_coping", (0, .62, s * 2.42), (4.8, .06, .12))
m = kit.module("crown_mast_03", "crown", A["crown"])
m.box("mass", "base", (0, .3, 0), (2.8, .6, 2.8)); m.box("trim", "trim", (0, .64, 0), (3.0, .08, 3.0)); m.cyl("trim", "mast", (0, 1.65, 0), .08, 2.1, 8, "Y")
for y in (1.9, 2.3):
    m.box("trim", "arm", (0, y, 0), (1.0, .04, .04))
m = kit.module("crown_helipad_04", "crown", A["crown"])
m.box("mass", "deck", (0, .1, 0), (5.0, .2, 5.0)); m.cyl("trim", "ring", (0, .28, 0), 2.4, .16, 24, "Y"); m.cyl("mass", "disc", (0, .29, 0), 2.1, .16, 24, "Y")
for s in (-1, 1):
    m.box("trim", "h_leg", (s * .5, .385, 0), (.18, .02, 1.3))
m.box("trim", "h_bar", (0, .385, 0), (1.0, .02, .18))

m = kit.module("louvre_slats_01", "louvre", A["louvre"])
m.box("mass", "plate", (0, 1.5, .035), (4, 3, .03))
for i in range(10):
    m.box("trim", "slat", (0, .15 + i * .3, .11), (3.9, .07, .12))
m = kit.module("louvre_vertical_02", "louvre", A["louvre"])
m.box("mass", "plate", (0, 1.5, .035), (4, 3, .03))
for i in range(16):
    m.box("trim", "blade", (-1.875 + i * .25, 1.5, .11), (.06, 2.9, .12))

kit.export()
