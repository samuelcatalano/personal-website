# Locomotion

Separate navigation from animation. Match the existing movement simulation; do not bend routes or speed up the world to disguise a bad clip. For this repository, `people.js` is authoritative for position, heading and eased turn pace; `npc3d.js` matches mixer cadence to that pace.

Retarget only after rest-axis/scale checks. Determine whether the source clip contains root translation. Choose in-place playback for externally driven navigation, remove horizontal root translation once in the export and retain natural vertical hip motion. Never apply root movement in both the clip and runtime.

Measure cycle duration and travelled stride before removing root translation, or derive stride from planted-foot displacement in a verified cycle. Target playback rate is movement speed divided by stride speed after character scale. State units and scale. Do not reuse the old pack's measured clip speeds for a new skeleton or motion. If cadence needs implausible speed, choose/rework the clip.

Inspect heel strike, toe-off, stance contact, toe/heel roll, pelvic motion, arm counter-swing and loop seam. Render front and side over at least two cycles with floor/contact markers; inspect frame by frame for foot slide and ground penetration. Test idle-to-walk, eased stopping and direction change; freezing a walking pose is not an idle animation.

Gate: measured cycle/stride/speed and a preserved contact review. Test the exported clip in Three.js, including accumulated delta when distant animation is throttled. No clip is approved from a still render or a count of keyframes.
