# Task 1 report: pilot plot reservation

## Result

`buildBlocks` now accepts an optional sixth callback and reserves up to one existing footprint per kind (`terrace`, `midrise`, `office`) in the generic London stretch between the Eye and countryside. Plot descriptors include stable IDs, kind, center, footprint, and actual generated height. `buildCity` forwards an optional final callback.

Reserved buildings still execute the existing draw routines with a no-op renderer, so their RNG consumption and occupancy reservations remain intact. All other building placement and rendering paths are unchanged.

## Red/green evidence

Before implementation, `node --test tests/real-city.test.mjs` failed because no pilot plot descriptors were provided (empty set instead of the three expected kinds). The initial test setup also exposed an incorrect test stop-name reference; it was corrected to use the actual stop IDs before green verification.

After implementation, the focused tests pass:

```text
node --test tests/real-city.test.mjs tests/glasgow-clearance.test.mjs tests/scenery-fill.test.mjs
13 tests, 13 pass, 0 fail
```

Full test suite:

```text
node --test tests/
92 tests, 92 pass, 0 fail
```

`git diff --check` passed. Node emitted the repository's existing `MODULE_TYPELESS_PACKAGE_JSON` warnings for ES modules; they did not affect test results.
