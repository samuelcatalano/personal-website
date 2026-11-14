# Corolla wheel lighting — 2026-11-14

The reported night-time front-wheel artifact was reproduced on the Corolla's shared body/wheel atlas. `texturedRearLight` classifies bright pixels by car-space position; the front-wheel upper rim falls inside its headlamp bounds. Applying this body shader to separated spinning wheel meshes makes the rim emit headlamp light. This is independent of wheel pivot, radius and rotation correctness.

The shared vehicle upgrade now excludes its wheel children from the body lamp shader. No asset, geometry, axle, animation, route or lighting configuration changes. Existing uncommitted desktop-polish work is preserved; no Moon changes are included.

`tests/vehicle-wheel-lights.browser.py` failed before the fix: an isolated, unlit front axle produced 255/255 brightness. After the fix, both axles remain dark (at most 1/255) while the actual headlamp still reaches 255/255; no WebGL error. The test renders actual materials and pixels, rather than checking shader strings. Night-time comparison captures: `/tmp/wheel-audit/before-lights.png` and `after-lights.png`.

Related Node tests (`wheel-roll`, `fleet-axles`, `vehicle-loading`) passed. Wheel-shape and fleet movement audits passed after the change. `git diff --check` passed. Desktop/local validation only; no mobile, full regression, production deployment or universal rendering-quality claim.
