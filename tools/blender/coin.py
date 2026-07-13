"""Generate the chunky in-world Northwind coin."""

import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_utils import *


reset_scene()
model = root("NorthwindCoin")

gold = material("Coin Gold", (0.86, 0.48, 0.07), 0.34, 0.68)
gold_dark = material("Coin Recess", (0.42, 0.19, 0.025), 0.5, 0.48)
gold_light = material("Coin Mark", (1.0, 0.67, 0.14), 0.3, 0.62)

add_cylinder("CoinBody", (0, 0, 0.52), 0.52, 0.13, gold, 12, (math.pi / 2, 0, 0))
add_torus("CoinRimFront", (0, 0.076, 0.52), 0.43, 0.055, gold_light, 12, 3, (math.pi / 2, 0, 0))
add_torus("CoinRimBack", (0, -0.076, 0.52), 0.43, 0.055, gold_dark, 12, 3, (math.pi / 2, 0, 0))

# Angular N-like mark: leg, diagonal, leg.
add_box("CoinMarkLeft", (-0.16, 0.105, 0.52), (0.075, 0.045, 0.48), gold_light)
diagonal = add_beam("CoinMarkDiagonal", (-0.13, 0.108, 0.72), (0.13, 0.108, 0.32), 0.045, gold_light, 5)
add_box("CoinMarkRight", (0.16, 0.105, 0.52), (0.075, 0.045, 0.48), gold_light)
for index, angle in enumerate(range(0, 360, 90)):
    radians = math.radians(angle)
    add_box(
        f"CoinNotch{index}",
        (math.cos(radians) * 0.46, 0.108, 0.52 + math.sin(radians) * 0.46),
        (0.055, 0.04, 0.075),
        gold_dark,
        (0, 0, -radians),
    )

export_glb("coin.glb", model)
