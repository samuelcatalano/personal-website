"""Build the project-authored midrise facade module library and export its raw GLB.

Run with: blender -b --factory-startup -P tools/buildings/midrise-kit/build_midrise_kit.py
Facade modules stay within 0.19 m of the wall plane (the lot reserves a 0.2 m margin); roof modules
sit on the roof slab. Boxes/cylinders only: no textures, no third-party meshes.
"""
import math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../kit-common"))
from kitlib import Kit, ROOT

kit = Kit("MidriseKit", "Midrise",
          {"mass": ((0.70, 0.68, 0.62, 1), 0.88), "trim": ((0.85, 0.83, 0.76, 1), 0.78), "glass": ((0.22, 0.43, 0.52, 1), 0.28)},
          os.path.join(ROOT, "assets/processed/buildings/midrise-kit.glb"),
          {"window": 6, "loggia": 3, "lobby": 3, "canopy": 3, "cornice": 3, "parapet": 2, "roof": 5})
A = {
    "window": "center of sill line on facade plane (nominal 1.58 x 1.8 m)",
    "loggia": "center of lower sill line on facade plane (nominal 1.9 m wide, one storey = 3.0 m)",
    "lobby": "center of threshold on facade plane (nominal 1.5 x 2.6 m)",
    "canopy": "center of canopy attachment line on facade plane (nominal 2.65 m wide)",
    "cornice": "center of wall run at underside datum (2.0 m tile)",
    "parapet": "center of parapet cap top (2.0 m tile)",
    "roof": "center of roof contact footprint",
}
W, H = 1.58, 1.8


def window(n, kind):
    m = kit.module(f"window_{n}", "window", A["window"])
    m.box("trim", "sill_drip", (0, -.30, .14), (W + .32, .075, .10))
    if kind == "juliet":
        for s in (-1, 1):
            m.box("trim", "post", (s * (W / 2 + .02), .45, .09), (.05, .9, .06))
        for y in (.06, .9):
            m.box("trim", "rail", (0, y, .09), (W + .1, .05, .06))
        for i in range(7):
            m.box("trim", "bar", (-W / 2 + (i + 1) * W / 8, .48, .09), (.02, .84, .02))
    elif kind == "ledge":
        m.box("mass", "slab", (0, -.26, .095), (W + .5, .12, .19))
        m.box("trim", "rail_top", (0, .64, .17), (W + .5, .04, .04))
        m.box("glass", "panel", (0, .30, .17), (W + .4, .62, .015))
        for s in (-1, 1):
            m.box("trim", "post", (s * (W / 2 + .24), .30, .17), (.04, .8, .04))
        m.box("trim", "rail_low", (0, -.15, .17), (W + .5, .04, .04))
    elif kind == "planter":
        m.box("mass", "slab", (0, -.26, .095), (W + .3, .12, .19))
        m.box("trim", "box", (0, -.06, .13), (W - .1, .22, .12))
        for i in range(5):
            m.cyl("mass", "shrub", (-W / 2 + .2 + i * (W - .4) / 4, .1 + (i % 2) * .05, .14), .11, .2, 8, "Y")
    elif kind == "hood":
        for s in (-1, 1):
            m.box("trim", "jamb", (s * (W / 2 + .06), H / 2, .035), (.10, H + .1, .07))
        m.box("trim", "head", (0, H + .06, .05), (W + .3, .12, .10))
        m.box("mass", "hood", (0, H + .17, .09), (W + .34, .08, .18))
        m.box("trim", "sill", (0, -.2, .08), (W + .24, .06, .16))
    elif kind == "shutter":
        for s in (-1, 1):
            m.box("mass", "shutter", (s * (W / 2 + .26), H / 2, .035), (.42, H, .05))
            for j in range(6):
                m.box("trim", "slat", (s * (W / 2 + .26), .2 + j * .28, .065), (.36, .03, .02))
        m.box("trim", "sill", (0, -.2, .08), (W + .24, .06, .16))
    else:  # bracketed sill
        m.box("trim", "sill", (0, -.2, .09), (W + .3, .07, .18))
        for s in (-1, 1):
            m.box("mass", "bracket", (s * (W / 2 - .12), -.31, .07), (.10, .16, .12))
        m.box("trim", "frieze", (0, H + .1, .04), (W + .2, .10, .08))


