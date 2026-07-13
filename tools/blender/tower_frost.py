"""Generate the frost crystal spire with a luminous core and AimPivot."""

import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import *


reset_scene()
model = root("FrostCrystalTower")

stone = material("Frost Slate", (0.14, 0.24, 0.3), 0.86, 0.06)
snow = material("Packed Frost", (0.55, 0.76, 0.82), 0.82)
ice = material("Ancient Ice", (0.18, 0.62, 0.82), 0.26, 0.04, (0.04, 0.32, 0.65), 1.45)
ice_light = material("Frost Core", (0.42, 0.9, 1.0), 0.18, 0.0, (0.08, 0.65, 1.0), 4.0)
iron = material("Frost Bands", (0.12, 0.25, 0.3), 0.5, 0.42)

# Layered octagonal base, deliberately shorter and broader than the other towers.
add_cylinder("FrostBase", (0, 0, 0.2), 1.35, 0.4, stone, 8)
add_cylinder("SnowStep", (0, 0, 0.48), 1.05, 0.2, snow, 8)
add_cone("SlatePlinth", (0, 0, 1.0), 0.88, 0.56, 0.95, stone, 8)
for index in range(4):
    angle = index * math.pi / 2 + math.pi / 4
    add_crystal(
        f"GroundShard{index}",
        (math.cos(angle) * 0.78, math.sin(angle) * 0.78, 0.43),
        0.22,
        1.1 + (index % 2) * 0.24,
        ice,
        5,
        angle,
    )

aim = root("AimPivot")
aim.location = (0, 0, 1.52)
aim.parent = model

parts = []
parts.append(add_ico("FrostCore", (0, 0, 0.55), 0.5, ice_light, 1, (1.0, 1.0, 1.15)))
parts.append(add_torus("CoreBand", (0, 0, 0.55), 0.7, 0.055, iron, 12, 4, (math.pi / 2, 0, 0)))
parts.append(add_crystal("CrownSpire", (0, 0, 0.58), 0.5, 2.05, ice, 6, math.pi / 6))
for index in range(5):
    angle = index * math.tau / 5 + 0.2
    shard = add_crystal(
        f"OrbitShard{index}",
        (math.cos(angle) * 0.78, math.sin(angle) * 0.78, 0.52 + (index % 2) * 0.12),
        0.18,
        0.82,
        ice_light if index % 2 else ice,
        5,
        angle,
    )
    shard.rotation_euler = (math.cos(angle) * 0.24, math.sin(angle) * 0.24, 0)
    parts.append(shard)
for part in parts:
    parent(part, aim)

export_glb("tower-frost.glb", model)
