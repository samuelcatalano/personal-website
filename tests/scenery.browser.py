# browser-harness < tests/scenery.browser.py (local preview with WebGL)
assert page_info()['url'].startswith(('http://localhost:', 'http://127.0.0.1:'))
print(js("""(async () => {
  const T = await import('three');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve, regions } = await import('./js/world/layout.js');
  const { buildCity } = await import('./js/world/city.js');
  const { buildLandmarks } = await import('./js/world/landmarks.js');
  const { buildBackdrop } = await import('./js/world/backdrop.js?qa=' + Date.now());
  const { shotFor, SECTION_SHOT } = await import('./js/world/camera.js');
  const { PALETTE: P } = await import('./js/world/palette.js');
  const pts = routePoints(stops.length), curve = routeCurve(T, pts), city = [], landmarks = [], distant = [], rgs = regions(stops, pts);
  const collect = out => (x,y,z,w,h,d,color) => out.push({x,y,z,w,h,d,color});
  buildCity(collect(city), stops, pts, curve);
  buildLandmarks(collect(landmarks), stops, pts);
  buildBackdrop(collect(distant), stops, pts);
  for (const { ctry: [x0, x1] } of rgs) {
    const country = city.filter(b => b.x >= x0 && b.x < x1), buildings = country.filter(b => b.y === 0 && b.h >= 5 && b.w >= 6);
    if (buildings.length < 25) throw Error('Country region lacks urban buildings '+x0+'–'+x1);
    if (country.some(b => [P.field, P.field2, P.hill].includes(b.color))) throw Error('Rural field or hill ground remains in country region '+x0+'–'+x1);
    if (country.some(b => b.h >= 20 && b.w < 3 && b.d < 3)) throw Error('Tall turbine-like structure remains in country region '+x0+'–'+x1);
  }
  const rear = city.filter(b => b.z === -108 && b.y === 0 && b.h >= 3);
  const side = city.filter(b => b.y === 0 && b.h >= 3 && b.w >= 5 && (b.x <= pts[0].x - 90 && b.z >= -99 || b.x === pts[0].x - 13 && b.z === -3));
  const greens = [P.field, P.field2, P.hill];
  const bodies = distant.filter(b => b.y === 0 && !greens.includes(b.color));
  const nearWalls = bodies.filter(b => b.z > -150);
  const tiers = distant.filter(b => b.h === 0.28 && nearWalls.some(w =>
    b.x === w.x && b.z === w.z && b.y === w.h + 1.1 &&
    Math.abs(b.w - w.w * 0.38) < 1e-9 && Math.abs(b.d - w.d * 0.45) < 1e-9));
  if (!tiers.length) throw Error('No new backdrop roof tier');
  const minLandmarkZ = Math.min(...landmarks.map(b => b.z - b.d/2));
  // Sé is the westernmost named landmark; Paulista's generic skyline is decoration.
  const seX = pts[stops.findIndex(s => s.id === 'puc')].x;
  const cathedral = landmarks.filter(b => Math.abs(b.x-seX) <= 16 && b.z >= -74 && b.z <= -50);
  const minViewX = Math.min(...cathedral.map(b => b.x - b.w/2), ...pts.flatMap((p,i) => [false,true].map(mobile => shotFor(SECTION_SHOT[stops[i].section], {...p,y:0}, {mobile}).position[0])));
  for (const mobile of [false, true]) {
    const viewX = Math.min(...cathedral.map(c => c.x - c.w/2), ...pts.map((p,i) => shotFor(SECTION_SHOT[stops[i].section], {...p,y:0}, {mobile}).position[0]));
    for (const b of tiers) if (b.z + b.d/2 >= minLandmarkZ && b.x + b.w/2 >= viewX) throw Error('Backdrop roof tier enters landmark view '+JSON.stringify({mobile,b,viewX,minLandmarkZ}));
  }
  for (const b of [...distant.filter(b => b.y >= 0), ...rear, ...side]) {
    if (b.z + b.d/2 >= minLandmarkZ && b.x + b.w/2 >= minViewX) throw Error('New scenery enters landmark foreground '+JSON.stringify({b,minViewX,minLandmarkZ}));
  }
  const added = new Set([...rear, ...side]);
  const existing = city.filter(b => b.y === 0 && b.w >= 5 && b.h >= 3 && !added.has(b));
  const overlap = (a,b) => Math.abs(a.x-b.x)<(a.w+b.w)/2 && Math.abs(a.z-b.z)<(a.d+b.d)/2;
  for (const b of [...bodies, ...rear, ...side]) {
    if (existing.some(o => overlap(b,o))) throw Error('New building overlaps existing scenery at '+b.x+','+b.z);
    if (landmarks.some(o => o.h > 1 && overlap(b,o))) throw Error('New building overlaps landmark');
  }
  const gl = document.querySelector('#world').getContext('webgl2');
  if (!gl || gl.isContextLost()) throw Error('WebGL is unavailable');
  return { pass:true, rearBuildings:rear.length, sideBuildings:side.length, distantBuildings:bodies.length, backdropBoxes:distant.length, minLandmarkZ, errors:window.__errors ?? [] };
})()"""))
