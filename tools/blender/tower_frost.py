"""R2 frost tower with attack-only crystal orbit and energy pulse."""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from animated_asset_utils import create_object_clip
from blender_utils import *


reset_scene()
model = root("FrostCrystalTowerR2")

stone = material("Frost Slate", (0.115, 0.21, 0.28), 0.88, 0.07)
snow = material("Packed Frost", (0.53, 0.74, 0.81), 0.84)
ice = material("Ancient Ice", (0.14, 0.58, 0.82), 0.25, 0.05, (0.035, 0.3, 0.68), 1.55)
ice_light = material("Frost Core", (0.4, 0.9, 1.0), 0.16, 0.0, (0.07, 0.67, 1.0), 4.4)
iron = material("Frost Bands", (0.095, 0.23, 0.31), 0.48, 0.45)

# Broad rune dais with a stepped plinth and frozen buttresses.
add_cylinder("FrostBase", (0, 0, 0.18), 1.42, 0.36, stone, 10)
add_cylinder("SnowStep", (0, 0, 0.44), 1.18, 0.2, snow, 10)
add_cylinder("RuneDisc", (0, 0, 0.56), 0.92, 0.045, ice_light, 12)
add_cone("SlatePlinth", (0, 0, 1.03), 0.91, 0.55, 0.98, stone, 8)
for index in range(6):
    angle = index * math.tau / 6 + math.pi / 6
    add_box(
        f"FrostRune{index}",
        (math.cos(angle) * 0.69, math.sin(angle) * 0.69, 0.59),
        (0.38, 0.065, 0.035), ice_light, (0, 0, angle),
    )
for index in range(6):
    angle = index * math.tau / 6 + math.pi / 6
    shard = add_crystal(
        f"GroundShard{index}",
        (math.cos(angle) * 0.87, math.sin(angle) * 0.87, 0.39),
        0.19,
        0.86 + (index % 3) * 0.2,
        ice if index % 2 else ice_light,
        5,
        angle,
    )
    shard.rotation_euler = (math.cos(angle) * 0.16, math.sin(angle) * 0.16, 0)

aim = root("AimPivot")
aim.location = (0, 0, 1.54)
aim.parent = model
pulse = root("FrostPulse")
pulse.parent = aim
orbit = root("FrostOrbit")
orbit.parent = aim

core = add_ico("FrostCore", (0, 0, 0.55), 0.52, ice_light, 1, (1.0, 1.0, 1.16))
core.parent = pulse
band_a = add_torus("CoreBandA", (0, 0, 0.55), 0.7, 0.052, iron, 12, 4, (math.pi / 2, 0, 0))
band_a.parent = pulse
band_b = add_torus("CoreBandB", (0, 0, 0.55), 0.66, 0.042, ice_light, 12, 3, (0, math.pi / 2, 0))
band_b.parent = pulse
spire = add_crystal("CrownSpire", (0, 0, 0.57), 0.49, 2.12, ice, 6, math.pi / 6)
spire.parent = pulse
for index in range(6):
    angle = index * math.tau / 6 + 0.16
    shard = add_crystal(
        f"OrbitShard{index}",
        (math.cos(angle) * 0.87, math.sin(angle) * 0.87, 0.45 + (index % 2) * 0.22),
        0.17,
        0.76 + (index % 3) * 0.12,
        ice_light if index % 2 else ice,
        5,
        angle,
    )
    shard.rotation_euler = (math.cos(angle) * 0.3, math.sin(angle) * 0.3, -angle * 0.15)
    shard.parent = orbit

create_object_clip(orbit, "attack", [
    (1, {"rotation": (0, 0, 0), "scale": (1, 1, 1)}),
    (8, {"rotation": (0, 0, math.pi * 0.9), "scale": (1.08, 1.08, 1.08)}),
    (14, {"rotation": (0, 0, math.pi * 1.8), "scale": (1.2, 1.2, 1.2)}),
    (24, {"rotation": (0, 0, math.pi * 2), "scale": (1, 1, 1)}),
])
create_object_clip(pulse, "attack", [
    (1, {"scale": (1, 1, 1), "rotation": (0, 0, 0)}),
    (7, {"scale": (1.08, 1.08, 1.16), "rotation": (0, 0, -0.12)}),
    (12, {"scale": (1.34, 1.34, 1.42), "rotation": (0, 0, 0.18)}),
    (16, {"scale": (0.9, 0.9, 0.94), "rotation": (0, 0, 0)}),
    (24, {"scale": (1, 1, 1), "rotation": (0, 0, 0)}),
])

export_glb("tower-frost.glb", model)