for n, k in (("juliet_rail_01", "juliet"), ("balcony_ledge_02", "ledge"), ("planter_ledge_03", "planter"), ("hood_surround_04", "hood"), ("shuttered_05", "shutter"), ("bracketed_sill_06", "bracket")):
    window(n, k)


def loggia(n, kind):
    m = kit.module(f"loggia_{n}", "loggia", A["loggia"])
    w, h = 1.9, 3.0
    for s in (-1, 1):
        m.box("mass", "pier", (s * (w / 2), h / 2 - .1, .09), (.16, h + .1, .16))
    m.box("mass", "slab_top", (0, h + .05, .09), (w + .3, .14, .18))
    m.box("mass", "slab_bottom", (0, -.26, .09), (w + .3, .14, .18))
    if kind == "rail":
        m.box("trim", "rail", (0, .55, .15), (w, .04, .04))
        m.box("glass", "panel", (0, .30, .15), (w - .1, .5, .015))
    elif kind == "frame":
        m.box("trim", "mid", (0, h / 2 + .1, .15), (w, .06, .05))
        m.box("trim", "rail", (0, .55, .15), (w, .04, .04))
    else:
        for i in range(5):
            m.box("trim", "bar", (-w / 2 + .2 + i * (w - .4) / 4, .3, .15), (.03, .6, .03))
        m.box("trim", "rail", (0, .62, .15), (w, .04, .04))


for n, k in (("piers_rail_01", "rail"), ("portal_frame_02", "frame"), ("piers_bars_03", "bars")):
    loggia(n, k)


def lobby(n, sidelights, transom):
    m = kit.module(f"lobby_door_{n}", "lobby", A["lobby"])
    w, h = 1.5, 2.6
    for s in (-1, 1):
        m.box("trim", "jamb", (s * (w / 2 + .06), h / 2, .06), (.12, h, .12))
    m.box("trim", "head", (0, h + .06, .07), (w + .3, .14, .14))
    leaf = (w - .06) / 2
    for s in (-1, 1):
        m.box("mass", "leaf", (s * leaf / 2, (h - .3) / 2 + .05, -.30), (leaf - .02, h - .4, .05))
        m.box("glass", "leaf_glass", (s * leaf / 2, (h - .3) / 2 + .15, -.272), (leaf - .22, h - .9, .01))
        m.box("trim", "pull", (s * .06, 1.05, -.24), (.03, .35, .04))
    m.box("trim", "mid_stile", (0, h / 2, -.28), (.05, h - .3, .04))
    if transom:
        m.box("glass", "transom", (0, h - .1, -.28), (w - .1, .22, .01))
        m.box("trim", "transom_bar", (0, h - .24, -.27), (w, .04, .04))
    if sidelights:
        for s in (-1, 1):
            m.box("trim", "side_post", (s * (w / 2 + .20), h / 2, .04), (.06, h, .08))
    m.box("mass", "step", (0, .04, .08), (w + .5, .10, .20))


lobby("glazed_pair_01", False, True)
lobby("plain_pair_02", False, False)
lobby("framed_pair_03", True, True)


def canopy(n, kind):
    m = kit.module(f"canopy_{n}", "canopy", A["canopy"])
    w = 2.65
    if kind == "slab":
        m.box("mass", "slab", (0, 0, .095), (w, .14, .19))
        m.box("trim", "edge", (0, -.03, .19), (w, .20, .01))
    elif kind == "glass":
        m.box("trim", "frame", (0, 0, .095), (w, .05, .19))
        m.box("glass", "pane", (0, .01, .10), (w - .1, .02, .16))
        for s in (-1, 1):
            m.box("trim", "rod", (s * (w / 2 - .15), -.35, .06), (.015, .7, .015))
    else:
        m.box("mass", "box", (0, -.04, .10), (w, .26, .18))
        m.box("trim", "cap", (0, .11, .10), (w + .06, .04, .20))
        m.box("trim", "drip", (0, -.19, .15), (w, .03, .08))


