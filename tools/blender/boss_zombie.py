"""Build the R6 articulated plated-brute boss with gameplay clip contract."""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from animated_asset_utils import _finish_action, _key_pose, _new_action, bone_parent, create_humanoid_rig
from blender_utils import *


def bind(obj, rig, bone):
    return bone_parent(obj, rig, bone)


def boss_actions(rig):
    action = _new_action(rig, "Idle")
    _key_pose(rig, 1, rotations={"spine": (0.04, 0, -0.04), "head": (-0.05, 0.03, 0.05)})
    _key_pose(rig, 18, rotations={"spine": (-0.06, 0.02, 0.05), "chest": (0.045, 0, -0.04), "head": (0.04, -0.02, -0.05)}, locations={"pelvis": (0, 0, 0.035)})
    _key_pose(rig, 36, rotations={"spine": (0.04, 0, -0.04), "head": (-0.05, 0.03, 0.05)})
    _finish_action(rig, action, "Idle", 1, 36)

    action = _new_action(rig, "Walk")
    for frame, side in ((1, 1), (9, 0), (17, -1), (25, 0), (33, 1)):
        if side:
            _key_pose(
                rig,
                frame,
                rotations={
                    "spine": (0.16, 0, -0.08 * side), "chest": (-0.04, 0, 0.1 * side), "head": (-0.08, 0, -0.04 * side),
                    "thigh.L": (0.46 * side, 0, 0.05), "shin.L": (-0.2 * max(side, 0), 0, 0),
                    "thigh.R": (-0.46 * side, 0, -0.05), "shin.R": (0.2 * min(side, 0), 0, 0),
                    "upper_arm.L": (-0.34 * side, 0, -0.12), "forearm.L": (-0.18, 0, 0),
                    "upper_arm.R": (0.34 * side, 0, 0.12), "forearm.R": (-0.18, 0, 0),
                },
                locations={"root": (0, 0, 0.05)},
            )
        else:
            _key_pose(rig, frame, rotations={"spine": (0.12, 0, 0), "thigh.L": (-0.06, 0, 0), "shin.L": (0.3, 0, 0), "thigh.R": (-0.06, 0, 0), "shin.R": (0.3, 0, 0)}, locations={"root": (0, 0, -0.025)})
    _finish_action(rig, action, "Walk", 1, 33)

    # Frames 1-10 anticipation, 11-16 impact, 17-30 recovery.
    action = _new_action(rig, "Idle_Attack")
    _key_pose(rig, 1, rotations={"spine": (0.1, 0, 0)})
    _key_pose(
        rig,
        10,
        rotations={
            "pelvis": (0, 0, 0.14), "spine": (-0.18, 0.12, 0.38), "chest": (-0.12, 0.08, 0.52), "head": (0.04, -0.08, -0.2),
            "upper_arm.R": (-1.62, 0.26, 0.54), "forearm.R": (-0.82, 0.14, 0.18), "upper_arm.L": (-1.2, -0.24, -0.42), "forearm.L": (-0.56, -0.08, -0.15),
            "thigh.R": (-0.16, 0, 0),
        },
        locations={"root": (0, -0.08, 0.02)},
    )
    _key_pose(
        rig,
        15,
        rotations={
            "pelvis": (0, 0, -0.28), "spine": (0.3, -0.1, -0.58), "chest": (0.16, -0.06, -0.7), "head": (-0.12, 0.05, 0.3),
            "upper_arm.R": (1.22, -0.42, -0.68), "forearm.R": (0.48, -0.16, -0.32), "upper_arm.L": (0.92, 0.34, 0.56), "forearm.L": (0.38, 0.1, 0.22),
            "thigh.L": (0.14, 0, 0),
        },
        locations={"root": (0, 0.18, -0.04)},
    )
    _key_pose(rig, 22, rotations={"spine": (0.12, 0, -0.2), "chest": (0.06, 0, -0.22), "upper_arm.R": (0.34, -0.08, -0.2), "upper_arm.L": (0.28, 0.06, 0.18)}, locations={"root": (0, 0.05, 0)})
    _key_pose(rig, 30, rotations={"spine": (0.1, 0, 0)})
    _finish_action(rig, action, "Idle_Attack", 1, 30)

    action = _new_action(rig, "HitReact")
    _key_pose(rig, 1, rotations={"spine": (0.08, 0, 0)})
    _key_pose(rig, 4, rotations={"spine": (-0.28, 0.08, 0.18), "chest": (-0.2, -0.04, 0.2), "head": (0.32, -0.12, -0.2), "upper_arm.L": (-0.45, 0, -0.3), "upper_arm.R": (-0.4, 0, 0.3)}, locations={"root": (0, -0.09, 0.02)})
    _key_pose(rig, 10, rotations={"spine": (0.08, 0, 0)})
    _finish_action(rig, action, "HitReact", 1, 10)

    action = _new_action(rig, "Death")
    _key_pose(rig, 1, rotations={"spine": (0.08, 0, 0)})
    _key_pose(rig, 10, rotations={"pelvis": (0.18, 0, -0.18), "spine": (-0.42, 0.12, 0.34), "chest": (-0.38, 0.08, 0.28), "head": (0.26, -0.12, -0.22), "upper_arm.L": (-0.62, 0.12, -0.42), "upper_arm.R": (0.45, -0.1, 0.36), "thigh.L": (0.35, 0, 0), "thigh.R": (-0.24, 0, 0)}, locations={"root": (0, -0.18, -0.18)})
    _key_pose(rig, 20, rotations={"root": (1.18, 0.12, -0.14), "pelvis": (0.42, 0, -0.2), "spine": (-0.62, 0.08, 0.2), "chest": (-0.5, 0.06, 0.15), "head": (0.42, -0.1, -0.18), "upper_arm.L": (-0.88, 0.12, -0.46), "upper_arm.R": (0.72, -0.12, 0.4), "thigh.L": (0.52, 0, 0), "shin.L": (-0.48, 0, 0), "thigh.R": (-0.34, 0, 0), "shin.R": (0.34, 0, 0)}, locations={"root": (0, 0.14, -1.0)})
    _key_pose(rig, 32, rotations={"root": (1.48, 0.12, -0.16), "pelvis": (0.5, 0, -0.22), "spine": (-0.7, 0.08, 0.16), "chest": (-0.58, 0.05, 0.12), "head": (0.5, -0.08, -0.16), "upper_arm.L": (-0.94, 0.1, -0.48), "upper_arm.R": (0.8, -0.1, 0.42), "thigh.L": (0.58, 0, 0), "shin.L": (-0.54, 0, 0), "thigh.R": (-0.4, 0, 0), "shin.R": (0.4, 0, 0)}, locations={"root": (0, 0.28, -1.42)})
    _finish_action(rig, action, "Death", 1, 32)
    bpy.context.scene.frame_end = 36
    bpy.context.scene.frame_set(1)


