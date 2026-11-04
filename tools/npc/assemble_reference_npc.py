"""Assemble approved reference parts using the master alignment, without refitting the face.

Run with the existing AssetFurnace Python environment. Inputs stay in their original
glTF frame; reference_rig.py applies the final metre-scale normalization.
"""
import argparse
import copy
import json
from pathlib import Path
import sys

import numpy as np
import trimesh


def clip(mesh, normals, field):
    """Keep field >= 0, splitting crossing triangles so the edge follows the field, not the mesh."""
    f = field(mesh.vertices)
    attrs = np.column_stack((mesh.vertices, mesh.visual.uv, normals))
    extra, cache, faces = [], {}, []

    def crossing(i, j):
        key = (min(i, j), max(i, j))
        if key not in cache:
            t = f[i] / (f[i] - f[j])
            extra.append(attrs[i] + t * (attrs[j] - attrs[i]))
            cache[key] = len(attrs) + len(extra) - 1
        return cache[key]

    for tri in mesh.faces[(f[mesh.faces] >= 0).any(axis=1)]:
        loop = []
        for i, j in zip(tri, np.roll(tri, -1)):
            if f[i] >= 0:
                loop.append(i)
            if (f[i] >= 0) != (f[j] >= 0):
                loop.append(crossing(i, j))
        faces += [(loop[0], loop[k], loop[k + 1]) for k in range(1, len(loop) - 1)]
    attrs = np.vstack((attrs, extra)) if extra else attrs
    faces = np.asarray(faces)
    used, inverse = np.unique(faces, return_inverse=True)
    attrs = attrs[used]
    result = trimesh.Trimesh(attrs[:, :3], inverse.reshape(-1, 3), process=False,
                             visual=trimesh.visual.TextureVisuals(uv=attrs[:, 3:5], material=mesh.visual.material))
    return result, attrs[:, 5:8]


def smooth_normals(mesh, normals, iterations=12):
    """Soften the head's facets under direct light; positions, UVs and silhouette stay untouched."""
    _, ids = np.unique(np.round(mesh.vertices, 6), axis=0, return_inverse=True)
    ids = ids.ravel()
    current = np.zeros((ids.max() + 1, 3))
    np.add.at(current, ids, normals)
    edges = ids[mesh.edges_unique]
    for _ in range(iterations):
        summed = current.copy()
        np.add.at(summed, edges[:, 0], current[edges[:, 1]])
        np.add.at(summed, edges[:, 1], current[edges[:, 0]])
        current = summed / np.maximum(np.linalg.norm(summed, axis=1, keepdims=True), 1e-9)
    return current[ids]


def check_clip():
    """A cut triangle keeps its corner, ends exactly on the field and interpolates its UVs."""
    uv = trimesh.visual.TextureVisuals(uv=((0, 0), (1, 0), (0, 1)))
    mesh = trimesh.Trimesh(((0, 0, 0), (1, 0, 0), (0, 1, 0)), ((0, 1, 2),), process=False, visual=uv)
    kept, normals = clip(mesh, np.tile((0., 0., 1.), (3, 1)), lambda v: v[:, 0] - .5)
    assert len(kept.faces) == 1 and len(normals) == 3 and np.isclose(kept.vertices[:, 0].min(), .5)
    assert np.allclose(kept.visual.uv[:, 0], kept.vertices[:, 0])


AXIS = np.array([.005, -.012])  # neck centre (x, z), from the seam ring's radii per angle.


def angle_radius(v):
    dx, dz = v[:, 0] - AXIS[0], v[:, 2] - AXIS[1]
    return np.arctan2(dx, dz), np.hypot(dx, dz)


def collar_terms(theta):
    return np.column_stack([np.ones_like(theta)] + [f(k * theta) for k in range(1, 5) for f in (np.cos, np.sin)])


