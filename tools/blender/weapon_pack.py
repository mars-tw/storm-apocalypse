"""Build the three replaceable weapon GLBs used by gameplay and the R6 UI kit."""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from blender_utils import *


def build_machete():
    reset_scene()
    model = root("StormMacheteR6")
    iron = material("Weapon Iron", (0.19, 0.23, 0.24), 0.34, 0.72)
    edge = material("Weapon Edge", (0.46, 0.52, 0.52), 0.22, 0.82)
    leather = material("Weapon Leather", (0.19, 0.075, 0.03), 0.92)
    grip = add_cylinder("MacheteGrip", (0, 0.28, 0), 0.07, 0.56, leather, 8, (math.pi / 2, 0, 0))
    grip.parent = model
    guard = add_box("MacheteGuard", (0, 0.58, 0), (0.34, 0.07, 0.12), iron)
    guard.parent = model
    blade = add_prism(
        "MacheteBlade",
        [
            (-0.09, 0.58, -0.035), (0.09, 0.58, -0.035), (0.13, 1.72, -0.035), (-0.2, 1.58, -0.035),
            (-0.09, 0.58, 0.035), (0.09, 0.58, 0.035), (0.13, 1.72, 0.035), (-0.2, 1.58, 0.035),
        ],
        [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)],
        iron,
    )
    blade.parent = model
    cutting_edge = add_box("MacheteCuttingEdge", (-0.115, 1.18, -0.048), (0.035, 0.96, 0.025), edge, (0, 0, -0.045))
    cutting_edge.parent = model
    return model


def build_axe():
    reset_scene()
    model = root("StormAxeR6")
    iron = material("Weapon Iron", (0.17, 0.22, 0.23), 0.38, 0.7)
    edge = material("Weapon Edge", (0.48, 0.55, 0.55), 0.2, 0.86)
    wood = material("Weapon Ash Wood", (0.31, 0.13, 0.045), 0.91)
    wrap = material("Weapon Red Wrap", (0.35, 0.045, 0.035), 0.86)
    handle = add_cylinder("AxeHandle", (0, 0.82, 0), 0.065, 1.64, wood, 9, (math.pi / 2, 0, 0))
    handle.parent = model
    for index in range(4):
        ring = add_torus("AxeGripWrap%d" % index, (0, 0.17 + index * 0.11, 0), 0.071, 0.016, wrap, 10, 3, (math.pi / 2, 0, 0))
        ring.parent = model
    head = add_prism(
        "AxeHead",
        [
            (-0.08, 1.45, -0.08), (0.5, 1.58, -0.08), (0.7, 1.94, -0.08), (-0.04, 1.88, -0.08),
            (-0.08, 1.45, 0.08), (0.5, 1.58, 0.08), (0.7, 1.94, 0.08), (-0.04, 1.88, 0.08),
        ],
        [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)],
        iron,
    )
    head.parent = model
    blade = add_box("AxeEdge", (0.64, 1.78, 0), (0.055, 0.46, 0.19), edge, (0, 0, -0.18))
    blade.parent = model
    return model


def build_smg():
    reset_scene()
    model = root("StormSmgR6")
    iron = material("Weapon Gunmetal", (0.08, 0.105, 0.11), 0.3, 0.78)
    steel = material("Weapon Bolt Steel", (0.29, 0.34, 0.34), 0.26, 0.82)
    wood = material("Weapon Dark Stock", (0.24, 0.09, 0.035), 0.86)
    red = material("Weapon Sight", (0.5, 0.045, 0.02), 0.4, 0.18, (0.7, 0.015, 0.002), 1.4)
    body = add_box("SmgReceiver", (0, 0.78, 0), (0.42, 0.78, 0.3), iron, (0, 0, -0.03))
    body.parent = model
    barrel = add_cylinder("SmgBarrel", (0, 1.47, 0), 0.055, 0.82, steel, 10, (math.pi / 2, 0, 0))
    barrel.parent = model
    shroud = add_cylinder("SmgBarrelShroud", (0, 1.25, 0), 0.1, 0.42, iron, 10, (math.pi / 2, 0, 0))
    shroud.parent = model
    stock = add_box("SmgStock", (0, 0.25, 0), (0.28, 0.62, 0.25), wood, (0, 0, 0.12))
    stock.parent = model
    magazine = add_box("SmgMagazine", (0.02, 0.64, -0.34), (0.23, 0.54, 0.2), steel, (-0.16, 0, 0.03))
    magazine.parent = model
    sight = add_box("SmgSight", (0, 1.02, 0.22), (0.1, 0.16, 0.11), red)
    sight.parent = model
    trigger_guard = add_torus("SmgTriggerGuard", (0, 0.54, -0.17), 0.13, 0.025, steel, 10, 3, (math.pi / 2, 0, 0))
    trigger_guard.scale.x = 0.65
    trigger_guard.parent = model
    return model


export_glb("weapons/machete.glb", build_machete())
export_glb("weapons/axe.glb", build_axe())
export_glb("weapons/smg.glb", build_smg())
