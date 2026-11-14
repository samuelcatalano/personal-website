# Caio Bus Glass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the São Paulo Caio's tinted windows reveal a readable simulated cabin in day and night scenes.

**Architecture:** Adjust the Caio-only branch of `busGlass(caio)` in the runtime material shader. Keep the existing opaque pane and synthetic cabin ray-box shading; tune daytime/nighttime cabin light and the reflection balance without changing London or Glasgow.

**Tech Stack:** Plain JavaScript ES modules, pinned Three.js, GLSL via `MeshStandardMaterial.onBeforeCompile`, Blender 5.2.3 headless renderer, browser-harness.

**Spec:** `docs/superpowers/specs/2026-11-14-caio-glass-design.md`

## Global Constraints

- No build step, no npm; Three.js stays on the existing exact pinned importmap version.
- Keep the existing Caio GLB geometry, material roles and route.
- Preserve London and Glasgow bus appearance; no global-lighting, dependency or mobile changes.
- Verify with desktop visuals only; do not run mobile tests.
- Keep the current opaque shader approach so no scenery shows through an unmodeled cabin.

## Review Focus

- Day (`uBusNight = 0`): the Caio's simulated cabin shading is visible through a restrained blue-green tint.
- Night (`uBusNight = 1`): the same shading stays legible and darker than day; the existing ceiling-light shader remains in place.
- Other variants: London and Glasgow retain the original shader values; the non-Caio branch is unchanged.
- View angle: side and three-quarter browser preview inspected.
- Shader path: browser preview rendered one production `BusGlass` role in both themes; the shader error hook stayed clear.

---

### Task 1: Tune the Caio runtime glass shader

**Files:**
- Modify: `js/world/vehicle-assets.js` (`busGlass(caio)`, currently lines 113–159)
- Verify: desktop browser-harness captures; no automated or mobile tests

**Interfaces:**
- Consumes: `lampNight` uniform and the existing Caio cabin-box calculation in `busGlass(caio)`.
- Produces: the same `BusGlass` role with a Caio cabin that remains readable across day/night while the non-Caio bus shader stays unchanged.

- [x] Adjust only the Caio shader's daylight, night saloon and reflection mix values; retain its dark green-blue tint, opaque surface, existing uniform and ceiling-light mask.
- [x] Capture desktop day/night views with the production `upgradeBus` path and verify the windows stay tinted and readable.
- [x] Check the browser shader error hook and run `git diff --check`.

Automated tests, full-scene captures, mobile checks and separate London/Glasgow visual captures were not run; the change is scoped to the Caio-specific shader values.
