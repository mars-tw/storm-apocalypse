"""Generate the bespoke wind-hunter ballista tower with an AimPivot."""

import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import *


reset_scene()
model = root("WindHunterBallistaTower")

stone = material("Ballista Stone", (0.21, 0.25, 0.24), 0.96)
dark_wood = material("Ballista Dark Timber", (0.16, 0.07, 0.03), 0.92)
wood = material("Ballista Wind Wood", (0.48, 0.24, 0.09), 0.86)
rope = material("Ballista Rope", (0.67, 0.48, 0.23), 0.98)
iron = material("Ballista Iron", (0.12, 0.15, 0.15), 0.46, 0.58)
teal = material("Wind Rune", (0.08, 0.46, 0.5), 0.5, 0.05, (0.03, 0.32, 0.36), 1.5)

# Stone foot and splayed timber frame.
add_cylinder("StoneFoot", (0, 0, 0.18), 1.27, 0.36, stone, 8)
add_cylinder("RuneInlay", (0, 0, 0.375), 0.72, 0.045, teal, 8)
for index, (x, y) in enumerate(((-0.82, -0.62), (0.82, -0.62), (-0.82, 0.62), (0.82, 0.62))):
    add_beam(f"SplayedLeg{index}", (x, y, 0.3), (x * 0.46, y * 0.38, 2.08), 0.12, dark_wood, 6)
for y in (-0.64, 0.64):
    add_beam(f"CrossBraceA{y}", (-0.75, y, 0.72), (0.75, y, 1.65), 0.07, rope, 6)
    add_beam(f"CrossBraceB{y}", (0.75, y, 0.72), (-0.75, y, 1.65), 0.07, rope, 6)
add_box("GunnerDeck", (0, 0, 2.05), (2.22, 1.75, 0.22), wood)
for x in (-1.03, 1.03):
    add_box(f"DeckRail{x}", (x, -0.25, 2.38), (0.1, 1.18, 0.58), dark_wood)

# Everything under AimPivot rotates in Babylon toward the target.
aim = root("AimPivot")
aim.location = (0, 0, 2.43)
aim.parent = model

weapon_parts = []
weapon_parts.append(add_box("BallistaStock", (0, 0.22, 0.08), (0.26, 2.35, 0.25), wood))
weapon_parts.append(add_cone("BoltHead", (0, 1.52, 0.09), 0.13, 0.0, 0.42, iron, 6, (math.pi / 2, 0, 0)))
weapon_parts.append(add_cylinder("Windlass", (0, -0.62, 0.05), 0.17, 0.95, iron, 8, (0, math.pi / 2, 0)))
for side in (-1, 1):
    weapon_parts.append(add_beam(f"BowInner{side}", (0, 0.52, 0.12), (side * 0.92, 0.42, 0.18), 0.105, wood, 7))
    weapon_parts.append(add_beam(f"BowOuter{side}", (side * 0.92, 0.42, 0.18), (side * 1.63, 0.13, 0.28), 0.085, dark_wood, 7))
    weapon_parts.append(add_beam(f"BowTip{side}", (side * 1.63, 0.13, 0.28), (side * 1.78, -0.08, 0.13), 0.055, iron, 6))
    weapon_parts.append(add_beam(f"String{side}", (side * 1.78, -0.08, 0.13), (0, -0.62, 0.13), 0.018, rope, 5))
weapon_parts.append(add_beam("LoadedBolt", (0, -0.58, 0.3), (0, 1.58, 0.3), 0.035, iron, 6))
for part in weapon_parts:
    parent(part, aim)

export_glb("tower-ballista.glb", model)
