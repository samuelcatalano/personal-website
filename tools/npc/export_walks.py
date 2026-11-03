"""Export the retargeted adult and child walk actions for pack_animations.py."""
import os
import bpy

base = os.environ.get("NPC_BASE", "assets/npc/npc_pack.glb")
adult_blend = os.environ["NPC_ADULT_BLEND"]
child_blend = os.environ["NPC_CHILD_BLEND"]
output = os.environ["NPC_EXPORT"]

bpy.ops.import_scene.gltf(filepath=base)
rigs = {"adult": bpy.data.objects["Human.rig"], "child": bpy.data.objects["ChildRig"]}
clips = {
    "adult": (adult_blend, ["NPC_Walk", "NPC_Walk2", "NPC_Walk3"]),
    "child": (child_blend, ["NPC_Walk_C", "NPC_Walk2_C", "NPC_Walk3_C"]),
}

for rig in rigs.values():
    animation = rig.animation_data
    for track in list(animation.nla_tracks):
        animation.nla_tracks.remove(track)
    animation.action = None
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

for kind, (blend, names) in clips.items():
    with bpy.data.libraries.load(blend, link=False) as (source, target):
        target.actions = [name for name in names if name in source.actions]
    actions = {action.name: action for action in target.actions if action}
    assert set(actions) == set(names), (blend, sorted(actions))
    animation = rigs[kind].animation_data_create()
    animation.action = actions[names[0]]
    animation.action_slot = actions[names[0]].slots[0]
    for name in names:
        action = actions[name]
        track = animation.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, action).action_slot = action.slots[0]
    print("PACK", rigs[kind].name, names, flush=True)

bpy.ops.export_scene.gltf(
    filepath=output,
    export_format="GLB",
    export_animations=True,
    export_nla_strips=True,
    export_attributes=True,
    export_image_format="WEBP",
    export_image_quality=80,
    export_keep_originals=True,
)
print("EXPORTED", output, os.path.getsize(output), flush=True)
