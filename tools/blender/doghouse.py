"""Generate the shepherd's warm timber shelter."""

import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import *


reset_scene()
model = root("ShepherdDoghouse")

dark_wood = material("Doghouse Dark Timber", (0.15, 0.065, 0.032), 0.94)
wood = material("Doghouse Pine", (0.48, 0.23, 0.085), 0.9)
wood_light = material("Doghouse Trim", (0.66, 0.38, 0.16), 0.84)
roof = material("Doghouse Red Roof", (0.39, 0.055, 0.035), 0.93)
snow = material("Doghouse Snow", (0.72, 0.82, 0.82), 1.0)
inside = material("Doghouse Interior", (0.035, 0.025, 0.02), 1.0)
brass = material("Dog Tag", (0.72, 0.39, 0.08), 0.5, 0.35)

# Floor runners keep the shelter above the snow.
for x in (-0.72, 0.72):
    add_box(f"Runner{x}", (x, 0, 0.12), (0.22, 2.0, 0.24), dark_wood)
add_box("DoghouseFloor", (0, 0, 0.3), (1.9, 1.75, 0.18), wood)
add_box("BackWall", (0, -0.78, 1.14), (1.86, 0.16, 1.55), wood)
add_box("LeftWall", (-0.84, 0.02, 1.12), (0.18, 1.55, 1.5), wood)
add_box("RightWall", (0.84, 0.02, 1.12), (0.18, 1.55, 1.5), wood)
add_box("FrontLintel", (0, 0.78, 1.62), (1.86, 0.16, 0.5), wood)
add_box("DoorDark", (0, 0.87, 0.86), (0.86, 0.05, 1.08), inside)
add_cylinder("DoorArchDark", (0, 0.88, 1.38), 0.43, 0.055, inside, 12, (math.pi / 2, 0, 0))

# Timber frame around the entry and plank seams.
for x in (-0.54, 0.54):
    add_box(f"DoorPost{x}", (x, 0.9, 0.98), (0.13, 0.13, 1.4), dark_wood)
add_beam("DoorArchLeft", (-0.54, 0.9, 1.6), (-0.18, 0.9, 1.88), 0.075, dark_wood, 6)
add_beam("DoorArchRight", (0.54, 0.9, 1.6), (0.18, 0.9, 1.88), 0.075, dark_wood, 6)
for x in (-0.55, 0, 0.55):
    add_box(f"BackPlankSeam{x}", (x, -0.87, 1.12), (0.035, 0.035, 1.35), dark_wood)

# A chunky red roof with a light snow cap.
add_roof_prism("RedRoof", (0, -0.03, 1.78), 2.35, 2.15, 0.0, 0.8, roof)
snow_cap = add_roof_prism("SnowCap", (0, -0.03, 1.83), 2.42, 2.2, 0.0, 0.82, snow)
snow_cap.scale.y = 0.42
snow_cap.location.y = -0.62

# Bone-shaped brass name plate.
add_box("NamePlate", (0, 0.95, 2.12), (0.82, 0.07, 0.29), dark_wood)
add_beam("BoneBar", (-0.22, 1.0, 2.12), (0.22, 1.0, 2.12), 0.055, brass, 6)
for index, x in enumerate((-0.29, 0.29)):
    add_ico(f"BoneKnuckle{index}", (x, 1.0, 2.12), 0.1, brass, 1, (0.72, 0.42, 1.0))

export_glb("doghouse.glb", model)
