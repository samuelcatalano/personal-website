"""Reproject turnaround reference views into the reference NPC's albedo, only where the photos never saw.

python3 tools/npc/reproject_views.py posed-dir views-dir out-dir
posed-dir: export_posed_uv.py output. views-dir: <name>.png + <name>_mask.png per view.
The front and back of the body come from real photos and the face is the owner-approved head: both stay.
Sides of the body and the sides/back/top of the head take the views, colour-matched to the existing texture.
A last pass lays the real front photo over the shirt front and collar (clean print, clean neckline).
"""
import json
import math
from pathlib import Path
import sys

import numpy as np
from PIL import Image

BODY_VIEWS = {'corpo_02_frontal_3-4_direita_45graus': 45, 'corpo_03_perfil_direito_90graus': 90,
              'corpo_04_traseira_3-4_direita_135graus': 135, 'corpo_06_traseira_3-4_esquerda_225graus': 225,
              'corpo_07_perfil_esquerdo_270graus': 270, 'corpo_08_frontal_3-4_esquerda_315graus': 315}
HEAD_VIEWS = {'rosto_02_3-4_direita': 45, 'rosto_03_perfil_direito': 90, 'rosto_04_traseira': 180,
              'rosto_05_perfil_esquerdo': 270, 'rosto_06_3-4_esquerda': 315}
FRONT = np.array([0, -1, 0], np.float32)  # Blender space: the character faces -Y, Z up.


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def camera(degrees, sign):
    """Unit vector from the subject toward the camera; 'right' (character's right) views sit on -X."""
    t = math.radians(degrees) * sign
    c = np.array([math.sin(t), -math.cos(t), 0], np.float32)
    return c, np.array([-c[1], c[0], 0], np.float32)  # c, image-right


def raster(tris2d, depth, shape):
    """Z-buffer (nearest = largest depth) and coverage of screen-space triangles."""
    h, w = shape
    zbuf = np.full(shape, -np.inf, np.float32)
    for (a, b, c), (da, db, dc) in zip(tris2d, depth):
        x0, x1 = int(max(min(a[0], b[0], c[0]), 0)), int(min(max(a[0], b[0], c[0]) + 1, w - 1))
        y0, y1 = int(max(min(a[1], b[1], c[1]), 0)), int(min(max(a[1], b[1], c[1]) + 1, h - 1))
        if x1 < x0 or y1 < y0:
            continue
        det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(det) < 1e-9:
            continue
        ys, xs = np.mgrid[y0:y1 + 1, x0:x1 + 1] + .5
        l0 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / det
        l1 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / det
        l2 = 1 - l0 - l1
        inside = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
        z = l0 * da + l1 * db + l2 * dc
        view = zbuf[y0:y1 + 1, x0:x1 + 1]
        np.copyto(view, np.where(inside & (z > view), z, view))
    return zbuf


def uv_texels(mesh, size):
    """Every atlas texel a triangle covers: its pixel, posed position and normal."""
    co, nor, tris, uv = mesh['co'], mesh['normal'], mesh['tris'], mesh['uv']
    pix, pos, nrm = [], [], []
    for t, tri in enumerate(tris):
        p = uv[t] * [size, size]
        p[:, 1] = size - p[:, 1]
        x0, x1 = int(max(p[:, 0].min(), 0)), int(min(p[:, 0].max() + 1, size - 1))
        y0, y1 = int(max(p[:, 1].min(), 0)), int(min(p[:, 1].max() + 1, size - 1))
        a, b, c = p
        det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(det) < 1e-9:
            continue
        ys, xs = np.mgrid[y0:y1 + 1, x0:x1 + 1] + .5
        l0 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / det
        l1 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / det
        l2 = 1 - l0 - l1
        inside = (l0 >= -1e-3) & (l1 >= -1e-3) & (l2 >= -1e-3)
        if not inside.any():
            continue
        lam = np.stack([l0[inside], l1[inside], l2[inside]], 1)
        pix.append(np.stack([ys[inside], xs[inside]], 1).astype(np.int32))
        pos.append(lam @ co[tri])
        nrm.append(lam @ nor[tri])
    pix, pos, nrm = np.concatenate(pix), np.concatenate(pos), np.concatenate(nrm)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9
    _, first = np.unique(pix[:, 0] * size + pix[:, 1], return_index=True)  # shared seam texels: first owner wins
    return pix[first], pos[first], nrm[first]


