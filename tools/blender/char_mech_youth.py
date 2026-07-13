"""Build the orange-goggled mechanic protagonist and selection portrait."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import export_glb, render_portrait
from hero_rig_factory import build_mech_youth

model = build_mech_youth()
export_glb("characters/protagonist-mech-youth.glb", model)
render_portrait("protagonist-mech-youth.png", target=(0, 0, 0.94), camera_location=(2.45, 4.55, 2.12))
