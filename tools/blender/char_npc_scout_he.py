"""Build Scout He with a dark cloak, face mask, and short sword."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import export_glb
from character_factory import build_scout_he

export_glb("characters/npc-scout-he.glb", build_scout_he(), character_forward=True)
