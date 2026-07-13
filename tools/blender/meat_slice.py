"""Generate the collectible low-poly bone-in meat slice."""

import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import *


reset_scene()
model = root("MeatSlicePickup")

meat = material("Fresh Meat", (0.58, 0.035, 0.025), 0.64)
meat_dark = material("Meat Cut Edge", (0.31, 0.018, 0.012), 0.75)
fat = material("Meat Fat", (0.92, 0.69, 0.48), 0.84)
bone = material("Meat Bone", (0.84, 0.77, 0.61), 0.9)

# The slice stands in the X/Z plane so its silhouette reads from the game camera.
steak = add_cylinder("SteakBody", (0, 0, 0.52), 0.56, 0.24, meat, 9, (math.pi / 2, 0, 0))
steak.scale = (1.32, 1.0, 0.88)
bark = add_torus("SteakEdge", (0, 0.125, 0.52), 0.49, 0.075, meat_dark, 9, 3, (math.pi / 2, 0, 0))
bark.scale = (1.32, 1.0, 0.88)
add_cylinder("MarrowBone", (0.2, 0.16, 0.56), 0.18, 0.07, bone, 8, (math.pi / 2, 0, 0))
add_torus("BoneRim", (0.2, 0.202, 0.56), 0.17, 0.035, fat, 8, 3, (math.pi / 2, 0, 0))
add_beam("MarblingA", (-0.36, 0.19, 0.65), (-0.08, 0.19, 0.42), 0.035, fat, 5)
add_beam("MarblingB", (-0.24, 0.19, 0.34), (-0.03, 0.19, 0.26), 0.027, fat, 5)
add_ico("FatCap", (-0.45, 0.13, 0.68), 0.17, fat, 1, (1.5, 0.7, 0.48))

export_glb("meat-slice.glb", model)