for n, k in (("slab_01", "slab"), ("glass_02", "glass"), ("fascia_03", "box")):
    canopy(n, k)


def cornice(n, kind):
    m = kit.module(f"cornice_{n}", "cornice", A["cornice"])
    w = 2.0
    if kind == "corbel":
        m.box("trim", "band", (0, .26, .04), (w, .08, .08))
        for s in (-.85, -.3, .3, .85):
            m.box("mass", "corbel", (s, .10, .06), (.16, .22, .10))
            m.box("mass", "corbel_head", (s, .22, .08), (.20, .06, .14))
    elif kind == "dentil":
        m.box("trim", "band", (0, .28, .04), (w, .06, .08))
        for i in range(12):
            m.box("mass", "dentil", (-w / 2 + (i + .5) * w / 12, .12, .05), (.09, .14, .08))
    else:
        m.box("trim", "band_a", (0, .06, .035), (w, .10, .07))
        m.box("trim", "band_b", (0, .24, .05), (w, .08, .10))


for n, k in (("corbel_01", "corbel"), ("dentil_02", "dentil"), ("band_03", "band")):
    cornice(n, k)


def parapet(n, rail):
    m = kit.module(f"parapet_{n}", "parapet", A["parapet"])
    w = 2.0
    if not rail:
        m.box("trim", "coping", (0, .03, 0), (w, .06, .20))
        for s in (-1, 1):
            m.box("mass", "pier", (s * (w / 2 - .09), .14, 0), (.18, .22, .18))
    else:
        m.box("trim", "rail_top", (0, .55, 0), (w, .04, .05))
        for i in range(7):
            m.cyl("trim", "post", (-w / 2 + .15 + i * (w - .3) / 6, .28, 0), .015, .55, 6)


parapet("coping_01", False)
parapet("safety_rail_02", True)


def roof(n, kind):
    m = kit.module(f"roof_{n}", "roof", A["roof"])
    if kind == "stair":
        m.box("mass", "core", (0, .85, 0), (2.4, 1.7, 2.2))
        m.box("trim", "slab", (0, 1.74, 0), (2.6, .08, 2.4))
        m.box("trim", "door", (0, .55, 1.11), (.8, 1.1, .03))
    elif kind == "ac_row":
        for i in range(4):
            m.box("mass", "unit", (-1.35 + i * .9, .35, 0), (.8, .7, .7))
            m.cyl("trim", "fan", (-1.35 + i * .9, .72, 0), .28, .03, 14)
        m.cyl("mass", "fan_hub", (-1.35 + i * .9, .742, 0), .07, .018, 10)
        m.box("trim", "rack", (0, .04, 0), (3.8, .08, .9))
    elif kind == "tank":
        for sx in (-.6, .6):
            for sz in (-.6, .6):
                m.box("trim", "leg", (sx, .5, sz), (.08, 1.0, .08))
        m.cyl("mass", "tank", (0, 1.5, 0), .95, 1.0, 20)
        m.cyl("trim", "lid", (0, 2.05, 0), .8, .12, 20)
    elif kind == "lift":
        m.box("mass", "overrun", (0, .8, 0), (1.9, 1.6, 1.9))
        m.box("trim", "cap", (0, 1.64, 0), (2.1, .08, 2.1))
    else:
        m.box("mass", "unit", (-.6, .45, 0), (1.3, .9, 1.0))
        m.cyl("trim", "stack", (.7, .7, .2), .12, 1.4, 10)
        m.cyl("trim", "stack2", (1.0, .5, -.3), .09, 1.0, 10)
        m.box("trim", "plinth", (0, .04, 0), (3.0, .08, 1.6))


for n, k in (("stair_core_01", "stair"), ("ac_row_02", "ac_row"), ("water_tank_03", "tank"), ("lift_overrun_04", "lift"), ("ac_mixed_05", "mixed")):
    roof(n, k)

kit.export()
