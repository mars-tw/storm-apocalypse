"""Build Kid Bao with a short silhouette and snow-readable yellow hat."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import export_glb
from character_factory import build_kid_bao

export_glb("characters/npc-kid-bao.glb", build_kid_bao())
