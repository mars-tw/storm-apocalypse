"""Generate the iron barrel cannon tower with a live ember brazier."""

import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import *


reset_scene()
model = root("EmberCannonTower")

stone = material("Cannon Soot Stone", (0.17, 0.16, 0.145), 0.96)
wood = material("Cannon Timber", (0.31, 0.13, 0.045), 0.88)
iron = material("Cannon Black Iron", (0.10, 0.115, 0.11), 0.36, 0.72)
band = material("Cannon Hot Band", (0.42, 0.20, 0.055), 0.42, 0.58)
ember = material("Cannon Ember", (0.94, 0.2, 0.025), 0.42, 0.0, (1.0, 0.055, 0.005), 4.2)
flame = material("Cannon Flame", (1.0, 0.55, 0.04), 0.3, 0.0, (1.0, 0.22, 0.01), 5.0)

# Heavy squat base and timber recoil cradle.
add_cylinder("CannonFoot", (0, 0, 0.22), 1.42, 0.44, stone, 10)
add_cylinder("IronTurntable", (0, 0, 0.52), 0.96, 0.22, iron, 10)
for side in (-1, 1):
    add_box(f"CradleLeg{side}", (side * 0.62, 0, 1.28), (0.3, 1.45, 1.45), wood, (0, side * math.radians(10), 0))
    add_cylinder(f"TrunnionCap{side}", (side * 0.8, 0.18, 1.72), 0.24, 0.16, band, 8, (0, math.pi / 2, 0))
add_box("CradleCrossbeam", (0, -0.46, 1.02), (1.68, 0.28, 0.3), wood)

# Side brazier and stylised polygon flames remain stationary.
add_cone("BrazierBowl", (-0.9, -0.74, 1.02), 0.44, 0.28, 0.32, iron, 9)
add_cylinder("BrazierCoals", (-0.9, -0.74, 1.18), 0.3, 0.08, ember, 8)
for index, x in enumerate((-1.08, -0.9, -0.72)):
    flame_piece = add_crystal(f"Flame{index}", (x, -0.74, 1.2), 0.12, 0.5 + (index % 2) * 0.18, flame if index == 1 else ember, 4, math.pi / 4)

aim = root("AimPivot")
aim.location = (0, 0, 1.7)
aim.parent = model

parts = []
parts.append(add_ico("CannonBreech", (0, -0.42, 0.06), 0.55, iron, 1, (1.0, 1.25, 0.9)))
parts.append(add_beam("Barrel", (0, -0.36, 0.1), (0, 1.38, 0.25), 0.38, iron, 10))
parts.append(add_torus("MuzzleBand", (0, 1.42, 0.255), 0.42, 0.105, band, 10, 4, (math.pi / 2, 0, 0)))
parts.append(add_torus("BreechBand", (0, 0.05, 0.14), 0.4, 0.07, band, 10, 4, (math.pi / 2, 0, 0)))
parts.append(add_cylinder("FuseSocket", (0.25, -0.45, 0.46), 0.07, 0.28, band, 7, (0, math.radians(28), 0)))
parts.append(add_ico("LitFuse", (0.31, -0.45, 0.61), 0.085, ember, 1))
for part in parts:
    parent(part, aim)

export_glb("tower-cannon.glb", model)
