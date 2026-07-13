"""R2 ember cannon with barrel recoil and animated brazier flame."""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from animated_asset_utils import create_object_clip
from blender_utils import *


reset_scene()
model = root("EmberCannonTowerR2")

stone = material("Cannon Soot Stone", (0.145, 0.14, 0.13), 0.97)
wood = material("Cannon Timber", (0.32, 0.13, 0.042), 0.9)
iron = material("Cannon Black Iron", (0.075, 0.095, 0.095), 0.34, 0.76)
band = material("Cannon Hot Band", (0.45, 0.19, 0.045), 0.4, 0.62)
ember = material("Cannon Ember", (0.94, 0.16, 0.018), 0.4, 0.0, (1.0, 0.045, 0.004), 4.4)
flame = material("Cannon Flame", (1.0, 0.54, 0.035), 0.28, 0.0, (1.0, 0.2, 0.008), 5.2)

# Reinforced stepped base, turntable teeth, and timber recoil carriage.
add_cylinder("CannonFoot", (0, 0, 0.18), 1.48, 0.36, stone, 12)
add_cylinder("CannonStep", (0, 0, 0.42), 1.2, 0.2, stone, 10)
add_cylinder("IronTurntable", (0, 0, 0.6), 0.98, 0.2, iron, 12)
for index in range(12):
    angle = index * math.tau / 12
    add_box(
        f"TurntableTooth{index}",
        (math.cos(angle) * 1.02, math.sin(angle) * 1.02, 0.62),
        (0.24, 0.12, 0.12), band, (0, 0, angle),
    )
for side in (-1, 1):
    add_box(f"CradleLeg{side}", (side * 0.63, 0, 1.33), (0.32, 1.5, 1.45), wood, (0, side * math.radians(10), 0))
    add_cylinder(f"TrunnionCap{side}", (side * 0.82, 0.2, 1.76), 0.255, 0.18, band, 9, (0, math.pi / 2, 0))
    add_cylinder(f"CradlePin{side}", (side * 0.92, 0.2, 1.76), 0.1, 0.22, iron, 8, (0, math.pi / 2, 0))
add_box("CradleCrossbeam", (0, -0.48, 1.08), (1.74, 0.3, 0.32), wood)
add_box("RecoilStop", (0, -0.8, 1.55), (1.46, 0.22, 0.38), band)

# Brazier retains a resting flame, but its authored motion is sampled only on attack.
add_cone("BrazierBowl", (-0.96, -0.77, 1.05), 0.46, 0.29, 0.34, iron, 10)
add_cylinder("BrazierCoals", (-0.96, -0.77, 1.23), 0.31, 0.08, ember, 9)
for index in range(4):
    angle = index * math.tau / 4
    add_beam(
        f"BrazierGuard{index}",
        (-0.96 + math.cos(angle) * 0.36, -0.77 + math.sin(angle) * 0.36, 1.04),
        (-0.96 + math.cos(angle) * 0.28, -0.77 + math.sin(angle) * 0.28, 1.42),
        0.025, band, 6,
    )
flame_root = root("BrazierFlame")
flame_root.location = (-0.96, -0.77, 1.25)
flame_root.parent = model
for index, x in enumerate((-0.18, 0, 0.18)):
    flame_piece = add_crystal(
        f"FlameTongue{index}",
        (x, 0, 0),
        0.115,
        0.56 + (index % 2) * 0.19,
        flame if index == 1 else ember,
        4,
        math.pi / 4,
    )
    flame_piece.parent = flame_root

aim = root("AimPivot")
aim.location = (0, 0, 1.76)
aim.parent = model
barrel_recoil = root("CannonBarrelRecoil")
barrel_recoil.parent = aim

parts = [
    add_ico("CannonBreech", (0, -0.45, 0.06), 0.58, iron, 1, (1.0, 1.3, 0.9)),
    add_beam("CannonBarrel", (0, -0.39, 0.1), (0, 1.46, 0.28), 0.39, iron, 12),
    add_torus("MuzzleBand", (0, 1.5, 0.285), 0.44, 0.11, band, 12, 4, (math.pi / 2, 0, 0)),
    add_torus("BreechBand", (0, 0.04, 0.14), 0.42, 0.075, band, 12, 4, (math.pi / 2, 0, 0)),
    add_torus("MidBand", (0, 0.78, 0.215), 0.405, 0.055, iron, 12, 3, (math.pi / 2, 0, 0)),
    add_cylinder("FuseSocket", (0.26, -0.46, 0.49), 0.075, 0.3, band, 8, (0, math.radians(28), 0)),
    add_ico("LitFuse", (0.325, -0.46, 0.65), 0.09, ember, 1),
]
for part in parts:
    part.parent = barrel_recoil

create_object_clip(barrel_recoil, "attack", [
    (1, {"location": (0, 0, 0), "rotation": (0, 0, 0)}),
    (5, {"location": (0, 0.05, 0), "rotation": (-0.015, 0, 0)}),
    (7, {"location": (0, -0.58, 0.035), "rotation": (0.045, 0, 0)}),
    (12, {"location": (0, -0.3, 0.015), "rotation": (0.02, 0, 0)}),
    (18, {"location": (0, 0.06, -0.008), "rotation": (-0.01, 0, 0)}),
    (24, {"location": (0, 0, 0), "rotation": (0, 0, 0)}),
])
create_object_clip(flame_root, "attack", [
    (1, {"scale": (1, 1, 1), "rotation": (0, 0, -0.06)}),
    (5, {"scale": (1.08, 0.92, 1.26), "rotation": (0.12, -0.08, 0.16)}),
    (8, {"scale": (1.35, 1.15, 1.58), "rotation": (-0.18, 0.1, -0.2)}),
    (13, {"scale": (0.86, 0.92, 0.78), "rotation": (0.1, 0.06, 0.18)}),
    (18, {"scale": (1.05, 0.96, 1.18), "rotation": (-0.08, -0.04, -0.12)}),
    (24, {"scale": (1, 1, 1), "rotation": (0, 0, -0.06)}),
])

export_glb("tower-cannon.glb", model)
