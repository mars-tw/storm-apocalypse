"""Build the broad red-apron protagonist and her selection portrait."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import export_glb, render_portrait
from hero_rig_factory import build_butcher_matron

model = build_butcher_matron()
export_glb("characters/protagonist-butcher-matron.glb", model, character_forward=True)
render_portrait("protagonist-butcher-matron.png", camera_location=(2.55, 4.65, 2.2))
