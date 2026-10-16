# /// script
# requires-python = ">=3.10"
# dependencies = ["gradio_client"]
# ///
"""Generate the next missing model with TRELLIS (MIT) on Hugging Face, one per run.

Dev-only tool, not part of the site. The free anonymous ZeroGPU quota fits about one textured
model per day, so this is run daily until every model in QUEUE exists.
Usage: uv run --system-certs tools/trellis-generate.py [name]
Input: assets/models/source/ref/<name>.png  Output: assets/models/source/<name>.glb
"""
import shutil, sys
from pathlib import Path
from gradio_client import Client, handle_file

QUEUE = ['bus', 'bigben', 'towerbridge', 'londoneye', 'wembley', 'plane']  # bus first: it is in every scene
SRC = Path(__file__).resolve().parent.parent / 'assets/models/source'

todo = sys.argv[1:] or [n for n in QUEUE if not (SRC / f'{n}.glb').exists()][:1]
if not todo:
    print('all models generated'); sys.exit(0)
name = todo[0]
c = Client('trellis-community/TRELLIS')
try: c.predict(api_name='/start_session')
except Exception as e: print('start_session:', str(e)[:120])
r = c.predict(image=handle_file(str(SRC / 'ref' / f'{name}.png')), multiimages=[], seed=0,
              ss_guidance_strength=7.5, ss_sampling_steps=12, slat_guidance_strength=3.0, slat_sampling_steps=12,
              multiimage_algo='stochastic', mesh_simplify=0.95, texture_size=1024, api_name='/generate_and_extract_glb')
glb = r[2] if isinstance(r[2], str) else r[2]['value']
shutil.copy(glb, SRC / f'{name}.glb')
left = [n for n in QUEUE if not (SRC / f'{n}.glb').exists()]
print(f'generated {name}.glb ({(SRC / f"{name}.glb").stat().st_size} bytes); remaining: {left}')
