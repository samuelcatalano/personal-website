# NPC locomotion — 2026-11-17

## Diagnosis and approach

The supplied walking clip showed inconsistent sole contact, limited visible weight transfer, and an upper body that stayed comparatively rigid. The main walk clips are imported, in-place skeletal animation. The GLB root translation is constant in the three active clips. World translation remains owned by the pedestrian routes. In each frame the renderer restores the previous mixer pose, evaluates the animation, applies additive body mechanics, and runs the existing foot IK last within its near-camera budget.

The prior IK locked the ankle against one neutral standing height. That height changes relative to the sole as the shoe rolls. The new solver tracks heel and forefoot proxies in their own bone spaces and interpolates a support pivot, retaining the authored shoe and toe rotations. IK keeps the authored knee plane and bounds the target by leg length. Pelvis movement now follows the animated thighs, with damped lateral transfer, small vertical travel and counter-rotation through the torso and head. Stopping reduces cadence before the mixed standing pose takes over. Pool reuse derives phase from pedestrian identity. A route wrap no longer presents as a frame of walking speed.

## Desktop evidence

The Chrome fixture compared the same three characters, change of pace and turn from front, three-quarter and side views. A separate run sampled rendered shoe vertices on one adult and one child walking at 0.55 m/s. Each series has 100 samples after warm-up.

| Lowest shoe vertex relative to the pavement | Before | After |
| --- | ---: | ---: |
| Adult, deepest penetration | −31.7 mm | −7.0 mm |
| Child, deepest penetration | −25.1 mm | −9.4 mm |
| Adult, 90th-percentile clearance | −1.2 mm | +2.9 mm |
| Child, 90th-percentile clearance | +18.6 mm | +2.8 mm |

In a separate matched Chrome fixture with 30 visible walking NPCs, median NPC update cost over nine 150-frame batches went from 0.675 to 0.757 ms/frame. Each build rendered 92 draw calls in the same fixture. This measures CPU update work only. It excludes GPU frame time. Pose and foot-IK budgets remain 24 and 8 at the tested desktop width. The real world was sampled near the MASP and in London, with the pedestrian camera enabled.

Contact uses two skeletal proxies, so shoe silhouettes can still cross the pavement by a few millimetres. The original clips and silhouettes remain. Desktop results cover the sampled characters and routes, with no mobile run.

## Walkable surface height follow-up

Some plaza paths use 0.02 m as a nominal elevation, although the rendered paving starts at 0.07 m or higher. NPC placement now resolves nearby low pavement boxes and urban sidewalk planes by their horizontal footprints, using the path height as a fallback and lower bound. This applies to the entire rendered pool before pose and contact correction. Real-scene Chrome samples identified 31–33 affected pedestrians near MASP and 14–16 in London. This lookup covers low procedural surfaces; it is not a terrain raycast against arbitrary landmark geometry.
