// Postcard: the current 3D view with the bus-blind caption in amber LED dots, composed on a 2D canvas and downloaded as a PNG.
const W = 1600, H = 1000;
// Draw `text` as an amber dot matrix: rasterise it on a scratch canvas, then place one dot per `pitch` pixels where the glyphs are lit.
export function ledText(ctx, text, x, y, size, pitch = 7) {
  const s = document.createElement('canvas').getContext('2d');
  s.font = `800 ${size}px Inter, system-ui, sans-serif`;
  const w = Math.ceil(s.measureText(text).width) + 4, h = Math.ceil(size * 1.25);
  s.canvas.width = w; s.canvas.height = h;
  s.font = `800 ${size}px Inter, system-ui, sans-serif`; s.textBaseline = 'alphabetic'; s.fillStyle = '#fff'; s.fillText(text, 2, size);
  const px = s.getImageData(0, 0, w, h).data;
  ctx.fillStyle = '#ffb21e'; ctx.shadowColor = 'rgba(255,170,0,.55)'; ctx.shadowBlur = 8;
  for (let j = pitch / 2; j < h; j += pitch) for (let i = pitch / 2; i < w; i += pitch) {
    if (px[((Math.floor(j) * w) + Math.floor(i)) * 4 + 3] > 110) { ctx.beginPath(); ctx.arc(x + i, y + j - size, pitch * 0.34, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.shadowBlur = 0;
  return w;
}
export async function makePostcard(blob, caption, url) {
  const img = await createImageBitmap(blob), c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d'), k = Math.max(W / img.width, H / img.height);
  ctx.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k); // cover-crop
  const g = ctx.createLinearGradient(0, H - 340, 0, H); g.addColorStop(0, 'rgba(12,10,8,0)'); g.addColorStop(1, 'rgba(12,10,8,.75)');
  ctx.fillStyle = g; ctx.fillRect(0, H - 340, W, 340);
  const bx = 70, by = H - 230, bw = W - 140, bh = 140; // the blind
  ctx.fillStyle = '#080605'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 22); ctx.fill();
  ctx.strokeStyle = '#2c2620'; ctx.lineWidth = 2; ctx.stroke();
  ledText(ctx, caption, bx + 48, by + 98, 72);
  ctx.fillStyle = 'rgba(244,240,233,.85)'; ctx.font = '500 26px Inter, system-ui, sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(url, W - 70, H - 36);
  ctx.textAlign = 'left'; ctx.font = '400 30px "Hammersmith One", Inter, sans-serif'; ctx.fillText('Samuel Catalano', 70, H - 36);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}
export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
