"""Generate the warm post-apocalypse butcher stall."""

import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import *


reset_scene()
model = root("ButcherStall")

dark_wood = material("Charred Timber", (0.18, 0.075, 0.035), 0.92)
wood = material("Warm Cedar", (0.38, 0.17, 0.07), 0.88)
wood_light = material("Worn Counter", (0.58, 0.31, 0.13), 0.82)
red = material("Storm Red Canvas", (0.48, 0.035, 0.025), 0.9)
cream = material("Canvas Stripe", (0.82, 0.68, 0.47), 0.95)
iron = material("Black Iron", (0.09, 0.105, 0.105), 0.58, 0.55)
meat = material("Cured Meat", (0.47, 0.045, 0.03), 0.72)
fat = material("Salted Fat", (0.88, 0.67, 0.43), 0.86)
gold = material("Price Paint", (0.88, 0.52, 0.11), 0.62, 0.08)

# Raised timber floor and a substantial counter silhouette.
add_box("Floor", (0, 0.0, 0.16), (4.9, 2.35, 0.32), dark_wood)
for x in (-2.18, -0.72, 0.72, 2.18):
    add_box(f"FloorPlank{x}", (x, -0.02, 0.34), (1.36, 2.2, 0.08), wood)
add_box("CounterFront", (0, 0.79, 0.88), (4.65, 0.48, 1.18), wood)
add_box("CounterTop", (0, 0.68, 1.54), (4.9, 0.82, 0.18), wood_light)
for x in (-1.52, 0.0, 1.52):
    add_box(f"CounterBrace{x}", (x, 1.045, 0.88), (0.12, 0.08, 1.02), dark_wood)

# Back posts and overhead hanging rail.
for x in (-2.22, 2.22):
    add_box(f"CanopyPost{x}", (x, -0.62, 1.88), (0.18, 0.18, 3.34), dark_wood)
    add_beam(f"PostBrace{x}", (x, -0.62, 2.55), (x * 0.72, 0.45, 2.92), 0.075, wood, 6)
add_beam("MeatRail", (-1.85, -0.42, 2.38), (1.85, -0.42, 2.38), 0.065, iron, 8)
for index, x in enumerate((-1.25, -0.38, 0.56)):
    add_beam(f"HookDrop{index}", (x, -0.42, 2.38), (x, -0.42, 2.05), 0.025, iron, 6)
    add_torus(f"Hook{index}", (x, -0.42, 2.0), 0.105, 0.025, iron, 8, 3, (math.pi / 2, 0, 0))
    ham = add_ico(f"HangingHam{index}", (x, -0.43, 1.76), 0.29, meat, 1, (0.72, 0.48, 1.25))
    ham.rotation_euler.z = (-0.1, 0.13, -0.08)[index]
    add_cone(f"HamFat{index}", (x, -0.43, 1.48), 0.17, 0.12, 0.14, fat, 7)

# Seven chunky canvas slats read as red/white stripes at game distance.
stripe_width = 4.98 / 7
for index in range(7):
    x = -2.49 + stripe_width * (index + 0.5)
    slat = add_box(f"CanopyStripe{index}", (x, -0.02, 3.32), (stripe_width + 0.025, 2.45, 0.11), red if index % 2 == 0 else cream, (-0.13, 0, 0))
add_box("CanopyFrontBar", (0, 1.11, 3.15), (5.08, 0.14, 0.19), dark_wood, (-0.13, 0, 0))

# Price board with a coin glyph and physical tally marks instead of a texture.
add_box("PriceBoard", (-1.62, 1.065, 2.24), (1.36, 0.09, 0.72), dark_wood, (math.radians(-4), 0, 0))
add_cylinder("PriceCoin", (-1.96, 1.125, 2.25), 0.21, 0.055, gold, 10, (math.pi / 2, 0, 0))
for index, z in enumerate((2.08, 2.26, 2.44)):
    add_box(f"PriceMark{index}", (-1.42, 1.12, z), (0.42 - index * 0.06, 0.04, 0.065), cream)

# A tiny warm lamp makes the stall feel inhabited without relying on a texture.
add_beam("LampArm", (1.65, -0.58, 2.75), (1.65, 0.08, 2.67), 0.035, iron, 6)
lamp_glow = material("Amber Lamp", (0.95, 0.38, 0.04), 0.35, 0.0, (1.0, 0.16, 0.015), 3.0)
add_ico("LampBulb", (1.65, 0.1, 2.57), 0.115, lamp_glow, 1, (1, 1, 1.15))

export_glb("butcher-stall.glb", model)
