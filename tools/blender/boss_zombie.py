"""Generate the original plated brute boss zombie variant."""

import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import *


reset_scene()
model = root("PlatedBruteBoss")

skin = material("Boss Dead Skin", (0.25, 0.38, 0.22), 0.9)
skin_dark = material("Boss Wounds", (0.28, 0.045, 0.035), 0.78)
cloth = material("Boss Cloth", (0.19, 0.075, 0.045), 0.96)
iron = material("Boss Scrap Armor", (0.15, 0.18, 0.17), 0.5, 0.58)
rust = material("Boss Rust", (0.48, 0.18, 0.045), 0.72, 0.26)
bone = material("Boss Bone", (0.72, 0.66, 0.48), 0.92)
eye = material("Boss Ember Eye", (0.9, 0.1, 0.02), 0.4, 0.0, (1.0, 0.025, 0.002), 3.5)

# Broad, uneven body; all primitives are intentionally faceted.
for side in (-1, 1):
    add_cylinder(f"BossBoot{side}", (side * 0.38, 0.04, 0.38), 0.28, 0.76, cloth, 7)
    leg = add_cylinder(f"BossLeg{side}", (side * 0.34, 0, 1.05), 0.25, 0.78, skin_dark, 7)
    leg.rotation_euler.x = side * math.radians(5)
add_ico("BossTorso", (0, 0, 2.15), 0.93, skin, 1, (1.15, 0.72, 1.25))
add_box("BossBelt", (0, 0.06, 1.55), (1.5, 0.78, 0.26), cloth, (0, 0, math.radians(-4)))
add_ico("BossHead", (0.08, 0.04, 3.35), 0.57, skin, 1, (1.0, 0.92, 1.08))
add_box("BossJaw", (0.1, 0.48, 3.12), (0.66, 0.38, 0.28), skin_dark, (math.radians(-6), 0, 0))
for side in (-1, 1):
    add_ico(f"BossEye{side}", (side * 0.2 + 0.08, 0.53, 3.49), 0.075, eye, 1)
    add_beam(f"BossArm{side}", (side * 0.82, 0, 2.7), (side * 1.12, 0.18, 1.72), 0.25, skin, 7)
    add_ico(f"BossFist{side}", (side * 1.14, 0.2, 1.55), 0.34, skin_dark, 1, (0.85, 0.78, 1.2))

# Asymmetric bolted scrap plates make the boss legible at long range.
add_box("BossChestPlate", (0, 0.69, 2.35), (1.55, 0.18, 1.35), iron, (math.radians(-4), 0, math.radians(3)))
add_box("BossChestRustPatch", (-0.33, 0.8, 2.48), (0.58, 0.04, 0.42), rust, (math.radians(-4), 0, math.radians(-8)))
for side in (-1, 1):
    add_cone(f"ShoulderPlate{side}", (side * 0.93, 0, 2.82), 0.58, 0.35, 0.48, iron, 7, (0, math.pi / 2, 0))
    add_cone(f"ShoulderSpike{side}", (side * 1.08, 0, 3.28), 0.16, 0.0, 0.62, bone, 6, (0, side * math.radians(18), 0))
for index, x in enumerate((-0.55, 0, 0.55)):
    add_cylinder(f"ArmorBolt{index}", (x, 0.8, 2.72), 0.07, 0.08, rust, 7, (math.pi / 2, 0, 0))
add_box("BackPlate", (0, -0.62, 2.25), (1.42, 0.16, 1.18), iron, (math.radians(3), 0, math.radians(-4)))

export_glb("boss-zombie.glb", model, character_forward=True)
