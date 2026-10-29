# São Paulo Bus Integration Plan

> User supplied complete implementation requirements and opted out of further planning discussion. Preserve existing route, landmarks, shared movement, and desktop-only validation.

**Goal:** Preserve the primary vehicle sequence Mini → London → Glasgow → London → Mini. A separate secondary London bus changes to the São Paulo model when its own route position crosses back below the existing `swapAt(stops)` boundary.

**Scope:** Prepare the supplied full-resolution GLB in Blender; register attribution; share the full-resolution model with one existing secondary traffic bus. Preserve the Mini and its current outbound/return behavior. Reuse the exact `swapAt` boundary and secondary vehicle's existing route, position, heading, speed, and wheel update. No route edits, new runtime dependency, external texture, mobile validation, or scene redesign.

## Tasks

### Task 1 — Prepare the source GLB

- Import supplied GLB in Blender; exclude stray geometry, correct transforms, normals, and ground origin without rebuilding the bus.
- Paint the body São Paulo lime green, black window band, and blue electric-bus sweep from the supplied reference sheet; preserve bus details and use existing bus material roles.
- Preserve the supplied high-resolution geometry without a triangle cap; keep semantic material-role batching, with no textures or new runtime dependencies.
- Export `assets/vehicles/sao-paulo-bus.glb`, save a reproducible Blender build/validation path under `tools/vehicles/caio-millennium-volvo-b10m/`, and record the supplied asset's CC-BY attribution in `ASSET_SOURCES.md`.

### Task 2 — Integrate regional secondary traffic

- Add the São Paulo GLB to the existing vehicle asset loader and shared bus material pipeline.
- In `scene.js`, preserve the primary Mini→London→Glasgow→London→Mini sequence. Do not put São Paulo in the primary hero group.
- In `ambient.js`, convert one existing oncoming London secondary bus into a regional bus. At its own route position, keep the London GLB on/above `swapAt` and change it to the São Paulo full-resolution model below the boundary. Preserve its shared route pose, heading, speed, and wheel updates through a short fade.
- Keep all other secondary vehicles and their regional selectors intact.
- Extend targeted desktop browser assertions for primary return-to-Mini, the secondary bus's exact regional boundary, São Paulo high-resolution model adoption, and its runtime model selection; keep fallback and traffic checks covered.

### Task 3 — Desktop validation and review

- Validate the exported GLB structure, bounds, role materials, preserved geometry, and wheels in Blender.
- Run only directly related browser/Node checks; one consolidated desktop visual pass across the primary sequence and secondary London→São Paulo crossing, day/night, and console errors. No mobile tests, captures, or review.
- Compare desktop resource counters with the existing vehicle baseline; report measured limits rather than extrapolating performance.

## Current interfaces and constraints

- `scene.js` owns one shared hero group and applies route pose/orientation plus wheel motion; only candidate vehicle selection should change.
- `layout.js:swapAt(stops)` is half a stop before `ukStart(stops)`. Reuse it exactly.
- Existing vehicle loader uses pinned Three.js `GLTFLoader`, cached GLB geometries, shared semantic bus materials, and failure fallback.
- Vehicle coordinates: +X forward, +Y up, +Z right, metres, ground origin. The supplied high-resolution model is preserved without a triangle-count cap; it stays within 8 material-role meshes.
- Preserve the pre-existing `js/world/lamps.js` working-tree edit.

## User correction

The primary Mini keeps its original round trip: Mini → London → Glasgow → London → Mini. The São Paulo bus is secondary traffic; one London bus coming from the UK changes to the São Paulo model at the same spatial `swapAt(stops)` boundary. Never replace the primary Mini with São Paulo.
