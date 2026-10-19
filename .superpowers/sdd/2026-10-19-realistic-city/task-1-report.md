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

## Follow-up: keep the pilot in one bounded block

A review found the original Eye-to-countryside search could pick kinds from separate city areas. Selection now only considers existing eligible buildings inside the London pilot block bounds (Eye + 10 to Eye + 80 on X, and -100 to 65 on Z), still taking at most one of each kind and leaving the draw and occupancy paths unchanged. The placement test now asserts the three descriptors remain within the bounded block dimensions.

Exact rerun:

```text
node --test tests/real-city.test.mjs tests/glasgow-clearance.test.mjs tests/scenery-fill.test.mjs
ℹ tests 13
ℹ pass 13
ℹ fail 0
```

`git diff --check` passed.

## Follow-up: map plot kinds from the PRE source kind

The descriptor had used `b[7]`, which is the width multiplier, instead of `b[6]`, which stores the PRE architectural kind. A new source-form assertion first failed with the terrace footprint labeled `midrise`. The implementation now maps `b[6] === 3` to terrace, `b[6] === 1` to office, and the remaining source kinds to midrise. Tests assert the resulting route's expected `(width, depth, height)` signature for each architecture.

Focused verification:

```text
node --test tests/real-city.test.mjs tests/glasgow-clearance.test.mjs tests/scenery-fill.test.mjs
ℹ tests 14
ℹ pass 14
ℹ fail 0
```

Full verification:

```text
node --test tests/
ℹ tests 93
ℹ pass 93
ℹ fail 0
```

`git diff --check` passed.