def splat(xy, shape, reach=2):
    """Cheap silhouette for fitting: dense surface points, dilated to close the gaps between them."""
    cover = np.zeros(shape, bool)
    x, y = xy[:, 0].astype(int), xy[:, 1].astype(int)
    keep = (x >= 0) & (x < shape[1]) & (y >= 0) & (y < shape[0])
    cover[y[keep], x[keep]] = True
    for _ in range(reach):
        cover[1:] |= cover[:-1]; cover[:-1] |= cover[1:]; cover[:, 1:] |= cover[:, :-1]; cover[:, :-1] |= cover[:, 1:]
    return cover


def fit(view_mask, co, tris, degrees, head):
    """Ortho camera (sign, scale, centre) whose mesh silhouette best overlaps the view's mask."""
    h, w = view_mask.shape
    target = view_mask > .5
    rows = np.flatnonzero(target.any(1))
    best = None
    for sign in (1, -1):
        c, right = camera(degrees, sign)
        u, v = co @ right, co[:, 2]
        if head:  # Face views: hair top to the widest part of the head sets the scale.
            band = target[rows[0]:rows[0] + int(.6 * (h - rows[0]))]
            cols = np.flatnonzero(band.any(0))
            top = co[:, 2] > np.percentile(co[:, 2], 90)
            scale0 = (cols[-1] - cols[0]) / (u[top].max() - u[top].min())
        else:
            scale0 = (rows[-1] - rows[0]) / (v.max() - v.min())
        cols = np.flatnonzero(target.any(0))
        for ds in (.94, .97, 1, 1.03, 1.06):
            s = scale0 * ds
            for dx in np.linspace(-.04, .04, 5) * w:
                for dy in np.linspace(-.03, .03, 3) * h:
                    cx = (cols[0] + cols[-1]) / 2 - s * (u.min() + u.max()) / 2 + dx if not head else \
                        (cols[0] + cols[-1]) / 2 - s * (u[top].min() + u[top].max()) / 2 + dx
                    cy = rows[0] + s * v.max() + dy
                    xy = np.stack([cx + s * u, cy - s * v], 1)
                    cover = splat(np.concatenate([xy, xy[tris].mean(1)]), (h, w))
                    iou = (cover & target).sum() / max((cover | target).sum(), 1)
                    if best is None or iou > best[0]:
                        best = (iou, sign, s, cx, cy)
    return best


def sample(image, xy):
    """Bilinear lookup of float RGB at pixel coordinates."""
    h, w = image.shape[:2]
    x, y = np.clip(xy[:, 0] - .5, 0, w - 1.001), np.clip(xy[:, 1] - .5, 0, h - 1.001)
    x0, y0 = x.astype(int), y.astype(int)
    fx, fy = (x - x0)[:, None], (y - y0)[:, None]
    return (image[y0, x0] * (1 - fx) * (1 - fy) + image[y0, x0 + 1] * fx * (1 - fy)
            + image[y0 + 1, x0] * (1 - fx) * fy + image[y0 + 1, x0 + 1] * fx * fy)


def erode(mask, steps):
    m = mask.copy()
    for _ in range(steps):
        m[1:] = np.minimum(m[1:], m[:-1]); m[:-1] = np.minimum(m[:-1], m[1:])
        m[:, 1:] = np.minimum(m[:, 1:], m[:, :-1]); m[:, :-1] = np.minimum(m[:, :-1], m[:, 1:])
    return m


