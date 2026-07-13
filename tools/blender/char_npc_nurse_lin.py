"""Build Nurse Lin with a low-key shoulder cape and medical armband."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import export_glb
from character_factory import build_nurse_lin

export_glb("characters/npc-nurse-lin.glb", build_nurse_lin())
