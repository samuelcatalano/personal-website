"""Build the project-authored shop facade module library and export its raw GLB.

Run with: blender -b --factory-startup -P tools/buildings/shop-kit/build_shop_kit.py
All modules stay within 0.19 m of the facade plane (the lot reserves a 0.2 m margin) and use only
boxes/cylinders: no textures, no third-party meshes. Runtime scales X (and Y for storefront/door/pilaster).
"""
import math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../kit-common"))
from kitlib import Kit, ROOT

kit = Kit("ShopKit", "Shop",
          {"mass": ((0.55, 0.30, 0.20, 1), 0.88), "trim": ((0.82, 0.76, 0.62, 1), 0.78), "glass": ((0.22, 0.43, 0.52, 1), 0.28)},
          os.path.join(ROOT, "assets/processed/buildings/shop-kit.glb"),
          {"storefront": 4, "entry": 3, "awning": 5, "pilaster": 2, "cornice": 4, "sign": 4, "roof": 5})
A = {
    "storefront": "center of opening sill line on facade plane (nominal 2.4 x 2.18 m)",
    "entry": "center of threshold on facade plane (nominal 1.16 x 2.5 m)",
    "awning": "center of attachment line on facade plane (nominal 2.4 m wide, top edge at y=0)",
    "pilaster": "center of pilaster base on facade plane (nominal 3.0 m tall)",
    "cornice": "center of wall run at underside datum (2.0 m tile)",
    "sign": "center of sign underside on facade plane",
    "roof": "center of parapet top on front parapet line",
}
W, H = 2.4, 2.18


def storefront(n, mullions, transom, bulk, header, cap):
    m = kit.module(f"storefront_{n}", "storefront", A["storefront"])
    for s in (-1, 1):
        m.box("trim", "jamb", (s * (W / 2 + .05), H / 2 + .06, .05), (.12, H + .12, .10))
        if cap:
            m.box("trim", "capital", (s * (W / 2 + .05), H + .02, .08), (.18, .10, .14))
    m.box("trim", "head", (0, H + .06, .06), (W + .22, header, .12))
    for i in range(mullions):
        x = -W / 2 + (i + 1) * W / (mullions + 1)
        m.box("trim", "mullion", (x, H / 2 + .1, .03), (.05, H - .2, .05))
    m.box("trim", "transom", (0, transom, .035), (W, .06, .06))
    m.box("mass", "bulkhead", (0, bulk / 2, .05), (W, bulk, .09))
    if bulk > .4:
        m.box("trim", "bulkhead_panel", (0, bulk / 2, .105), (W - .3, bulk - .16, .02))
    m.box("trim", "sill", (0, .02, .09), (W + .24, .06, .16))


storefront("timber_01", 1, 1.70, .55, .14, False)
storefront("broad_02", 3, 1.80, .42, .12, False)
storefront("slim_iron_03", 4, 1.92, .26, .09, False)
storefront("capital_04", 2, 1.76, .62, .20, True)


def entry(n, leaf_glass, fanlight, kick):
    m = kit.module(f"entry_door_{n}", "entry", A["entry"])
    w, h = 1.16, 2.5
    for s in (-1, 1):
        m.box("trim", "jamb", (s * (w / 2 + .04), h / 2, .05), (.10, h, .10))
    m.box("trim", "head", (0, h + .05, .06), (w + .2, .14, .12))
    m.box("mass", "leaf", (0, (h - .3) / 2, -.12), (w - .06, h - .3, .06))
    m.box("glass", "leaf_glass", (0, (h - .3) / 2 + kick / 2, -.085), (w - .3, h - .3 - kick - .35, .02))
    if fanlight:
        m.box("glass", "fanlight", (0, h - .12, -.10), (w - .1, .2, .02))
        m.box("trim", "fan_bar", (0, h - .24, -.08), (w - .06, .04, .04))
    m.box("trim", "handle", (w / 2 - .14, 1.0, -.07), (.04, .22, .05))
    m.box("mass", "step", (0, .02, .09), (w + .3, .10, .20))
    m.box("trim", "kickplate", (0, kick / 2 + .02, -.085), (w - .12, kick, .02))


