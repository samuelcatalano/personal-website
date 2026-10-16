// Usage: node tools/model-credits.mjs <uid>... → prints a CREDITS object literal for js/world/models.js
const out = {};
for (const uid of process.argv.slice(2)) {
  const m = await (await fetch(`https://api.sketchfab.com/v3/models/${uid}`)).json();
  let license = m.license?.label ?? 'unknown';
  if (/CC0/i.test(m.description ?? '') && license === 'CC Attribution') license = 'CC0 (author declared)';
  out[uid] = { title: m.name, author: m.user?.displayName ?? m.user?.username, license, url: m.viewerUrl ?? `https://sketchfab.com/3d-models/model-${uid}` };
}
console.log(`const CREDITS = ${JSON.stringify(out, null, 2)};`);
