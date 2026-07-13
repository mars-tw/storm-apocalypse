"""R2 wind-hunter ballista with reload, release, and recoil animation."""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from animated_asset_utils import create_object_clip
from blender_utils import *


reset_scene()
model = root("WindHunterBallistaTowerR2")

stone = material("Ballista Stone", (0.19, 0.23, 0.23), 0.96)
dark_wood = material("Ballista Dark Timber", (0.13, 0.055, 0.025), 0.92)
wood = material("Ballista Wind Wood", (0.49, 0.245, 0.075), 0.86)
rope = material("Ballista Rope", (0.68, 0.48, 0.21), 0.98)
iron = material("Ballista Iron", (0.095, 0.13, 0.14), 0.42, 0.62)
teal = material("Wind Rune", (0.055, 0.5, 0.54), 0.45, 0.05, (0.025, 0.38, 0.42), 1.7)

# Heavier two-step plinth, rune spokes, and splayed frame distinguish the R2 silhouette.
add_cylinder("StoneFoot", (0, 0, 0.15), 1.34, 0.3, stone, 10)
add_cylinder("StoneStep", (0, 0, 0.38), 1.12, 0.2, stone, 8)
add_cylinder("RuneInlay", (0, 0, 0.5), 0.73, 0.045, teal, 10)
for index in range(4):
    angle = index * math.pi / 2
    add_box(
        f"RuneSpoke{index}",
        (math.cos(angle) * 0.48, math.sin(angle) * 0.48, 0.526),
        (0.56, 0.075, 0.03), teal, (0, 0, angle),
    )
for index, (x, y) in enumerate(((-0.88, -0.64), (0.88, -0.64), (-0.88, 0.64), (0.88, 0.64))):
    add_beam(f"SplayedLeg{index}", (x, y, 0.42), (x * 0.44, y * 0.36, 2.05), 0.125, dark_wood, 7)
    add_cylinder(f"LegBolt{index}", (x * 0.61, y * 0.53, 1.26), 0.07, 0.18, iron, 7, (math.pi / 2, 0, 0))
for y in (-0.64, 0.64):
    add_beam(f"CrossBraceA{y}", (-0.76, y, 0.78), (0.76, y, 1.67), 0.065, rope, 6)
    add_beam(f"CrossBraceB{y}", (0.76, y, 0.78), (-0.76, y, 1.67), 0.065, rope, 6)
add_box("GunnerDeck", (0, 0, 2.06), (2.28, 1.78, 0.22), wood)
for x in (-1.08, 1.08):
    add_box(f"DeckRail{x}", (x, -0.22, 2.39), (0.1, 1.28, 0.62), dark_wood)
    for y in (-0.7, 0.22):
        add_cylinder(f"RailCap{x}{y}", (x, y, 2.72), 0.085, 0.16, iron, 7)

aim = root("AimPivot")
aim.location = (0, 0, 2.46)
aim.parent = model
recoil = root("BallistaRecoil")
recoil.parent = aim
loader = root("BallistaLoader")
loader.parent = recoil
windlass_anim = root("BallistaWindlass")
windlass_anim.parent = recoil

weapon_parts = [
    add_box("BallistaStock", (0, 0.2, 0.09), (0.28, 2.5, 0.27), wood),
    add_cone("StockNose", (0, 1.5, 0.1), 0.15, 0.0, 0.46, iron, 7, (math.pi / 2, 0, 0)),
]
for side in (-1, 1):
    weapon_parts.extend((
        add_beam(f"BowInner{side}", (0, 0.5, 0.14), (side * 0.94, 0.42, 0.21), 0.11, wood, 7),
        add_beam(f"BowOuter{side}", (side * 0.94, 0.42, 0.21), (side * 1.68, 0.08, 0.31), 0.086, dark_wood, 7),
        add_beam(f"BowTip{side}", (side * 1.68, 0.08, 0.31), (side * 1.82, -0.12, 0.15), 0.052, iron, 6),
        add_beam(f"String{side}", (side * 1.82, -0.12, 0.15), (0, -0.66, 0.15), 0.016, rope, 5),
    ))
    add_cylinder(f"BowPlate{side}", (side * 0.9, 0.42, 0.21), 0.13, 0.08, iron, 7, (0, math.pi / 2, 0)).parent = recoil
for part in weapon_parts:
    part.parent = recoil

windlass = add_cylinder("WindlassDrum", (0, -0.66, 0.06), 0.18, 1.02, iron, 9, (0, math.pi / 2, 0))
windlass.parent = windlass_anim
for side in (-1, 1):
    crank = add_beam(f"WindlassCrank{side}", (side * 0.52, -0.66, 0.05), (side * 0.7, -0.42, 0.22), 0.035, rope, 6)
    crank.parent = windlass_anim
bolt = add_beam("LoadedBolt", (0, -0.58, 0.31), (0, 1.68, 0.31), 0.037, iron, 6)
bolt.parent = loader
fletching = add_box("BoltFletching", (0, -0.48, 0.31), (0.32, 0.18, 0.035), teal)
fletching.parent = loader

create_object_clip(recoil, "attack", [
    (1, {"location": (0, 0, 0)}),
    (8, {"location": (0, 0.045, 0)}),
    (10, {"location": (0, -0.34, 0.015)}),
    (15, {"location": (0, -0.12, 0)}),
    (24, {"location": (0, 0, 0)}),
])
create_object_clip(loader, "attack", [
    (1, {"location": (0, 0, 0), "scale": (1, 1, 1)}),
    (6, {"location": (0, -0.52, 0), "scale": (1, 1, 1)}),
    (8, {"location": (0, -0.62, 0), "scale": (1, 1, 1)}),
    (10, {"location": (0, 0.45, 0), "scale": (0.03, 0.03, 0.03)}),
    (20, {"location": (0, 0, 0), "scale": (0.03, 0.03, 0.03)}),
    (24, {"location": (0, 0, 0), "scale": (1, 1, 1)}),
])
create_object_clip(windlass_anim, "attack", [
    (1, {"rotation": (0, 0, 0)}),
    (8, {"rotation": (math.pi * 2, 0, 0)}),
    (24, {"rotation": (math.pi * 2, 0, 0)}),
])

export_glb("tower-ballista.glb", model)