entry("glazed_top_01", True, False, .5)
entry("full_glass_02", True, True, .25)
entry("kick_fan_03", True, True, .45)


def awning(n, kind):
    m = kit.module(f"awning_{n}", "awning", A["awning"])
    w = 2.3
    if kind == "slope":
        m.box("mass", "fabric", (0, -.17, .095), (w, .03, .40), rot=(math.atan2(.17, .34), 0, 0))
        m.box("mass", "valance", (0, -.38, .18), (w, .16, .02))
        m.box("trim", "rod", (0, -.02, .02), (w + .04, .04, .04))
        for s in (-1, 1):
            m.box("mass", "cheek", (s * w / 2, -.19, .09), (.02, .34, .17))
    elif kind == "flat":
        m.box("mass", "slab", (0, -.06, .095), (w, .07, .19))
        m.box("trim", "edge", (0, -.10, .185), (w, .12, .02))
    elif kind == "bracket":
        m.box("trim", "slab", (0, -.05, .095), (w + .1, .05, .19))
        m.box("mass", "lip", (0, -.13, .18), (w + .1, .12, .02))
        for s in (-.9, 0, .9):
            m.box("trim", "bracket", (s, -.22, .075), (.04, .30, .03), rot=(0, 0, 0))
    elif kind == "scallop":
        m.box("mass", "fabric", (0, -.13, .095), (w, .03, .32), rot=(math.atan2(.15, .3), 0, 0))
        for i in range(8):
            m.box("mass", "scallop", (-w / 2 + (i + .5) * w / 8, -.31 - (i % 2) * .03, .185), (w / 8 - .01, .14 + (i % 2) * .06, .02))
        m.box("trim", "rod", (0, -.02, .02), (w + .04, .04, .04))
    else:  # box / dutch
        m.box("mass", "front", (0, -.15, .17), (w, .30, .04))
        m.box("mass", "top", (0, -.015, .095), (w, .03, .19))
        for s in (-1, 1):
            m.box("mass", "end", (s * (w / 2 - .01), -.15, .09), (.02, .30, .18))
        m.box("trim", "band", (0, -.27, .195), (w - .1, .04, .01))


for n, k in (("slope_01", "slope"), ("flat_02", "flat"), ("bracket_03", "bracket"), ("scallop_04", "scallop"), ("box_05", "box")):
    awning(n, k)


def pilaster(n, flutes):
    m = kit.module(f"pilaster_{n}", "pilaster", A["pilaster"])
    m.box("mass", "plinth", (0, .12, .06), (.40, .24, .12))
    m.box("trim", "shaft", (0, 1.45, .05), (.30, 2.5, .10))
    for i in range(flutes):
        m.box("mass", "flute", (-.1 + i * .2 / max(1, flutes - 1), 1.45, .105), (.04, 2.2, .01))
    m.box("trim", "capital", (0, 2.82, .08), (.40, .20, .16))


pilaster("plain_01", 0)
pilaster("fluted_02", 3)


def cornice(n, kind):
    m = kit.module(f"cornice_{n}", "cornice", A["cornice"])
    w = 2.0
    m.box("trim", "band", (0, .10, .04), (w, .20, .08))
    if kind == "dentil":
        for i in range(10):
            m.box("mass", "dentil", (-w / 2 + (i + .5) * w / 10, .03, .09), (.11, .09, .06))
        m.box("trim", "crown", (0, .24, .06), (w, .08, .12))
    elif kind == "bracket":
        for s in (-.8, 0, .8):
            m.box("mass", "bracket", (s, .14, .08), (.10, .26, .10))
        m.box("trim", "crown", (0, .26, .07), (w, .10, .14))
    elif kind == "cavetto":
        m.box("trim", "cove", (0, .24, .08), (w, .08, .10))
        m.box("trim", "cove2", (0, .30, .06), (w, .06, .12))
        m.box("mass", "frieze", (0, -.04, .03), (w, .10, .06))
    else:
        m.box("trim", "crown", (0, .24, .05), (w, .10, .10))


