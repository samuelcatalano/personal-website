# Pedestrians on the plazas, and none vanish on return

Owner feedback: the red plaza areas at MASP (stop 5) and George Square (stop 11) were empty or nearly empty, and NPCs vanished when leaving a stop and coming back. Checks run at desktop 1728 x 963 in browser-harness, day theme, default weather roll for the captures and `weather=clear` for the counts.

## Causes (measured)

- Desktop runs the 3D NPC pool (`npc3d.js`: 56 walkers, 160 m cap, nearest first, frustum release). It also hid the whole sprite crowd (`hideSprites`). Measured at stops 5 and 11: `crowd.visible = false`, 56 of 1000 walkers drawn.
- A walker that passed 160 m or left the frustum was released with no sprite fallback, so the crowd vanished as the camera moved on. Lane walkers near the camera took the 56 slots, so the far plazas stayed empty.
- The plaza interiors had no walkers. Plaza loops and strips walk only their edges: the MASP loop (x -153..-117, z -54..-22) had only its perimeter, and George Square gravel had only the cross and axis strips.
- The sprite cut at 900 m sat inside the fog. `sky.js` sets fog far to 820 m x fogK, which is 1025 to 1066 m in the São Paulo and London moods, so sprites ended at a visible edge.

## Changes

- `js/world/crowd.js`: 12 plaza cells (rect loops 5 to 7 m by 4 to 5 m), 6 on the MASP plaza interior and 6 on George Square gravel. Positions come from an obstacle search over the `parks.js` boxes, the square lots, the grass beds, tree trunks and the statue plinth, with 1 m clearance. The cells weight 1 in the overflow, so N stays 1000. Other shares shrink: London about 31, dense strips about 23.
- `js/world/npc3d.js`: sprites are no longer hidden as a whole. After `people.update` each frame, a 3D walker hides only its own sprite, and a walker that leaves the pool is drawn as a sprite at once.
- `js/world/people.js`: `VIEW_FAR` 900 to 1100 m, past the 1066 m fog far. Unchanged: `createPeople` signature, `crowd.userData.route` and `walkPace`, seed 1017, kiosk avoidance, reduced motion.

## Numbers

| | before | after |
|---|---|---|
| drawn walkers, stop 5 / stop 11 | 56 / 56 | 980 / 979 |
| MASP plaza interior drawn, stop 5 | 0 | 65 (42 in the 6 new cells) |
| George Square drawn, stop 11 (includes the existing cross and axis strips) | 0 | 90 (42 in the 6 new cells) |
| planned walkers per plaza cell set | none | 42 MASP / 42 George |
| steady walkers 10 to 300 m in front, stop 5 | 56 | 374 |
| still drawn one stop on (stop 6) | 75 % | 100 % |
| still drawn at a far stop (stop 11) | 0 % | 100 % |
| back at stop 5 after 3 s | 56 (steady 56) | 376 / 378 (steady 374) |

Right after a jump back (0.2 s) the camera is still moving on its spring, so the in-front count reads 292 to 305 at that moment. The settled counts are the check.

## Histograms (drawn walkers per 4 m cell; `#` = 10 or more; north at top)

MASP plaza, x -165 to -105, z -60 to -14, stop 5, before:

```
   -16 ........1..1...
   -20 ........1.1133.
   -24 .............1.
   -28 .............2.
   -32 ............2..
   -36 ...............
   -40 ...............
   -44 ...............
   -48 ...............
   -52 ...............
   -56 ...............
   -60 ...............
```

MASP plaza, same window, stop 5, after:

```
   -16 ...2...12.1..1.
   -20 ..1232..141121.
   -24 .21..311.2.122.
   -28 .11232....2411.
   -32 .24.......1224.
   -36 .211........21.
   -40 ...1..16.......
   -44 .12........212.
   -48 .2433.31....23.
   -52 ...21.12.421.1.
   -56 ....2..2..3....
   -60 ...............
```

George Square, x 405 to 465, z -32 to 2, stop 11, before:

```
     0 ...............
    -4 .....11..11..1.
    -8 ...............
   -12 ...............
   -16 ...............
   -20 .1.............
   -24 ...............
   -28 ...............
   -32 ...............
```

George Square, same window, stop 11, after:

```
     0 ...............
    -4 .4.3421241.173.
    -8 .3..........2..
   -12 .6....211...21.
   -16 .212324766.714.
   -20 .3122319113141.
   -24 .6...34#2...22.
   -28 .......3.....1.
   -32 ...............
```

## Captures

`before/5-day.jpg`, `before/11-day.jpg` (old code) and `after/5-day.jpg`, `after/11-day.jpg` (new code): stop 5 (MASP) and stop 11 (George Square), day, default weather roll, 1728 px wide.

## Tests

- `node --test tests/`: 153 of 153 pass. New: plaza cell counts of 25 to 60 per plaza, cell clearance from beds, trunks, the plinth and the lots, and sprites drawn out to 1000 m. Updated for the new design: wander count 29, overflow shares, the NPC pack keeps its sprites drawn, and the frozen-crowd camera at 1200 m.
- `tests/people-return.browser.py`: FAIL before (75 % and 0 % kept), PASS after (100 % and 100 % kept; return 376 and 378 against 374 steady).
- `tests/people-arrival.browser.py`: PASS after (route start 979; MASP 978 at 0.1 s and at 3 s).
- `tests/final-art.browser.py`: PASS after (12 trees, 8 shrubs, 4 batches).
- `tests/people.browser.py`: stops at "feet must follow paving height", which failed before this change too (see `pedestrians-always-present/NOTES.md`); later checks were not reached.

## Not measured or open

- Desktop GPU cost of drawing the sprite crowd again (1000 instances, previously hidden) and the mobile cost. CPU per `update` is unchanged (same N and loops). Not measured against the +0.5 ms budget.
- Standing people were not added; every walker keeps moving.
- The owner's outline coordinates are not in the repo. The plaza areas used are the MASP plaza interior (with the existing front strip) and George Square gravel. Please confirm them against the owner's screenshots.
- The Wellington plinth footprint is approximated as 6 by 4 m at roadZ - 20.
