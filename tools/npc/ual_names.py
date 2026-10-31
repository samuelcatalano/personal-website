# The UAL1 pack ships two skeleton namings: Unreal-style (pelvis, thigh_l, ...) and Rigify DEF-* (the Godot glTF export).
# The retarget works on world-space rotation deltas against each bone's own rest, so only the names have to match:
# a Rigify-named import is renamed to the Unreal names in place.
RIGIFY_TO_UE = {"DEF-hips": "pelvis", "DEF-spine.001": "spine_01", "DEF-spine.002": "spine_02", "DEF-spine.003": "spine_03",
                "DEF-neck": "neck_01", "DEF-head": "Head"}
for s, u in (("L", "l"), ("R", "r")):
    RIGIFY_TO_UE.update({f"DEF-shoulder.{s}": f"clavicle_{u}", f"DEF-upper_arm.{s}": f"upperarm_{u}",
                         f"DEF-forearm.{s}": f"lowerarm_{u}", f"DEF-hand.{s}": f"hand_{u}", f"DEF-thigh.{s}": f"thigh_{u}",
                         f"DEF-shin.{s}": f"calf_{u}", f"DEF-foot.{s}": f"foot_{u}", f"DEF-toe.{s}": f"ball_{u}"})
    for f in ("index", "middle", "pinky", "ring"):
        for k in (1, 2, 3):
            RIGIFY_TO_UE[f"DEF-f_{f}.0{k}.{s}"] = f"{f}_0{k}_{u}"
    for k in (1, 2, 3):
        RIGIFY_TO_UE[f"DEF-thumb.0{k}.{s}"] = f"thumb_0{k}_{u}"


def to_unreal_names(arm):
    """Rename a Rigify-named UAL armature to Unreal names; actions follow (Blender renames F-curve paths with the bone)."""
    if "DEF-hips" not in arm.data.bones:
        return 0
    n = 0
    for b in arm.data.bones:
        if b.name in RIGIFY_TO_UE:
            b.name = RIGIFY_TO_UE[b.name]
            n += 1
    return n
