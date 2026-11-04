# Human anatomy

Work in metres. Blender uses Z up internally; export glTF to Y up once, then verify the result. Keep feet at the intended ground plane and measure crown-to-floor height without hair/hat inflation. Record intended height instead of scaling by eye after integration.

Check head-to-body ratio, shoulder/pelvis widths, elbow/wrist/knee/ankle levels, limb lengths, hand/foot size and posture against the subject. Match the reference person's proportions rather than enforcing a universal ideal. Inspect front, side and back in an untextured view; clothing must not conceal a broken shoulder or hip.

For animation, use deliberate edge flow around shoulders, elbows, hips, knees, mouth and eyes. Avoid poles on bending creases, doubled internal surfaces and narrow triangles at joints. Preserve a clean neutral pose and inspect normals, non-manifold seams and accidental loose geometry. Intentional eye/hair/garment layers are not automatically topology errors.

Run `validate_character.py` to check finite evaluated geometry, applied mesh/armature rotation and scale, and plausible metre height. It reports scene-wide bounds, so run it on a character source without a floor or unrelated props. Configure height bounds for the actual subject. It cannot identify anatomical plausibility, correct facing or a recognisable face.

Gate: measured proportions and neutral turntable approved before skin binding. Keep the pre-rig source for later proportional corrections.
