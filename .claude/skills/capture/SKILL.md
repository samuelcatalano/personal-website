---
name: capture
description: Capture standard screenshots of the 3D city (any stop, day/night, desktop or 375px mobile, optional weather override) and a comparison grid. Use for any visual check, before/after comparison, or when the user asks to see the scene.
argument-hint: "[stops like 5:day,11:night] [mobile] [weather=rain|clear]"
---

# Capture

Screenshots come from `tools/capture.py`, run through `browser-harness` against the local server.

1. Make sure the server is up: `curl -s -o /dev/null -w "%{http_code}" localhost:8000/` must print 200. If not, start `python3 -m http.server 8000` in the background (never twice).
2. Pick shots. Stop ids (`js/content.js`): 0 hero, 5 São Paulo (MASP/Estaiada), 9 xdesign / 9.5 London (Big Ben, Eye), 10 olm, 11 Glasgow, 17 contact. Fractional stops sit between stops. Standard set: `5:day,9.5:day,11:day,11:night,5:night`.
3. Run, writing into the session scratchpad (never into the repo unless the user wants committed evidence in `docs/audits/captures/`):

```bash
OUT=<scratchpad>/cap SHOTS="5:day,11:night" GRID=1 browser-harness < tools/capture.py
OUT=<scratchpad>/cap SHOTS="9.5:day" MOBILE=1 browser-harness < tools/capture.py
OUT=<scratchpad>/cap SHOTS="5:day" QUERY="weather=rain" browser-harness < tools/capture.py
```

Env: `OUT` (required), `SHOTS`, `MOBILE=1`, `WAIT` (default 7 s), `GRID=1`, `QUERY`, `URL`. Files are `<stop>-<theme>[-m].png`, plus `grid.png`.

4. Look at the result before claiming anything. Full captures are 3456 px wide: downscale or crop (PIL from the browser-harness Python: `~/.local/share/uv/tools/browser-harness/bin/python3`) before reading. For before/after, capture the same shots both times and paste them side by side.
5. Send the image the user should see with SendUserFile.

Notes: the UI panel is hidden in captures. The tab is activated on purpose (background tabs do not render). Weather is random per visit unless `QUERY=weather=...` is set, so compare like with like.
