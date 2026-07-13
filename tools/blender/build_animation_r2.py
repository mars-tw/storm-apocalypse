"""Build all three R2 protagonists and all three animated R2 towers."""

import runpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from blender_utils import export_glb, render_portrait
from hero_rig_factory import build_butcher_matron, build_mech_youth, build_vet_sniper


model = build_butcher_matron()
export_glb("characters/protagonist-butcher-matron.glb", model)
render_portrait("protagonist-butcher-matron.png", camera_location=(2.55, 4.65, 2.2))

model = build_vet_sniper()
export_glb("characters/protagonist-vet-sniper.glb", model)
render_portrait("protagonist-vet-sniper.png", target=(0, 0, 1.08), camera_location=(2.55, 4.8, 2.32))

model = build_mech_youth()
export_glb("characters/protagonist-mech-youth.glb", model)
render_portrait("protagonist-mech-youth.png", target=(0, 0, 0.94), camera_location=(2.45, 4.55, 2.12))

for script in ("tower_ballista.py", "tower_frost.py", "tower_cannon.py"):
    runpy.run_path(str(HERE / script), run_name="__main__")

