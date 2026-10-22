"""Reference-vs-model comparison sheets and silhouette overlays (Pillow only).
python3 compare_views.py <iterdir> <refdir> [views,comma]   (refdir holds ref-<view>.png; iterdir holds <view>.png + <view>_bg.png)
Writes <iterdir>/sheet_<view>.png and <iterdir>/overlay_<view>.png
"""
import sys, os
from PIL import Image, ImageChops, ImageFilter, ImageDraw, ImageFont

# hero crop has a street background: silhouette traced by hand (550x410 px crop coordinates)
HERO_POLY = [(108,93),(150,72),(200,56),(235,56),(290,80),(345,116),(350,122),(385,145),(400,150),(405,180),(430,200),(458,222),(478,242),(485,262),(484,290),(482,312),(470,322),(440,334),(400,346),(360,356),(330,362),(300,364),(275,356),(262,335),(255,318),(225,300),(190,282),(150,262),(128,258),(115,268),(95,268),(75,272),(58,262),(52,235),(48,205),(48,185),(55,160),(65,140),(75,128),(95,108)]

def ref_mask(im, thr=30, view=None):
    if view == 'hero':
        m = Image.new('L', im.size, 0); ImageDraw.Draw(m).polygon(HERO_POLY, fill=255); return m
    im = im.convert('RGB'); w, h = im.size
    px = im.load(); border = [px[x, y] for x in range(w) for y in (0, 1, h - 2, h - 1)] + [px[x, y] for y in range(h) for x in (0, 1, w - 2, w - 1)]
    bg = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))
    d = ImageChops.difference(im, Image.new('RGB', im.size, bg)).convert('L').filter(ImageFilter.GaussianBlur(.8))
    m = d.point(lambda v: 255 if v > thr else 0)
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))           # close gaps
    # fill holes: flood the background from the corner, invert
    f = m.copy(); ImageDraw.floodfill(f, (0, 0), 128)
    m = f.point(lambda v: 0 if v == 128 else 255)
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    # keep largest component
    mp = m.load(); seen = set(); best = []
    for y in range(h):
        for x in range(w):
            if mp[x, y] and (x, y) not in seen:
                comp = [(x, y)]; seen.add((x, y)); i = 0
                while i < len(comp):
                    cx, cy = comp[i]; i += 1
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and mp[nx, ny] and (nx, ny) not in seen:
                            seen.add((nx, ny)); comp.append((nx, ny))
                if len(comp) > len(best): best = comp
    out = Image.new('L', (w, h), 0); op = out.load()
    for x, y in best: op[x, y] = 255
    for x in range(w):   # dark glass reads as background: car silhouettes are vertically convex, so fill each column
        ys = [y for y in range(h) if op[x, y]]
        if ys:
            for y in range(min(ys), max(ys) + 1): op[x, y] = 255
    return out

def norm_to(mask, H=600):
    bb = mask.getbbox(); crop = mask.crop(bb); s = H / crop.height
    return crop.resize((max(1, round(crop.width * s)), H), Image.LANCZOS), bb

def overlay(refm, modm, H=600, pad=40):
    r, _ = norm_to(refm, H); m, _ = norm_to(modm, H)
    W = max(r.width, m.width) + 2 * pad; cv = Image.new('RGBA', (W, H + 2 * pad), (20, 22, 26, 255))
    def tint(mk, col, edge):
        a = mk.point(lambda v: 128 if v > 127 else 0)
        fill = Image.new('RGBA', mk.size, col + (0,)); fill.putalpha(a)
        e = ImageChops.subtract(mk.filter(ImageFilter.MaxFilter(3)), mk.filter(ImageFilter.MinFilter(3))).point(lambda v: 200 if v > 60 else 0)
        eg = Image.new('RGBA', mk.size, edge + (0,)); eg.putalpha(e); fill.alpha_composite(eg); return fill
    for mk, col in ((r, (255, 40, 40)), (m, (0, 220, 255))):
        t = tint(mk, col, col); x = (W - mk.width) // 2; cv.alpha_composite(t, (x, pad))
    return cv

def label(im, text):
    d = ImageDraw.Draw(im); d.rectangle((0, 0, 8 + 7 * len(text), 16), fill=(0, 0, 0)); d.text((4, 2), text, fill=(255, 255, 255)); return im

def main():
    it, refd = sys.argv[1], sys.argv[2]
    views = sys.argv[3].split(',') if len(sys.argv) > 3 else ['front_right', 'right', 'rear_right', 'hero']
    for v in views:
        rp = os.path.join(refd, 'ref-%s.png' % v)
        if not os.path.exists(rp) or not os.path.exists(os.path.join(it, v + '.png')): continue
        ref = Image.open(rp).convert('RGB'); mod = Image.open(os.path.join(it, v + '_bg.png')).convert('RGB')
        alpha = Image.open(os.path.join(it, v + '.png')).split()[-1]
        refm = ref_mask(ref, view=v)
        H = 560
        rs = ref.resize((round(ref.width * H / ref.height), H), Image.LANCZOS)
        ms = mod.resize((round(mod.width * H / mod.height), H), Image.LANCZOS)
        sheet = Image.new('RGB', (rs.width + ms.width + 12, H + 20), (14, 14, 16))
        sheet.paste(rs, (0, 20)); sheet.paste(ms, (rs.width + 12, 20))
        label(sheet, 'REFERENCE %s' % v); ImageDraw.Draw(sheet).text((rs.width + 16, 4), 'MODEL %s' % v, fill=(255, 255, 255))
        sheet.save(os.path.join(it, 'sheet_%s.png' % v))
        ov = overlay(refm, alpha.point(lambda a: 255 if a > 40 else 0)); ov.save(os.path.join(it, 'overlay_%s.png' % v))
        refm.save(os.path.join(it, 'refmask_%s.png' % v))
        print('ok', v)
main()