# Lowest skin (1st percentile) on the body per 15 degrees from -180 (nape); 0 is the chin. A smooth curve.
COLLAR = np.linalg.lstsq(collar_terms(np.radians(np.arange(-180, 180, 15.))), np.array(
    (0.3265, 0.3266, 0.3266, 0.327, 0.3264, 0.3236, 0.3198, 0.3113, 0.3057, 0.2979, 0.2918, 0.2892, 0.2883, 0.2884, 0.2895, 0.2933, 0.2986, 0.3065, 0.3163, 0.3226, 0.3264, 0.3267, 0.3265, 0.3265)), rcond=None)[0]


def collar_field(v):
    """Zero on the body's real neckline, so the join sits where the shirt already starts."""
    return v[:, 1] - collar_terms(angle_radius(v)[0]) @ COLLAR


def profile(v, bins=36):
    """Smoothed radius per angle; ponytail: assumes a star-shaped neck, true for this scan."""
    theta, radius = angle_radius(v)
    index = ((theta + np.pi) / (2 * np.pi) * bins).astype(int) % bins
    values = np.full(bins, np.nan)
    for b in np.unique(index):
        values[b] = np.percentile(radius[index == b], 80)
    known = np.flatnonzero(np.isfinite(values))
    values = np.interp(np.arange(bins), known, values[known], period=bins)
    return np.convolve(np.tile(values, 3), np.ones(5) / 5, 'same')[bins:2 * bins]


EYE_PLANE = .0085  # Mirror plane of the sockets (x), measured on the head without eye patches.


def face_depth(xy, head):
    """Depth of the head along +z at each point, nan where the ray misses it."""
    origins = np.column_stack((xy, np.ones(len(xy))))
    points, rays, _ = head.ray.intersects_location(origins, np.tile((0., 0., -1.), (len(xy), 1)),
                                                   multiple_hits=False)
    depth = np.full(len(xy), np.nan)
    depth[rays] = points[:, 2]
    return depth


def rim_depth(patch, head):
    """Median depth of the skin just outside a patch; rays through the socket's hole are ignored."""
    lo, hi = patch[:, :2].min(axis=0) - .003, patch[:, :2].max(axis=0) + .003
    grid = np.stack(np.meshgrid(np.linspace(lo[0], hi[0], 16), np.linspace(lo[1], hi[1], 10)), -1).reshape(-1, 2)
    rim = (grid < lo + .002).any(axis=1) | (grid > hi - .002).any(axis=1)
    depth = face_depth(grid[rim], head)
    return np.median(depth[depth > .03])


def socket_backing(patch, head):
    """Dark lid-coloured quad behind an eye: the socket's hole shows it instead of the empty skull."""
    lo, hi = patch[:, :2].min(axis=0) - .001, patch[:, :2].max(axis=0) + .001
    corners = np.array(((lo[0], lo[1]), (hi[0], lo[1]), (hi[0], hi[1]), (lo[0], hi[1])))
    tilt = np.linalg.lstsq(np.column_stack((patch[:, :2], np.ones(len(patch)))), patch[:, 2], rcond=None)[0]
    depth = face_depth(corners, head)
    behind_eye = np.column_stack((corners, np.ones(4))) @ tilt - .003
    # Behind both the eye and the surrounding skin, so it only shows through the hole.
    return np.column_stack((corners, np.fmin(depth - .004, behind_eye)))


def symmetric_eyes(eyes, colours, head, material_visual):
    """Mirror the intact copied eye: the other patch's rays fell through scan holes."""
    v = eyes.vertices
    side = v[:, 0] >= (v[:, 0].min() + v[:, 0].max()) / 2
    faces = eyes.faces[side[eyes.faces].all(axis=1)]
    used, inverse = np.unique(faces, return_inverse=True)
    right, faces, tint = v[used].copy(), inverse.reshape(-1, 3), colours[used]
    left = right.copy()
    left[:, 0] = 2 * EYE_PLANE - left[:, 0]
    left[:, 2] += rim_depth(left, head) - rim_depth(right, head)
    for patch in (left, right):
        # Simplified LODs can bury the patch: raise only what the face covers, not rays into the hole.
        depth = face_depth(patch[:, :2], head)
        covered = (depth > patch[:, 2]) & (depth < patch[:, 2] + .012)
        patch[covered, 2] = depth[covered] + .0003
    backings = [socket_backing(left, head), socket_backing(right, head)]
    count = len(left)
    quad = np.array(((0, 1, 2), (0, 2, 3)))
    result = trimesh.Trimesh(np.vstack((left, right, *backings)), np.vstack(
        (faces[:, ::-1], faces + count, quad + 2 * count, quad + 2 * count + 4)),
        process=False, visual=material_visual)
    dark = np.tile(np.array((10, 7, 6, 255), dtype=tint.dtype), (8, 1))
    result.visual.vertex_attributes['color'] = np.vstack((tint, tint, dark))
    return result


