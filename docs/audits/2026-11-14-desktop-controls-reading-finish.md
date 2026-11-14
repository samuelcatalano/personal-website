# Desktop controls, reading and scene finish — 2026-11-14

## Boundary and execution

Owner selected only control clarity, secondary typography/panel density and localized scene finish. Desktop only; no mobile validation, intro/loading redesign, contact reordering, asset delivery change, dependency, map/route change or architectural redesign. One agent handled the coupled UI/rendering changes; delegation and model switching were unnecessary.

## Delivered

- Auto ride and quick tour have visible EN/PT labels and separate pressed states. Secondary view/postcard/sound/voice actions live in an Options disclosure. Theme/language remain immediately available. Escape restores disclosure focus; outside clicks and starting a ride close it.
- Desktop panel width grows from 360 to 400px, with 24px padding. Secondary metadata, tags and instructions use 12–13px selectively; the profile name fits on one line in the checked 1440px view. Existing content and fonts remain. The header destination blind yields space below 1601px so the labelled controls fit.
- Desktop medium postprocessing retains 4× MSAA instead of 2×. High remains 4×; small-viewport medium policy is unchanged. There is no new pass, texture, light or geometry.
- Ordinary masonry's random per-brick colour variation fades when its projected cells become subpixel. Existing world-space variation, close detail and shared material/atlas structure remain; this addresses distant sparkle without adding more repeating assets or changing architecture.

## Evidence

- `node --test tests/content.test.mjs tests/panel-content.test.mjs tests/preload.test.mjs tests/logic.test.mjs tests/render-lifecycle.test.mjs`: 55 passed.
- `browser-harness < tests/desktop-polish.browser.py`: passed. Covers disclosure, native Space/Escape input, focus return, secondary sound action, EN/PT, metadata size, quick-tour state and header bounds at 1280/1440/1920px. Uses a controlled WebGL-disabled/reduced-motion page to isolate UI behavior.
- `browser-harness < tests/ordinary-finish.browser.py`: passed; ordinary atlas remains 1024px, preserved atlas 512px; geometry/material/room shaders render without WebGL errors.
- Desktop execution of the `expression` probe in `tests/render-resources.browser.py`: high/medium both 4×; environment targets and compositor resources released once, no WebGL error. Its small-viewport loop was not run.
- Live full-scene checks: 216 compiled programs, zero failed programs and WebGL error 0 in the sampled day/night views. Desktop hero/options and repository captures inspected in EN/PT. Transient images: `/tmp/desktop-polish/`.
- `git diff --check`: passed.

## Short rendering A/B and limitations

Same live scene/camera, 1440×900, DPR 1, medium compositor, two warm-up frames and five timed frames per variant, GPU synchronized with `gl.finish()`. The baseline module differed only in the former 2× medium policy. Median compositor rendering: **4.2ms at 2× / 8.3ms at 4×**. Both submitted **504 calls / 4,830,854 triangles**. This probe excludes normal simulation/UI/reflection scheduling and is not end-to-end frame timing, a repeatable device benchmark or a universal FPS result. Extra MSAA storage/bandwidth is real; physical GPU memory was not measured.

The older `tests/material-polish.browser.py` probe stops at an expectation that city and monument materials share all textures. Current `materialSet` already isolates the 1024px ordinary atlas from the 512px preserved atlas, as verified by `ordinary-finish`; this task does not rewrite that historical probe.

**Scoped visual/functional GO; no performance or production-readiness GO.** No full regression, Lighthouse, mobile, physical-device or citywide benchmark was run. No commit, push or deployment.
