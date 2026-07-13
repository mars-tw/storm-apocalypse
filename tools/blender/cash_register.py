"""Generate a compact timber checkout cabinet, vintage register and lamp."""

import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import *


reset_scene()
model = root("CashRegisterCounter")

dark_wood = material("Checkout Dark Wood", (0.16, 0.065, 0.03), 0.92)
wood = material("Checkout Cedar", (0.43, 0.19, 0.075), 0.86)
edge = material("Worn Wood Edge", (0.63, 0.35, 0.14), 0.8)
iron = material("Register Iron", (0.13, 0.15, 0.145), 0.48, 0.58)
brass = material("Register Brass", (0.56, 0.32, 0.08), 0.4, 0.62)
paper = material("Receipt Paper", (0.82, 0.73, 0.57), 0.94)
amber = material("Counter Lamp Glow", (0.96, 0.42, 0.06), 0.3, 0.0, (1.0, 0.18, 0.02), 3.5)

# Cabinet and its visible front joinery.
add_box("Cabinet", (0, 0, 0.58), (1.75, 0.92, 1.16), wood)
add_box("CounterSlab", (0, 0, 1.21), (1.96, 1.08, 0.16), edge)
add_box("Drawer", (0, 0.475, 0.76), (1.46, 0.075, 0.42), dark_wood)
add_cylinder("DrawerPull", (0, 0.555, 0.75), 0.08, 0.08, brass, 8, (math.pi / 2, 0, 0))

# Old mechanical register with a stepped body and chunky keys.
add_box("RegisterBase", (-0.2, 0.0, 1.36), (1.05, 0.62, 0.22), iron)
register_body = add_box("RegisterBody", (-0.2, -0.035, 1.62), (0.88, 0.52, 0.44), iron, (math.radians(-8), 0, 0))
add_box("RegisterDisplay", (-0.2, -0.05, 1.98), (0.72, 0.18, 0.32), brass)
add_box("RegisterDisplayFace", (-0.2, 0.048, 1.98), (0.5, 0.03, 0.17), dark_wood)
for index, x in enumerate((-0.45, -0.2, 0.05)):
    add_box(f"Key{index}", (x, 0.3, 1.59), (0.14, 0.12, 0.095), paper)
add_beam("Crank", (0.36, -0.02, 1.68), (0.65, -0.02, 1.68), 0.035, brass, 6)
add_cylinder("CrankHandle", (0.7, -0.02, 1.58), 0.055, 0.24, dark_wood, 7)

# Bent iron lamp with a broad amber shade.
add_beam("LampPost", (0.69, -0.25, 1.3), (0.69, -0.25, 2.25), 0.035, iron, 7)
add_beam("LampNeck", (0.69, -0.25, 2.25), (0.43, -0.02, 2.35), 0.035, iron, 7)
add_cone("LampShade", (0.36, 0.05, 2.26), 0.27, 0.12, 0.24, brass, 9, (math.radians(12), 0, 0))
add_ico("LampBulb", (0.36, 0.1, 2.17), 0.095, amber, 1)

export_glb("cash-register.glb", model)