def build_boss():
    reset_scene()
    model = root("PlatedBruteBossR6")
    rig, joints = create_humanoid_rig(model, 3.75, 2.05, 1.35)

    skin = material("Boss Dead Skin", (0.25, 0.38, 0.22), 0.9)
    wounds = material("Boss Wounds", (0.28, 0.045, 0.035), 0.78)
    cloth = material("Boss Cloth", (0.19, 0.075, 0.045), 0.96)
    iron = material("Boss Scrap Armor", (0.15, 0.18, 0.17), 0.5, 0.58)
    rust = material("Boss Rust", (0.48, 0.18, 0.045), 0.72, 0.26)
    bone = material("Boss Bone", (0.72, 0.66, 0.48), 0.92)
    eye = material("Boss Ember Eye", (0.9, 0.1, 0.02), 0.4, 0.0, (1.0, 0.025, 0.002), 3.5)

    for suffix, sign in (("L", -1), ("R", 1)):
        leg_x = sign * joints["leg_x"]
        bind(add_beam(f"BossThigh{suffix}", (leg_x, 0, joints["hip_z"]), (leg_x, 0.03, joints["knee_z"]), 0.27, wounds, 8), rig, f"thigh.{suffix}")
        bind(add_beam(f"BossShin{suffix}", (leg_x, 0.03, joints["knee_z"]), (leg_x, 0.08, joints["ankle_z"]), 0.25, skin, 8), rig, f"shin.{suffix}")
        bind(add_cylinder(f"BossBoot{suffix}", (leg_x, 0.18, joints["ankle_z"]), 0.31, 0.72, cloth, 8, (math.pi / 2, 0, 0)), rig, f"foot.{suffix}")
        bind(add_beam(f"BossUpperArm{suffix}", (sign * joints["shoulder_x"], 0, joints["shoulder_z"]), (sign * joints["elbow_x"], 0.04, joints["elbow_z"]), 0.28, skin, 8), rig, f"upper_arm.{suffix}")
        bind(add_beam(f"BossForearm{suffix}", (sign * joints["elbow_x"], 0.04, joints["elbow_z"]), (sign * joints["hand_x"], 0.14, joints["hand_z"]), 0.25, wounds, 8), rig, f"forearm.{suffix}")
        bind(add_ico(f"BossFist{suffix}", (sign * joints["hand_x"], 0.15, joints["hand_z"]), 0.34, wounds, 1, (0.88, 0.78, 1.2)), rig, f"hand.{suffix}")
        bind(add_cone(f"ShoulderPlate{suffix}", (sign * joints["shoulder_x"], 0, joints["shoulder_z"] + 0.14), 0.58, 0.35, 0.48, iron, 7, (0, math.pi / 2, 0)), rig, f"upper_arm.{suffix}")
        bind(add_cone(f"ShoulderSpike{suffix}", (sign * (joints["shoulder_x"] + 0.12), 0, joints["shoulder_z"] + 0.58), 0.16, 0.0, 0.62, bone, 6, (0, sign * math.radians(18), 0)), rig, f"upper_arm.{suffix}")

    bind(add_box("BossPelvis", (0, 0, joints["hip_z"] + 0.22), (1.45, 0.82, 0.62), cloth), rig, "pelvis")
    bind(add_ico("BossTorso", (0, 0, 2.45), 1.0, skin, 1, (1.15, 0.72, 1.18)), rig, "chest")
    bind(add_box("BossChestPlate", (0, 0.72, 2.52), (1.72, 0.18, 1.48), iron, (math.radians(-4), 0, math.radians(3))), rig, "chest")
    bind(add_box("BossChestRustPatch", (-0.36, 0.83, 2.63), (0.62, 0.04, 0.46), rust, (math.radians(-4), 0, math.radians(-8))), rig, "chest")
    bind(add_box("BossBackPlate", (0, -0.62, 2.48), (1.54, 0.16, 1.3), iron, (math.radians(3), 0, math.radians(-4))), rig, "chest")
    bind(add_ico("BossHead", (0.08, 0.04, joints["head_z"]), 0.61, skin, 1, (1.0, 0.92, 1.08)), rig, "head")
    bind(add_box("BossJaw", (0.1, 0.51, joints["head_z"] - 0.25), (0.7, 0.4, 0.3), wounds, (math.radians(-6), 0, 0)), rig, "head")
    for side in (-1, 1):
        bind(add_ico(f"BossEye{side}", (side * 0.21 + 0.08, 0.56, joints["head_z"] + 0.14), 0.08, eye, 1), rig, "head")
    for index, x in enumerate((-0.58, 0, 0.58)):
        bind(add_cylinder(f"ArmorBolt{index}", (x, 0.83, 2.9), 0.075, 0.08, rust, 7, (math.pi / 2, 0, 0)), rig, "chest")

    boss_actions(rig)
    return model


export_glb("boss-zombie.glb", build_boss(), character_forward=True)
