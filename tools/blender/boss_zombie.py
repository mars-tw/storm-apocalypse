"""Build the R6 articulated plated-brute boss with gameplay clip contract."""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from animated_asset_utils import _finish_action, _key_pose, _new_action, bone_parent, create_humanoid_rig
from blender_utils import *
from hero_rig_factory import _rgb


def bind(obj, rig, bone):
    return bone_parent(obj, rig, bone)


def boss_mat(name, top, bottom, roughness=0.9, metallic=0.0, emission=None, strength=0.0):
    return stylized_material(name, _rgb(top), _rgb(bottom), roughness, metallic, _rgb(emission) if emission else None, strength)


def boss_box(name, location, dimensions, material, rig, bone, rotation=(0, 0, 0), edge=0.035):
    obj = add_box(name, location, dimensions, material, rotation)
    bevel(obj, min(edge, min(dimensions) * 0.18), 2)
    return bind(obj, rig, bone)


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
    model = root("PlatedBruteBossR8")
    rig, joints = create_humanoid_rig(model, 4.15, 2.35, 1.52)

    skin = boss_mat("R8 Boss Dead Skin", "#526A45", "#202C1D", 0.94)
    wounds = boss_mat("R8 Boss Wounds", "#8E2430", "#35070D", 0.76)
    cloth = boss_mat("R8 Boss Oxblood Cloth", "#672C27", "#28100E", 0.97)
    iron = boss_mat("R8 Boss Scrap Armor", "#596566", "#202829", 0.34, 0.82)
    rust = boss_mat("R8 Boss Rust", "#B35426", "#521B09", 0.62, 0.34)
    scratch = boss_mat("R8 Metal Scratch", "#D8E2DC", "#738080", 0.2, 0.82)
    bone = boss_mat("R8 Boss Bone", "#D1C49B", "#706447", 0.93)
    eye = boss_mat("R8 Boss Ember Eye", "#FF4A16", "#791006", 0.34, 0.0, "#FF2608", 4.0)
    core = boss_mat("R8 Boss Furnace Core", "#F18B24", "#8B2308", 0.45, 0.12, "#FF3E0A", 3.2)

    for suffix, sign in (("L", -1), ("R", 1)):
        leg_x = sign * joints["leg_x"]
        bind(add_beam(f"BossThigh{suffix}", (leg_x, 0, joints["hip_z"]), (leg_x, 0.03, joints["knee_z"]), 0.31, wounds, 12), rig, f"thigh.{suffix}")
        bind(add_beam(f"BossShin{suffix}", (leg_x, 0.03, joints["knee_z"]), (leg_x, 0.08, joints["ankle_z"]), 0.28, skin, 12), rig, f"shin.{suffix}")
        bind(add_cylinder(f"BossBoot{suffix}", (leg_x, 0.20, joints["ankle_z"]), 0.36, 0.82, cloth, 12, (math.pi / 2, 0, 0)), rig, f"foot.{suffix}")
        boss_box(f"BossBootPlate{suffix}", (leg_x, 0.33, joints["ankle_z"] + 0.08), (0.62, 0.42, 0.30), iron, rig, f"foot.{suffix}", (0.04, 0, sign * 0.03), 0.045)
        bind(add_beam(f"BossUpperArm{suffix}", (sign * joints["shoulder_x"], 0, joints["shoulder_z"]), (sign * joints["elbow_x"], 0.04, joints["elbow_z"]), 0.32, skin, 12), rig, f"upper_arm.{suffix}")
        bind(add_beam(f"BossForearm{suffix}", (sign * joints["elbow_x"], 0.04, joints["elbow_z"]), (sign * joints["hand_x"], 0.14, joints["hand_z"]), 0.29, wounds, 12), rig, f"forearm.{suffix}")
        bind(add_ico(f"BossFist{suffix}", (sign * joints["hand_x"], 0.15, joints["hand_z"]), 0.39, wounds, 3, (0.9, 0.78, 1.22)), rig, f"hand.{suffix}")
        bind(add_cone(f"ShoulderPlate{suffix}", (sign * joints["shoulder_x"], 0, joints["shoulder_z"] + 0.17), 0.70 if suffix == "R" else 0.61, 0.38, 0.56, iron, 12, (0, math.pi / 2, 0)), rig, f"upper_arm.{suffix}")
        bind(add_cone(f"ShoulderSpike{suffix}", (sign * (joints["shoulder_x"] + 0.14), 0, joints["shoulder_z"] + 0.72), 0.18, 0.0, 0.78 if suffix == "R" else 0.62, bone, 9, (0, sign * math.radians(18), 0)), rig, f"upper_arm.{suffix}")
        for claw in (-1, 0, 1):
            bind(add_cone(f"BossKnuckleSpike{suffix}{claw}", (sign * joints["hand_x"] + claw * 0.11, 0.38, joints["hand_z"] + 0.06), 0.06, 0, 0.24, bone, 7, (math.pi / 2, 0, 0)), rig, f"hand.{suffix}")

    boss_box("BossPelvis", (0, 0, joints["hip_z"] + 0.24), (1.62, 0.90, 0.70), cloth, rig, "pelvis", edge=0.065)
    bind(add_ico("BossTorso", (0, 0, 2.72), 1.14, skin, 3, (1.22, 0.75, 1.22)), rig, "chest")
    boss_box("BossChestPlate", (0, 0.80, 2.76), (1.92, 0.20, 1.62), iron, rig, "chest", (math.radians(-4), 0, math.radians(3)), 0.075)
    boss_box("BossChestRustPatch", (-0.42, 0.93, 2.88), (0.72, 0.05, 0.54), rust, rig, "chest", (math.radians(-4), 0, math.radians(-8)), 0.018)
    boss_box("BossBackPlate", (0, -0.70, 2.70), (1.72, 0.18, 1.45), iron, rig, "chest", (math.radians(3), 0, math.radians(-4)), 0.065)
    bind(add_ico("BossHead", (0.10, 0.04, joints["head_z"]), 0.66, skin, 3, (1.03, 0.93, 1.1)), rig, "head")
    boss_box("BossJaw", (0.12, 0.56, joints["head_z"] - 0.28), (0.78, 0.44, 0.34), wounds, rig, "head", (math.radians(-6), 0, 0), 0.048)
    for side in (-1, 1):
        bind(add_ico(f"BossEye{side}", (side * 0.23 + 0.10, 0.62, joints["head_z"] + 0.15), 0.09, eye, 2, (1, 0.45, 0.85)), rig, "head")
    for index, x in enumerate((-0.66, 0, 0.66)):
        bind(add_cylinder(f"ArmorBolt{index}", (x, 0.94, 3.12), 0.085, 0.09, rust, 10, (math.pi / 2, 0, 0)), rig, "chest")

    # The exposed furnace cage is the R8 boss read: emissive core behind an
    # asymmetric rebar grille, visible from gameplay distance.
    bind(add_ico("BossFurnaceCore", (0.20, 0.96, 2.62), 0.34, core, 2, (0.9, 0.38, 1.18)), rig, "chest")
    for index, x in enumerate((-0.16, 0.02, 0.20, 0.38, 0.56)):
        bind(add_beam(f"BossChestGrille{index}", (x, 1.02, 2.17), (x - 0.06, 1.02, 3.02), 0.034, iron, 9), rig, "chest")
    bind(add_beam("BossChestGrilleTop", (-0.23, 1.02, 3.02), (0.63, 1.02, 3.02), 0.044, rust, 10), rig, "chest")
    bind(add_beam("BossChestGrilleBottom", (-0.16, 1.02, 2.18), (0.55, 1.02, 2.18), 0.044, rust, 10), rig, "chest")
    # Rebar crown/exhausts enlarge the vertical silhouette.
    for index, x in enumerate((-0.55, -0.18, 0.28, 0.62)):
        height = 0.70 + (index % 2) * 0.28
        bind(add_beam(f"BossBackRebar{index}", (x, -0.66, 3.15), (x + (index - 1.5) * 0.08, -0.68, 3.15 + height), 0.055, iron, 10), rig, "chest")
        bind(add_cone(f"BossBackRebarTip{index}", (x + (index - 1.5) * 0.08, -0.68, 3.22 + height), 0.09, 0, 0.30, rust, 8), rig, "chest")
    # Hanging chain and trophy hooks swing with the chest animation.
    for index in range(6):
        side = -1 if index % 2 == 0 else 1
        bind(add_torus(f"BossChainLink{index}", (-0.90 + index * 0.05, 0.16, 2.52 - index * 0.22), 0.10, 0.025, rust, 10, 3, (math.pi / 2, side * 0.35, 0)), rig, "chest")
    bind(add_cone("BossChainHook", (-0.62, 0.18, 1.26), 0.11, 0, 0.42, scratch, 9, (0, math.pi / 2, 0)), rig, "chest")
    for index, x in enumerate((-0.18, 0.02, 0.22, 0.40)):
        boss_box(f"BossTooth{index}", (x, 0.80, joints["head_z"] - 0.26 - (index % 2) * 0.03), (0.075, 0.05, 0.16), bone, rig, "head", (0, 0, (index - 1.5) * 0.06), 0.008)
    # Diagonal bright scratches stop the armor reading as a flat grey slab.
    bind(add_beam("BossArmorScratchA", (-0.70, 1.02, 3.15), (-0.34, 1.02, 2.82), 0.018, scratch, 6), rig, "chest")
    bind(add_beam("BossArmorScratchB", (-0.58, 1.02, 3.20), (-0.22, 1.02, 2.88), 0.013, scratch, 6), rig, "chest")

    boss_actions(rig)
    return model


export_glb("boss-zombie.glb", build_boss(), character_forward=True)