def pad_islands(image, pix, steps=8):
    """Bleed island colours into the atlas gutters: filtering reads them, and stale gutters show as seam lines."""
    filled = np.zeros(image.shape[:2], bool); filled[pix[:, 0], pix[:, 1]] = True
    image = image.copy()
    for _ in range(steps):
        total, count = np.zeros_like(image), np.zeros(image.shape[:2], np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            src = np.roll(np.roll(filled, dy, 0), dx, 1)
            total += np.roll(np.roll(image * filled[..., None], dy, 0), dx, 1); count += src
        grow = ~filled & (count > 0)
        image[grow] = total[grow] / count[grow, None]; filled |= grow
    return image


def smooth_tone(pos, colour, valid, size=.02):
    """Broad colour around each texel: means over 2 cm voxels, two grids half a voxel apart to hide their seams."""
    result = np.zeros_like(colour)
    for shift in (0, size / 2):
        keys = np.floor((pos + shift) / size).astype(np.int64)
        _, cell = np.unique(keys, axis=0, return_inverse=True)
        cell = cell.ravel()
        total = np.zeros((cell.max() + 1, 3)); count = np.zeros(cell.max() + 1)
        np.add.at(total, cell[valid], colour[valid]); np.add.at(count, cell[valid], 1)
        mean = total / np.maximum(count, 1)[:, None]
        fallback = count[cell] == 0
        part = mean[cell]; part[fallback] = colour[fallback]
        result += part / 2
    return result


def luminance(rgb):
    return rgb @ np.array([.2126, .7152, .0722], np.float32)


def reproject(name, posed, views_dir, out, views, report, source=None, front=False):
    mesh = dict(np.load(posed / f'{name}.npz'))
    albedo = np.asarray(Image.open(source or posed / f'{name}_albedo.png').convert('RGB'), np.float32) / 255
    size = albedo.shape[0]
    pix, pos, nrm = uv_texels(mesh, size)
    original = albedo[pix[:, 0], pix[:, 1]]
    facing = nrm @ FRONT
    head = name == 'Head'
    # Head: everything but the approved face. Body: the sides; front and back are real photos.
    gate = 1 - smoothstep(.3, .6, facing) if head else 1 - smoothstep(.5, .8, np.abs(facing))
    if front:  # Shirt front and collar from the real photo: repairs the print's dark specks and the ragged collar.
        z, x = pos[:, 2], np.abs(pos[:, 0])
        # Stops 4 cm under the neckline (head mesh bottom ~1.45 m): the photo's neck skin must not land on the shirt.
        gate = smoothstep(.45, .7, facing) * smoothstep(.98, 1.04, z) * (1 - smoothstep(1.38, 1.41, z)) * (1 - smoothstep(.26, .3, x))
    total, weight = np.zeros_like(original), np.zeros(len(pix), np.float32)
    co, tris = mesh['co'], mesh['tris']
    # Every silhouette shows hair and body together: fit and occlude against both meshes.
    other = dict(np.load(posed / ('Body.npz' if head else 'Head.npz')))
    co = np.concatenate([co, other['co']]); tris = np.concatenate([tris, other['tris'] + len(mesh['co'])])
    for view, degrees in views.items():
        image = np.asarray(Image.open(views_dir / f'{view}.png').convert('RGB'), np.float32) / 255
        mask = np.asarray(Image.open(views_dir / f'{view}_mask.png').convert('L'), np.float32) / 255
        iou, sign, s, cx, cy = fit(mask, co, tris, degrees, head)
        c, right = camera(degrees, sign)
        zbuf = raster(np.stack([cx + s * (co @ right), cy - s * co[:, 2]], 1)[tris], (co @ c)[tris], mask.shape)
        xy = np.stack([cx + s * (pos @ right), cy - s * pos[:, 2]], 1)
        inside = (xy[:, 0] >= 1) & (xy[:, 0] < mask.shape[1] - 1) & (xy[:, 1] >= 1) & (xy[:, 1] < mask.shape[0] - 1)
        xi, yi = np.clip(xy[:, 0].astype(int), 0, mask.shape[1] - 1), np.clip(xy[:, 1].astype(int), 0, mask.shape[0] - 1)
        visible = inside & (pos @ c >= zbuf[yi, xi] - .012)  # metres: within the nearest surface at that pixel
        colour = sample(image, xy)
        # Colour-match this view to the existing texture where both are trusted and the materials agree.
        w = np.clip(nrm @ c, 0, 1) ** 3 * visible * erode(mask, 2)[yi, xi]
        agree = w > .3
        agree &= np.abs(luminance(colour) - luminance(original)) < .12
        if agree.sum() > 500:
            mo, so = original[agree].mean(0), original[agree].std(0) + 1e-3
            mp, sp = colour[agree].mean(0), colour[agree].std(0) + 1e-3
            colour = np.clip((colour - mp) * np.clip(so / sp, .6, 1.6) + mo, 0, 1)
        # Never paint skin on cloth (or the reverse) where the view's pose and the mesh's differ.
        if not front:  # The photo is the truth on the shirt front, and the arms there match its pose.
            w *= 1 - smoothstep(.12, .25, np.abs(luminance(colour) - luminance(original)))
            warmth = lambda rgb: rgb[:, 0] - rgb[:, 2]  # skin is red over blue; black cloth and dark hair are not
            w *= 1 - smoothstep(.03, .07, np.abs(warmth(colour) - warmth(original)))
        total += colour * w[:, None]
        weight += w
        report.append({'mesh': name, 'view': view, 'iou': round(float(iou), 3), 'sign': sign, 'scale_px_per_m': round(float(s), 1),
                       'visible_texels': int(visible.sum()), 'matched_texels': int(agree.sum())})
        print(report[-1], flush=True)
    projected = total / np.maximum(weight, 1e-6)[:, None]
    if head:  # Views disagree on tone from angle to angle: keep the texture's broad tone, take only their strands.
        seen = weight > .02
        projected[seen] = (smooth_tone(pos, original, np.ones(len(pos), bool))
                           + projected - smooth_tone(pos, projected, seen))[seen]
    # The front pass replaces outright: any partial mix leaves the old, offset print as a ghost.
    alpha = gate * (weight > .02) if front else gate * weight / (weight + .15)
    if front:  # Neckline: the pale band between the head mesh and the shirt becomes shirt black.
        band = (pos[:, 2] > 1.37) & (pos[:, 2] < 1.47) & (np.abs(pos[:, 0]) < .2)
        shirt = np.median(original[band & (luminance(original) < .12)], axis=0)
        pale = band * smoothstep(.12, .2, luminance(original))
        projected[pale > 0] = shirt
        alpha = np.maximum(alpha, pale)
        # Specks blacker than the cloth itself (old print holes, folds the photo never saw) take the cloth colour.
        final = original * (1 - alpha[:, None]) + projected * alpha[:, None]
        cloth = (gate > .5) & (luminance(final) < .15)
        speck = (gate > .5) & (luminance(final) < .45 * np.median(luminance(final[cloth])))
        projected[speck], alpha[speck] = np.median(final[cloth], axis=0), 1
    result = albedo.copy()
    result[pix[:, 0], pix[:, 1]] = original * (1 - alpha[:, None]) + projected * alpha[:, None]
    result = pad_islands(result, pix)
    if front and (posed / f'{name}_normal.png').exists():  # The old print left bumps in the normal map: a sun-lit speck.
        from scipy.ndimage import median_filter
        normal = np.asarray(Image.open(posed / f'{name}_normal.png').convert('RGB'), np.float32) / 255
        median = median_filter(normal, size=(9, 9, 1))
        region = np.zeros(normal.shape[:2], bool); region[pix[gate > .3, 0], pix[gate > .3, 1]] = True
        bump = region & (np.abs(normal - median).max(2) > .12)
        normal[bump] = median[bump]
        Image.fromarray((normal * 255 + .5).astype(np.uint8)).save(out / f'{name}_normal.png')
        report.append({'mesh': name, 'normal_texels_flattened': int(bump.sum())})
    Image.fromarray((result * 255 + .5).astype(np.uint8)).save(out / f'{name}_albedo.png')
    changed = np.zeros(albedo.shape[:2], np.float32); changed[pix[:, 0], pix[:, 1]] = alpha
    Image.fromarray((changed * 255).astype(np.uint8)).save(out / f'{name}{"_front" if front else ""}_changed.png')
    return float((alpha > .05).mean())


if __name__ == '__main__':
    posed, views_dir, out = (Path(a) for a in sys.argv[1:4])
    out.mkdir(parents=True, exist_ok=True)
    report = []
    share = {name: reproject(name, posed, views_dir, out, views, report)
             for name, views in (('Body', BODY_VIEWS), ('Head', HEAD_VIEWS))}
    share['Body front'] = reproject('Body', posed, views_dir, out, {'foto_original_frontal_1024x1536': 0}, report,
                                    source=out / 'Body_albedo.png', front=True)
    (out / 'reproject-report.json').write_text(json.dumps({'views': report, 'changed_share': share}, indent=2) + '\n')
    print('REPROJECT_OK', share)