for n, k in (("dentil_01", "dentil"), ("bracket_02", "bracket"), ("cavetto_03", "cavetto"), ("plain_04", "plain")):
    cornice(n, k)


def sign(n, kind):
    m = kit.module(f"signboard_{n}", "sign", A["sign"])
    if kind == "fascia":
        m.box("mass", "panel", (0, .25, .035), (2.2, .42, .04))
        for y in (.03, .47):
            m.box("trim", "rail", (0, y, .045), (2.3, .06, .06))
        for s in (-1, 1):
            m.box("trim", "end", (s * 1.12, .25, .045), (.06, .5, .06))
    elif kind == "plaque":
        m.box("mass", "plaque", (0, .30, .14), (.55, .60, .05))
        m.box("trim", "frame", (0, .30, .165), (.63, .68, .02))
        for sx in (-.2, .2):
            m.box("trim", "pin", (sx, .55, .07), (.03, .03, .14))
    elif kind == "arched":
        for i, w in enumerate((2.0, 1.7, 1.2)):
            m.box("mass", "panel", (0, .12 + i * .1, .04), (w, .12, .05))
        m.box("trim", "base", (0, .02, .05), (2.1, .05, .07))
    else:  # lightbox
        m.box("trim", "case", (0, .27, .08), (1.5, .50, .14))
        m.box("glass", "face", (0, .27, .155), (1.4, .40, .01))
        for s in (-.6, .6):
            m.box("trim", "arm", (s, .27, .03), (.04, .06, .06))


for n, k in (("fascia_01", "fascia"), ("plaque_02", "plaque"), ("arched_03", "arched"), ("lightbox_04", "lightbox")):
    sign(n, k)


def roof(n, kind):
    m = kit.module(f"roof_{n}", "roof", A["roof"])
    if kind == "pediment":
        for i, (w, h) in enumerate(((3.0, .22), (2.2, .22), (1.4, .20), (.7, .18))):
            m.box("mass", "step", (0, .11 + sum(x[1] for x in ((3.0, .22), (2.2, .22), (1.4, .20))[:i]), 0), (w, h, .13))
        m.box("trim", "finial", (0, 1.0, 0), (.14, .22, .14))
    elif kind == "balustrade":
        w = 2.0
        m.box("trim", "rail", (0, .46, 0), (w, .07, .16))
        m.box("trim", "base", (0, .04, 0), (w, .08, .16))
        for i in range(8):
            m.cyl("trim", "baluster", (-w / 2 + (i + .5) * w / 8, .25, 0), .045, .40, 8)
    elif kind == "hatch":
        m.box("mass", "body", (0, .55, 0), (1.5, 1.1, 1.5))
        m.box("trim", "slab", (0, 1.13, 0), (1.7, .07, 1.7))
        m.box("trim", "door", (0, .45, .76), (.7, .9, .03))
    elif kind == "vents":
        for i, x in enumerate((-.5, 0, .5)):
            m.cyl("trim", "stack", (x, .35 + i * .1, 0), .09, .7 + i * .2, 10)
            m.cyl("mass", "cap", (x, .72 + i * .2, 0), .14, .05, 10)
    else:  # AC
        m.box("mass", "unit", (-.5, .35, 0), (.9, .7, .8))
        m.box("mass", "unit", (.55, .3, .1), (.8, .6, .7))
        m.cyl("trim", "fan", (-.5, .72, 0), .30, .03, 14)
        m.box("trim", "rail", (0, .04, 0), (2.4, .08, 1.1))


for n, k in (("pediment_01", "pediment"), ("balustrade_02", "balustrade"), ("hatch_03", "hatch"), ("vents_04", "vents"), ("ac_cluster_05", "ac")):
    roof(n, k)

kit.export()
