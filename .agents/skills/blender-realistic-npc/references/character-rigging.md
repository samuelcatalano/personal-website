# Character rigging

Choose a rig already supported by the local toolchain. MPFB/Rigify availability does not prove generator autorig weights are installed. Keep the editable control rig; export a tested deform skeleton with baked actions as appropriate. Do not rename a live runtime skeleton or replace the existing NPC pack.

Apply intended mesh/armature rotation and scale before binding, preserve rest pose and use one unambiguous Armature modifier per skinned mesh. Use a neutral A/T pose compatible with the chosen retargeter. Bone names alone do not establish rest-axis compatibility: compare local rest matrices, lengths, roll, hierarchy and root/hips roles.

Check every visible vertex has finite, nonnegative, normalized weights on deform bones. Remove irrelevant influences and cap them to the renderer/export target (normally four for this slice). Do not normalize mask/control vertex groups as skin weights. Check bend volume at shoulders/hips and twists at forearms/calves; weight transfer is a starting point.

Run `validate_rig.py`, then visually test elbows/knees at 90 degrees, raised arms, hip flexion, torso twist and neck turns. Look for collapsing joints, garment penetration, floating eyes and detached hair. Keep helpers/IK controls out of the runtime export unless needed. Constraints/drivers must be baked; a correct Blender control animation may export no motion if action selection is wrong.

Gate: character and rig validators pass, pose captures approved, exported/reimported deform rig behaves correctly. Structural weight checks do not verify animation quality or bone-axis compatibility.
