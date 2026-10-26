# Urban horizon validation

Before/after captures use the existing normal cameras at hero (index 0) and Glasgow (index 11), at 1440×900 CSS px, DPR 1.5. Each image is a direct browser capture; the app panel and route camera are unchanged. Glasgow-after was refreshed from the final live preview after the country clearance correction.

`metrics.json` records fixed-tier Glasgow samples: desktop 1440×900/DPR 1.5/high and mobile 375×812/DPR 1/medium, with a 2 s warmup and 10 s measured interval. Chrome 156 ran on an Apple M3 Max using ANGLE Metal. `renderer.info` totals count scene submissions inside each post-processing render; high-tier passes can submit geometry more than once. These measurements characterize this machine and camera, not mobile hardware performance.

Visual review: the London and Glasgow landmarks, Glasgow river, and Wembley arch remained visible in the matching full-scene captures. No foreground building blocked the Glasgow focal landmarks. The candidate adds dense urban mass behind them; no farms or turbines appear in the Glasgow view.

The first candidate had one z-fighting pair where new Glasgow exit homes overlapped country leg1 B/B2. Narrowing that country leg start to `a+24m` cleared the guard; saved HEAD baseline and final candidate both pass. The final scenery, citywide, z-fighting and targeted Node checks pass. This records targeted validation only, not a full regression suite.
