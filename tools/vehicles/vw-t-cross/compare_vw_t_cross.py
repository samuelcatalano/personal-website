# blender -b --factory-startup -P compare_vw_t_cross.py -- <blueprint.png>   (blueprint converted to PNG first, e.g. sips -s format png)
# -> renders/compare.png (reference row above model row, same framing, orthographic side/front/rear) and renders/overlay.png (blueprint lines in red over the model)
import bpy, sys, json
import numpy as np
from pathlib import Path
HERE = Path(__file__).resolve().parent; R = HERE / 'renders'
ref = sys.argv[sys.argv.index('--') + 1]; CAL = json.loads((HERE / 'framing.json').read_text())
def load(p):
    im = bpy.data.images.load(str(p)); w, h = im.size; a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]; return a[..., :3]   # row0 = top
BP = load(ref)
def save(arr, p):
    h, w = arr.shape[:2]; im = bpy.data.images.new('o', w, h); rgba = np.concatenate([arr, np.ones((h, w, 1), np.float32)], 2)[::-1]
    im.pixels = rgba.ravel().tolist(); im.filepath_raw = str(p); im.file_format = 'PNG'; im.save()
def crop(v):
    c = CAL[v]['crop']; return BP[c[1]:c[3], c[0]:c[2]]
mod = {v: load(R / f'{v}.png') for v in CAL}
def pad(a, w, h): o = np.ones((h, w, 3), np.float32) * .5; o[:a.shape[0], :a.shape[1]] = a[:h, :w]; return o
# row 1: side (ref over model).  row 2: front|rear (ref over model)
side = np.concatenate([crop('side'), mod['side']], 0)
fr_ref = np.concatenate([crop('front'), crop('rear')], 1); fr_mod = np.concatenate([mod['front'], mod['rear']], 1)
fr = np.concatenate([fr_ref, fr_mod], 0)
W = max(side.shape[1], fr.shape[1]); out = np.concatenate([pad(side, W, side.shape[0]), pad(fr, W, fr.shape[0])], 0)
save(out, R / 'compare.png')
ov = []
for v in CAL:
    r = crop(v).mean(2) < .43; m = mod[v].copy() * .75 + .25; m[r] = (1, 0, 0); ov.append(m)
ovs = np.concatenate([pad(ov[0], W, ov[0].shape[0]), pad(np.concatenate(ov[1:], 1), W, ov[1].shape[0])], 0)
save(ovs, R / 'overlay.png'); print('compare saved', out.shape)
