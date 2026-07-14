"""Build the complete seven-character GLB pack in one headless Blender run."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import export_glb, render_portrait
from hero_rig_factory import (
    build_butcher_matron,
    build_vet_sniper,
    build_mech_youth,
)
from character_factory import (
    build_lao_zhou,
    build_nurse_lin,
    build_kid_bao,
    build_scout_he,
)

model = build_butcher_matron()
export_glb("characters/protagonist-butcher-matron.glb", model, character_forward=True)
render_portrait("protagonist-butcher-matron.png", camera_location=(2.55, 4.65, 2.2))
model = build_vet_sniper()
export_glb("characters/protagonist-vet-sniper.glb", model, character_forward=True)
render_portrait("protagonist-vet-sniper.png", target=(0, 0, 1.08), camera_location=(2.55, 4.8, 2.32))
model = build_mech_youth()
export_glb("characters/protagonist-mech-youth.glb", model, character_forward=True)
render_portrait("protagonist-mech-youth.png", target=(0, 0, 0.94), camera_location=(2.45, 4.55, 2.12))
export_glb("characters/npc-lao-zhou.glb", build_lao_zhou(), character_forward=True)
export_glb("characters/npc-nurse-lin.glb", build_nurse_lin(), character_forward=True)
export_glb("characters/npc-kid-bao.glb", build_kid_bao(), character_forward=True)
export_glb("characters/npc-scout-he.glb", build_scout_he(), character_forward=True)
