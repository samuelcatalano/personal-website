# Regional fleet validation evidence

Headed Chrome156; same-origin snapshots; one visible tab; fixed tier; normal existing traffic; 2s warmup +10s sample. Full-pipeline renderer counters, not only the last postprocess pass.

| Pose | Frame interval median/p95 (ms), before → after | Calls median/p95 | Triangles median/p95 |
|---|---|---|---|
|1440×900 DPR1.5 high, document scroll.38|13.3/15.0 →13.3/14.9|723/727 →722/725|5,869,242/5,871,554 →5,932,250/5,950,882|
|375×812 DPR1 medium, document scroll.12|13.3/14.2 →13.3/14.3|198/204 →200/206|2,362,913/2,365,757 →2,363,041/2,401,315|

Desktop750frames each,9.991s; geometry479→486, textures44→44, materials122→127. Endpoint frustum probe found one Fiesta/six mesh bounds. Mobile751/750frames,10.004/9.991s; geometry206→207, textures29→29, materials122→126. Actual mesh `onBeforeRender` recorded Onix in305/750 mobile frames (40.7%).

[Desktop before](final/baseline-desktop.json) / [after](final/after-desktop.json); [mobile before](final/baseline-mobile-valid.json) / [after](final/after-mobile-valid.json). Valid mobile raw samples include actual per-frame submissions. [Normal mobile Onix](final/mobile-onix-normal.png) / [capture state](final/mobile-capture-state.json). [Final regional contact sheet](final/regional-scenes-contact.png) / [verified identities and themes](final/bounded-scene-states.json). [Task2 Mini evidence](../task-2/) has matched hero day/night detail.

No material cadence regression observed in these poses; 0.1ms differences are scheduling noise, not an established speedup. RAF intervals are browser cadence, not calibrated CPU/GPU duration or physical-device measurements. Desktop has endpoint frustum evidence only. Fleet passage covers part of the mobile window. No citywide worst-case/all-ten simultaneous claim: nine catalog models populate existing slots; Fiorino is contract-tested only.

[Focused browser PASS outputs](final/focused-tests.txt): vehicles20traffic/4500frames/one bounded safety correction; regional10models/9slots; deliberately blocked-GLB fallback3Minis. Protected A330/bus/cab SHA256 and `git diff --check` pass. Current AFTER audit has zero JS errors, unhandled rejections, console.error or HTTP failures. Baseline fixture has one apple-touch-icon404.

Rejected older metrics/captures were moved outside the repo: mobile.30 had no fleet submissions, first.12 baseline became hidden. Use the `*-mobile-valid.json` files. Final normal regional PNGs use `fromSurface:true` without clip and have no external white padding. No full regression, Lighthouse or full product matrix run.
