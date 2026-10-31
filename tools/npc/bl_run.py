# Runner for the pip `bpy` module (stands in for `blender -b --factory-startup --python <script>`): python3 bl_run.py <script.py> [args]
import sys, runpy, bpy  # noqa: F401  (importing bpy makes addon_utils importable)
bpy.ops.wm.read_factory_settings(use_empty=False)
s = sys.argv[1]; sys.argv = sys.argv[1:]; runpy.run_path(s, run_name="__main__")