def assemble(body_path, head_path, eyes_path, alignment, output, lab):
    sys.path.insert(0, str(lab))
    from image_to_3dlab.glb_turn import parse_glb, build_glb

    check_clip()
    recipe = json.loads(alignment.read_text())
    transform = np.asarray(recipe['head_transform'], dtype=float)
    assert transform.shape == (4, 4) and np.isfinite(transform).all()
    assert np.linalg.det(transform[:3, :3]) > 0
    body = trimesh.load(body_path, force='mesh', process=False)
    head = trimesh.load(head_path, force='mesh', process=False)
    body_normals, head_normals = body.vertex_normals.copy(), head.vertex_normals.copy()
    height = float(np.ptp(body.vertices[:, 1]))
    floor = float(body.vertices[:, 1].min())

    # Head first, in the body frame: everything here is measured against the same neckline.
    head.apply_transform(transform)
    head_normals = head_normals @ transform[:3, :3].T
    head_normals /= np.maximum(np.linalg.norm(head_normals, axis=1, keepdims=True), 1e-9)  # The scan has degenerate faces.
    tuck, band = .004, .014
    # The portrait's neck ends above the shirt in front: stretch only the skin below the beard to reach it.
    seam = collar_terms(angle_radius(head.vertices)[0]) @ COLLAR
    below_beard = np.clip((.3085 - head.vertices[:, 1]) / (.3085 - .3015), 0, 1)
    head.vertices[:, 1] -= np.maximum(0, .3015 - (seam - tuck)) * below_beard ** 2  # Eases in below the beard.

    head, head_normals = clip(head, head_normals, lambda v: collar_field(v) + tuck)

    # Body keeps the shirt below the neckline, plus the recessed rear scalp liner inside the hair.
    centre = body.vertices[body.vertices[:, 1] >= .334].mean(axis=0)
    body, body_normals = clip(body, body_normals, lambda v: np.maximum(
        -collar_field(v), np.minimum(v[:, 1] - .34, centre[2] - v[:, 2])))
    liner = body.vertices[:, 1] >= .34
    # Tolerance, not zero: the split is linear but the field is curved, so coarse LODs drift.
    ring = body.vertices[(np.abs(collar_field(body.vertices)) < .002) & ~liner]
    assert len(ring) and len(body.faces) and len(head.faces)
    body.vertices[liner] = centre + (body.vertices[liner] - centre) * .92

    # Fit the head's neck inside the collar opening, fading out before it reaches the beard.
    field = collar_field(head.vertices)
    target = profile(ring) / profile(head.vertices[np.abs(field) < .004])
    theta, _ = angle_radius(head.vertices)
    index = ((theta + np.pi) / (2 * np.pi) * len(target)).astype(int) % len(target)
    fade = np.clip(1 - field / band, 0, 1)
    fade = fade * fade * (3 - 2 * fade)
    scale = 1 + fade * (np.clip(target[index], .8, 1.2) * .97 - 1)
    # Below the jaw, pull the portrait's flaring shirt scraps onto the neck instead of cutting holes.
    theta, radius = angle_radius(head.vertices)
    radius = np.maximum(radius, 1e-9)
    limit = .046 + .049 * np.clip((np.cos(theta) - .5) / .2, 0, 1)
    below_jaw = np.clip((.336 - head.vertices[:, 1]) / .006, 0, 1)
    scale *= 1 + below_jaw * (np.minimum(radius, limit) / radius - 1)
    head.vertices[:, 0] = AXIS[0] + (head.vertices[:, 0] - AXIS[0]) * scale
    head.vertices[:, 2] = AXIS[1] + (head.vertices[:, 2] - AXIS[1]) * scale
    head.vertex_normals = smooth_normals(head, head_normals)
    # The normal map was baked against the facets just softened; the photo albedo carries the detail.
    head.visual.material.normalTexture = None

    # Owner's correction: subtle 2cm shaping, reduced from the overstated 6.5cm trial.
    x = body.vertices[:, 0] / height
    y = (body.vertices[:, 1] - floor) / height
    z = body.vertices[:, 2] / height
    weight = np.exp(-((y - 1 / 1.78) / (.14 / 1.78)) ** 2)
    weight *= np.exp(-(x / (.30 / 1.78)) ** 4) * np.clip(z / .1, 0, 1)
    body.vertices[:, 2] += height * (.020 / 1.78) * weight
    # Trimesh submesh drops imported vertex normals at UV seams unless restored explicitly.
    body.vertex_normals = body_normals

    source = trimesh.load_scene(eyes_path, process=False)
    eye_parts = []
    for node in source.graph.nodes_geometry:
        matrix, key = source.graph.get(node)
        original = source.geometry[key]
        if len(original.vertices) >= 2000:
            continue
        assert 'color' in original.visual.vertex_attributes
        eyes = original.copy()
        # Trimesh's TextureVisuals.copy drops this glTF vertex-colour attribute.
        colours = original.visual.vertex_attributes['color'].copy()
        if colours.shape[1] == 3:
            alpha = 1 if np.issubdtype(colours.dtype, np.floating) else 255
            colours = np.column_stack((colours, np.full(len(colours), alpha, dtype=colours.dtype)))
        if np.issubdtype(colours.dtype, np.floating):
            colours = np.rint(np.clip(colours, 0, 1) * 255).astype(np.uint8)
        assert colours[:, :3].max() > 0 and (colours[:, 3] == 255).all()
        eyes.visual.vertex_attributes['color'] = colours
        eyes.apply_transform(matrix)
        eyes.apply_transform(transform)
        eye_parts.append(symmetric_eyes(eyes, colours, head, original.visual.copy()))
    assert len(eye_parts) == 1
    scene = trimesh.Scene()
    for name, part in (('Body', body), ('Head', head), ('ReferenceEyes', eye_parts[0])):
        scene.add_geometry(part, node_name=name, geom_name=name)
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.export(output, include_normals=True)

    # Carry the approved eye's exact PBR settings, including clearcoat.
    source_doc, _ = parse_glb(eyes_path.read_bytes())
    node = next(n for n in source_doc['nodes'] if n.get('name') == 'ReferenceEyes')
    index = source_doc['meshes'][node['mesh']]['primitives'][0]['material']
    material = copy.deepcopy(source_doc['materials'][index])
    assert 'Texture' not in json.dumps(material)
    document, binary = parse_glb(output.read_bytes())
    node = next(n for n in document['nodes'] if n.get('name') == 'ReferenceEyes')
    primitives = document['meshes'][node['mesh']]['primitives']
    assert all('COLOR_0' in p['attributes'] for p in primitives)
    slot = primitives[0].get('material', len(document['materials']))
    if slot == len(document['materials']):
        document['materials'].append(material)
    else:
        document['materials'][slot] = material
    for primitive in primitives:
        primitive['material'] = slot
    for extension in material.get('extensions', {}):
        if extension not in document.setdefault('extensionsUsed', []):
            document['extensionsUsed'].append(extension)
    output.write_bytes(build_glb(document, binary))
    print(json.dumps({'path': str(output), 'triangles': sum(len(g.faces) for g in scene.geometry.values()),
                      'parts': list(scene.geometry), 'head_alignment': 'fixed master transform',
                      'visual_review_required': True}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('body', 'head', 'eyes', 'alignment', 'output'):
        parser.add_argument(name, type=Path)
    parser.add_argument('--lab', type=Path, default=Path.home() / 'image-to-3dlab')
    args = parser.parse_args()
    assemble(args.body, args.head, args.eyes, args.alignment, args.output, args.lab)
