"""Build the project-authored office facade module library and export its raw GLB.

Run with: blender -b --factory-startup -P tools/buildings/office-kit/build_office_kit.py
Facade modules stay within 0.19 m of the wall plane (the lot reserves a 0.2 m margin); roof modules sit on the roof
slab and stay <= 1.05 m tall (the office recipe has ~1.1 m of headroom under the plot height). Boxes/cylinders only.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../kit-common"))
from kitlib import Kit, ROOT

kit = Kit("OfficeKit", "Office",
          {"mass": ((0.62, 0.66, 0.70, 1), 0.85), "trim": ((0.86, 0.88, 0.90, 1), 0.70), "glass": ((0.24, 0.45, 0.55, 1), 0.25)},
          os.path.join(ROOT, "assets/processed/buildings/office-kit.glb"),
          {"bay": 3, "ribbon": 3, "entrance": 3, "canopy": 2, "cornice": 3, "parapet": 2, "roof": 5})
A = {
    "bay": "bottom centre of a vertical mullion fin on the facade plane (3.6 m tall, stretch Y over the floors)",
    "ribbon": "bottom centre of a spandrel/ribbon band on the facade plane (4 m wide x 1 m tall, stretch X/Y)",
    "entrance": "bottom centre of the door threshold on the facade plane (1.6 x 2.7 m)",
    "canopy": "bottom centre of the canopy edge on the facade plane (3.6 m wide)",
    "cornice": "centre of wall run at underside datum (2.0 m tile)",
    "parapet": "centre of parapet cap top (2.0 m tile)",
    "roof": "centre of roof contact footprint",
}

# Vertical mullion fins (depth 0.13-0.19, never coplanar with the facade piers).
m = kit.module("bay_square_01", "bay", A["bay"])
m.box("trim", "fin", (0, 1.8, .095), (.14, 3.6, .15))
for s in (-1, 1):
    m.box("trim", "edge_bead", (s * .052, 1.8, .145), (.045, 3.6, .075))
m = kit.module("bay_blade_02", "bay", A["bay"])
m.box("trim", "web", (0, 1.8, .105), (.05, 3.6, .17)); m.box("trim", "flange", (0, 1.8, .175), (.16, 3.6, .03))
for s in (-1, 1):
    m.box("trim", "blade_edge", (s * .065, 1.8, .155), (.035, 3.6, .065))
m = kit.module("bay_twin_03", "bay", A["bay"])
for s in (-1, 1):
    m.box("trim", "post", (s * .07, 1.8, .09), (.04, 3.6, .14))
    m.box("trim", "post_bead", (s * .07, 1.8, .145), (.035, 3.6, .055))
for y in (.3, 1.2, 2.1, 3.0):
    m.box("trim", "tie", (0, y, .13), (.18, .03, .04))

# Spandrel / ribbon bands.
m = kit.module("ribbon_frit_01", "ribbon", A["ribbon"])
m.box("glass", "pane", (0, .5, .03), (3.9, .86, .012)); m.box("trim", "top", (0, .97, .06), (4, .06, .08)); m.box("trim", "bottom", (0, .03, .06), (4, .06, .08))
m = kit.module("ribbon_louvre_02", "ribbon", A["ribbon"])
m.box("mass", "plate", (0, .5, .03), (4, 1, .02))
for i in range(5):
    m.box("trim", "blade", (0, .1 + i * .2, .10), (3.96, .04, .16))
m = kit.module("ribbon_fascia_03", "ribbon", A["ribbon"])
m.box("mass", "fascia", (0, .5, .07), (4, .88, .10)); m.box("trim", "cap", (0, .97, .11), (4.04, .06, .16)); m.box("trim", "base", (0, .03, .10), (4, .05, .14))

# Entrances: revolving drum frame, glazed pair, portal with sidelights.
m = kit.module("entrance_revolving_01", "entrance", A["entrance"])
for s in (-1, 1):
    m.box("trim", "post", (s * .75, 1.3, .09), (.10, 2.6, .15))
m.box("trim", "head", (0, 2.65, .09), (1.6, .10, .15)); m.cyl("glass", "drum", (0, 1.3, .095), .085, 2.3, 16, "Y")
m.cyl("trim", "drum_cap", (0, 2.5, .095), .10, .06, 16, "Y"); m.cyl("trim", "drum_base", (0, .06, .095), .10, .06, 16, "Y")
for s in (-1, 1):
    m.box("glass", "side", (s * .42, 1.3, .03), (.55, 2.3, .012))
m = kit.module("entrance_glazed_pair_02", "entrance", A["entrance"])
for s in (-1, 1):
    m.box("trim", "jamb", (s * .75, 1.3, .08), (.10, 2.6, .13))
m.box("trim", "head", (0, 2.65, .08), (1.6, .10, .13)); m.box("trim", "stile", (0, 1.3, .06), (.05, 2.3, .06)); m.box("mass", "kick", (0, .2, .04), (1.4, .3, .03))
m.box("glass", "pane", (0, 1.5, .03), (1.4, 2.0, .012))
for s in (-1, 1):
    m.box("trim", "pull", (s * .1, 1.1, .11), (.03, .4, .04))
m = kit.module("entrance_portal_03", "entrance", A["entrance"])
for s in (-1, 1):
    m.box("trim", "post", (s * .78, 1.35, .09), (.09, 2.7, .16)); m.box("trim", "side", (s * .5, 1.3, .05), (.04, 2.3, .06))
m.box("trim", "head", (0, 2.65, .095), (1.66, .12, .17)); m.box("trim", "transom", (0, 2.3, .06), (1.4, .04, .06))
m.box("glass", "pane", (0, 1.15, .03), (1.4, 2.2, .012)); m.box("glass", "transom_pane", (0, 2.48, .03), (1.4, .3, .012))

# Canopy edge lips (the procedural canopy slab stays; its front face is at +0.17 m).
m = kit.module("canopy_fascia_01", "canopy", A["canopy"])
m.box("mass", "plate", (0, .1, .18), (3.6, .2, .02)); m.box("trim", "cap", (0, .21, .15), (3.6, .02, .08))
m = kit.module("canopy_lit_edge_02", "canopy", A["canopy"])
m.box("mass", "plate", (0, .1, .175), (3.6, .2, .01)); m.box("glass", "strip", (0, .1, .185), (3.4, .06, .01)); m.box("trim", "cap", (0, .21, .15), (3.6, .02, .08))

# Podium cornice tiles.
m = kit.module("cornice_bands_01", "cornice", A["cornice"])
m.box("trim", "band_a", (0, .06, .05), (2, .10, .10)); m.box("trim", "band_b", (0, .24, .08), (2, .08, .16))
m = kit.module("cornice_dentil_02", "cornice", A["cornice"])
m.box("trim", "band", (0, .28, .06), (2, .06, .12))
for i in range(12):
    m.box("mass", "dentil", (-1 + (i + .5) / 6, .12, .06), (.09, .14, .09))
m = kit.module("cornice_corbel_03", "cornice", A["cornice"])
m.box("trim", "band", (0, .26, .06), (2, .08, .12))
for s in (-.85, -.3, .3, .85):
    m.box("mass", "corbel", (s, .12, .07), (.16, .22, .11))

# Parapet caps (outer face of the 0.2 m procedural parapet is the wall plane).
m = kit.module("parapet_coping_01", "parapet", A["parapet"])
m.box("trim", "coping", (0, .03, -.10), (2, .06, .26))
m = kit.module("parapet_rail_02", "parapet", A["parapet"])
m.box("trim", "rail", (0, .48, -.10), (2, .04, .05))
for i in range(7):
    m.cyl("trim", "post", (-.9 + i * .3, .24, -.10), .015, .48, 6, "Y")

# Rooftop plant (<= 1.05 m tall).
m = kit.module("roof_cooling_row_01", "roof", A["roof"])
for i in range(3):
    m.box("mass", "unit", (-.9 + i * .9, .32, 0), (.8, .6, .7)); m.cyl("trim", "fan", (-.9 + i * .9, .63, 0), .28, .03, 14, "Y")
    m.cyl("mass", "fan_hub", (-.9 + i * .9, .653, 0), .07, .016, 10, "Y")
m.box("trim", "rack", (0, .01, 0), (2.8, .02, .9))
m = kit.module("roof_lift_overrun_02", "roof", A["roof"])
m.box("mass", "overrun", (0, .5, 0), (1.7, 1.0, 1.6)); m.box("trim", "cap", (0, 1.03, 0), (1.9, .04, 1.8)); m.box("trim", "door", (0, .45, .81), (.7, .9, .03))
m = kit.module("roof_antennas_03", "roof", A["roof"])
m.box("mass", "base", (0, .15, 0), (1.2, .3, 1.2))
for x, z, h in ((-.4, -.3, .75), (.3, .2, .6), (.45, -.35, .4)):
    m.cyl("trim", "mast", (x, .3 + h / 2, z), .02, h, 6, "Y")
m.cyl("trim", "dish", (-.3, .5, .35), .22, .04, 16, "Y")
m = kit.module("roof_plant_mixed_04", "roof", A["roof"])
m.box("mass", "unit", (-.5, .4, 0), (1.3, .8, 1.0)); m.cyl("trim", "stack", (.7, .5, .2), .12, 1.0, 10, "Y"); m.cyl("trim", "stack2", (1.0, .35, -.3), .09, .7, 10, "Y")
m = kit.module("roof_stair_core_05", "roof", A["roof"])
m.box("mass", "core", (0, .45, 0), (1.8, .9, 1.6)); m.box("trim", "slab", (0, .94, 0), (2.0, .06, 1.8)); m.box("trim", "door", (0, .4, .81), (.7, .8, .03))

kit.export()
