"""Build Lao Zhou with an asymmetric posture, cane, and scrap sack."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import export_glb
from character_factory import build_lao_zhou

export_glb("characters/npc-lao-zhou.glb", build_lao_zhou())
