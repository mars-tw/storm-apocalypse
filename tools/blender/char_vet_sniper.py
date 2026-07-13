"""Build the tall hooded veteran protagonist and selection portrait."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import export_glb, render_portrait
from hero_rig_factory import build_vet_sniper

model = build_vet_sniper()
export_glb("characters/protagonist-vet-sniper.glb", model)
render_portrait("protagonist-vet-sniper.png", target=(0, 0, 1.08), camera_location=(2.55, 4.8, 2.32))
