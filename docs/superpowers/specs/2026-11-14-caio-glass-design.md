# Caio bus glass: short design

**Status:** implemented; uncommitted

## Goal

Make the São Paulo Caio's windows read as tinted glass with a visible cabin in both daylight and night scenes. Keep the Caio identity and existing bus geometry.

## Approaches considered

- **Tune the Caio runtime glass shader (chosen):** brighten its simulated cabin for day and night, reduce the overly dark reflection/read while retaining a restrained green-blue tint. This matches the current architecture: `BusGlass` is replaced at runtime, and the cabin is simulated in the shader.
- **Add a modeled cabin and alpha glass in Blender:** more physical transparency, but requires new interior geometry and sorting/performance work. This exceeds the requested visual correction.
- **Change only the GLB glass material:** ineffective in the site because the runtime replaces that material for `BusGlass`.

## Visual contract

- Keep dark window frames and green Caio livery.
- At day, the windows remain reflective and tinted but the cabin no longer reads as a black slab.
- At night, retain the existing ceiling-light cue and show the cabin's volume instead of a uniform dark pane.
- Limit the change to the Caio shader; London and Glasgow buses, global lighting, geometry, routes, and other vehicles stay as they are.

## Verification

- Use the project's headless Blender renderer for Caio model views; avoid the available live Blender helper because it may clear the open scene.
- Use browser-harness for desktop São Paulo day/night captures. No mobile checks.
