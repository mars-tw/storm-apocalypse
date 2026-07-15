"""Storm R10 normalized staff, anonymous customers, shepherd dog and cow accessories."""

import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from animated_asset_utils import (
    _bone,
    _finish_action,
    _key_pose,
    _new_action,
    _reset_pose,
    bone_parent,
    create_staff_actions,
)
from blender_utils import (
    add_beam,
    add_box,
    add_cone,
    add_cylinder,
    add_ico,
    add_torus,
    export_glb,
    parent_loose,
    reset_scene,
    root,
)
from hero_rig_factory import (
    _beam,
    _box,
    _build_body,
    _cloth_wear,
    _cone,
    _cylinder,
    _face,
    _ico,
    _mat,
    _merge_rigid_character_parts,
    _torus,
)


def _human_materials(prefix, skin, coat, trousers, boots, hair):
    return {
        "skin": _mat(f"R10 {prefix} Skin", skin, 0.69, shadow="#6B4234"),
        "coat": _mat(f"R10 {prefix} Cloth", coat, 0.91, shadow="#19252A"),
        "trousers": _mat(f"R10 {prefix} Trousers", trousers, 0.90, shadow="#10171B"),
        "boots": _mat(f"R10 {prefix} Leather", boots, 0.72, shadow="#160F0C"),
        "hair": _mat(f"R10 {prefix} Hair", hair, 0.85, shadow="#160E0B"),
        "eye_white": _mat("R10 Shared Eye White", "#E6D8C4", 0.62, shadow="#A68C79"),
        "pupil": _mat("R10 Shared Pupil", "#120D0C", 0.54, shadow="#050303"),
        "mouth": _mat("R10 Shared Mouth", "#642E31", 0.78, shadow="#2C1014"),
    }


def build_hunter():
    reset_scene()
    mats = _human_materials("Hunter", "#AD795D", "#3F5144", "#293631", "#3A281E", "#352B25")
    rust = _mat("R10 Hunter Rust Scarf", "#A94B38", 0.89, shadow="#552117")
    leather = _mat("R10 Hunter Saddle Leather", "#754A2D", 0.70, shadow="#382116")
    canvas = _mat("R10 Hunter Canvas", "#9A8056", 0.93, shadow="#554329")
    iron = _mat("R10 Shared Scarred Iron", "#8A999B", 0.31, 0.78, shadow="#343E40")
    brass = _mat("R10 Hunter Brass", "#D89A38", 0.35, 0.65, shadow="#6E471A")
    iris = _mat("R10 Hunter Amber Iris", "#B88439", 0.42, shadow="#513416")
    model, rig, j, head_r = _build_body(
        "NpcHunterR10", 1.78, 0.72, 0.56, mats,
        {"leg_radius": 0.10, "arm_radius": 0.087, "head_scale": (0.96, 0.93, 1.09)},
    )
    _box("HunterCoatHem", (0, -0.01, 0.88), (0.59, 0.41, 0.47), mats["coat"], rig, "spine", edge=0.022)
    _torus("HunterScarf", (0, 0.01, 1.47), 0.245, 0.062, rust, rig, "chest", major_segments=13)
    _box("HunterScarfTail", (-0.30, -0.10, 1.14), (0.15, 0.065, 0.61), rust, rig, "chest", (0.12, -0.10, -0.18), 0.014)
    for index, x in enumerate((-0.23, -0.08, 0.08, 0.23)):
        _ico(f"HunterShearlingCollar{index}", (x, 0.205, 1.45 - abs(x) * 0.16), 0.075, canvas, rig, "chest", (1.15, 0.45, 0.72), 2)
    _ico("HunterHairCap", (0, -0.02, j["head_z"] + head_r * 0.49), head_r * 0.91, mats["hair"], rig, "head", (0.96, 0.92, 0.53), 2)
    _face("Hunter", rig, j, head_r, mats, iris, "steady")
    # Wide field hat and held long rifle own the silhouette at gameplay scale.
    _cylinder("HunterHatBrim", (0, -0.005, j["head_z"] + 0.23), 0.40, 0.055, canvas, rig, "head", 14)
    _cylinder("HunterHatCrown", (0, -0.04, j["head_z"] + 0.36), 0.24, 0.29, canvas, rig, "head", 12)
    _torus("HunterHatBand", (0, -0.04, j["head_z"] + 0.27), 0.245, 0.028, rust, rig, "head", major_segments=12)
    for side in (-1, 1):
        suffix = "L" if side < 0 else "R"
        _box(f"HunterKneeGuard{suffix}", (side * j["leg_x"], 0.105, j["knee_z"]), (0.19, 0.08, 0.17), leather, rig, f"shin.{suffix}", edge=0.015)
    _beam("HunterBandolier", (-0.27, 0.22, 1.43), (0.24, 0.22, 0.91), 0.035, leather, rig, "chest", 8)
    for index in range(5):
        x = -0.15 + index * 0.075
        _cylinder(f"HunterCartridge{index}", (x, 0.265, 1.20 - index * 0.06), 0.018, 0.12, brass, rig, "chest", 7)
    hand = (j["hand_x"], 0.055, j["hand_z"])
    _beam("HunterRifleStock", (hand[0], hand[1], hand[2] - 0.02), (hand[0] - 0.06, hand[1] + 0.10, hand[2] + 0.39), 0.058, leather, rig, "hand.R", 10)
    _beam("HunterRifleBarrel", (hand[0] - 0.05, hand[1] + 0.10, hand[2] + 0.34), (hand[0] - 0.13, hand[1] + 0.24, hand[2] + 1.08), 0.035, iron, rig, "hand.R", 11)
    _cylinder("HunterRifleMuzzle", (hand[0] - 0.14, hand[1] + 0.25, hand[2] + 1.11), 0.052, 0.12, iron, rig, "hand.R", 10, (0.15, 0, 0))
    _box("HunterRifleReceiver", (hand[0] - 0.04, hand[1] + 0.10, hand[2] + 0.43), (0.18, 0.13, 0.24), iron, rig, "hand.R", (0.04, 0, 0), 0.012)
    _box("HunterHipPouch", (-0.34, 0.02, 0.86), (0.28, 0.24, 0.36), canvas, rig, "pelvis", (0.02, 0, -0.08), 0.025)
    _merge_rigid_character_parts(rig, "NpcHunterR10SkinnedMesh")
    create_staff_actions(rig, include_attack=True)
    return model


def build_cashier():
    reset_scene()
    mats = _human_materials("Cashier", "#C58D70", "#405B66", "#323B45", "#3B291F", "#402922")
    apron = _mat("R10 Cashier Oxblood Apron", "#963D45", 0.88, shadow="#4B1820")
    cream = _mat("R10 Cashier Receipt Cream", "#D8CBA7", 0.94, shadow="#8C7956")
    mustard = _mat("R10 Cashier Mustard Accent", "#D3A03D", 0.86, shadow="#72501B")
    leather = _mat("R10 Cashier Leather", "#69442D", 0.72, shadow="#301D12")
    brass = _mat("R10 Cashier Coin Brass", "#DDA43D", 0.32, 0.68, shadow="#75511B")
    graphite = _mat("R10 Cashier Graphite", "#4C5558", 0.43, 0.45, shadow="#21282A")
    iris = _mat("R10 Cashier Hazel Iris", "#748353", 0.42, shadow="#354027")
    model, rig, j, head_r = _build_body(
        "NpcCashierR10", 1.64, 0.67, 0.59, mats,
        {"leg_radius": 0.102, "arm_radius": 0.09, "head_scale": (1.04, 0.96, 1.04)},
    )
    _ico("CashierHairCap", (0, -0.02, j["head_z"] + head_r * 0.51), head_r * 0.94, mats["hair"], rig, "head", (1.05, 0.95, 0.52), 2)
    _ico("CashierHairBun", (-0.19, -0.08, j["head_z"] + 0.09), 0.105, mats["hair"], rig, "head", (0.95, 0.85, 1.15), 2)
    _face("Cashier", rig, j, head_r, mats, iris, "curious")
    _box("CashierApronBib", (0, 0.225, 1.16), (0.50, 0.065, 0.46), apron, rig, "chest", edge=0.018)
    _box("CashierApronSkirt", (0, 0.23, 0.77), (0.62, 0.07, 0.68), apron, rig, "spine", (0.02, 0, 0), 0.018)
    _cloth_wear("CashierApronHem", (0, 0.275, 0.45), (0.54, 0.018, 0.05), cream, rig, "spine")
    for side in (-1, 1):
        _beam(f"CashierApronStrap{side}", (side * 0.20, 0.23, 1.40), (side * 0.29, 0.22, 0.83), 0.020, leather, rig, "chest", 7)
    _box("CashierReceiptPocket", (0.18, 0.285, 0.78), (0.25, 0.035, 0.25), cream, rig, "spine", (0, 0, -0.04), 0.011)
    for index in range(3):
        _box(f"CashierReceipt{index}", (0.15 + index * 0.035, 0.31, 0.94 + index * 0.035), (0.10, 0.012, 0.24), cream, rig, "spine", (0, 0, -0.08 + index * 0.05), 0.004)
    # A waist change tray, coin stacks and pencil make the role readable without UI.
    _box("CashierChangeTray", (-0.31, 0.27, 0.84), (0.31, 0.19, 0.18), graphite, rig, "pelvis", (0.05, 0, 0.04), 0.020)
    for index in range(4):
        _cylinder(f"CashierCoin{index}", (-0.39 + index * 0.055, 0.385, 0.91 + (index % 2) * 0.025), 0.035, 0.018, brass, rig, "pelvis", 9, (math.pi / 2, 0, 0))
    for index, z in enumerate((1.30, 1.18, 1.06)):
        _ico(f"CashierApronButton{index}", (-0.18, 0.275, z), 0.045, brass, rig, "chest", (1.0, 0.35, 1.0), 2)
    _cylinder("CashierPencil", (0.19, 0.02, j["head_z"] + 0.02), 0.015, 0.35, mustard, rig, "head", 7, (0.18, 0.12, 0.18))
    _box("CashierVisor", (0, 0.10, j["head_z"] + 0.25), (0.39, 0.25, 0.075), mustard, rig, "head", (0.08, 0, 0), 0.015)
    _torus("CashierCollar", (0, 0.01, 1.39), 0.24, 0.050, cream, rig, "chest", major_segments=12)
    _merge_rigid_character_parts(rig, "NpcCashierR10SkinnedMesh")
    create_staff_actions(rig)
    return model


def build_customer(variant):
    reset_scene()
    specs = {
        "traveler": ("#B27E61", "#6C4939", "#343B3B", "#30231D", "#352721", "#C75B3C", "#5F7880"),
        "forager": ("#C08A6D", "#3F6662", "#33413D", "#3A281E", "#392821", "#D1A13B", "#A44A43"),
        "refugee": ("#A9765A", "#6A5A3C", "#303A43", "#35251E", "#302621", "#4E7180", "#C86538"),
    }
    skin, coat, trousers, boots, hair, accent_hex, second_hex = specs[variant]
    title = variant.title()
    mats = _human_materials(f"Customer {title}", skin, coat, trousers, boots, hair)
    accent = _mat(f"R10 Customer {title} Accent", accent_hex, 0.90, shadow="#54231B")
    second = _mat(f"R10 Customer {title} Secondary", second_hex, 0.91, shadow="#263B43")
    canvas = _mat("R10 Customer Shared Canvas", "#9A805A", 0.94, shadow="#514129")
    leather = _mat("R10 Customer Shared Leather", "#68422B", 0.71, shadow="#301C11")
    metal = _mat("R10 Shared Scarred Iron", "#8A999B", 0.31, 0.78, shadow="#343E40")
    iris = _mat(f"R10 Customer {title} Iris", "#7A7450", 0.43, shadow="#35311F")
    heights = {"traveler": 1.72, "forager": 1.58, "refugee": 1.81}
    height = heights[variant]
    model, rig, j, head_r = _build_body(
        f"NpcCustomer{title}R10", height, 0.65 if variant != "refugee" else 0.70, 0.55, mats,
        {"leg_radius": 0.098, "arm_radius": 0.085, "head_scale": (1.01, 0.95, 1.06)},
    )
    _ico(f"Customer{title}Hair", (0, -0.02, j["head_z"] + head_r * 0.50), head_r * 0.92, mats["hair"], rig, "head", (1.02, 0.93, 0.53), 2)
    _face(f"Customer{title}", rig, j, head_r, mats, iris, "curious" if variant == "forager" else "steady")
    if variant == "traveler":
        _torus("TravelerScarf", (0, 0.01, height * 0.83), 0.24, 0.060, accent, rig, "chest", major_segments=12)
        _box("TravelerScarfTail", (0.29, -0.10, 1.10), (0.14, 0.06, 0.58), accent, rig, "chest", (0.12, -0.1, 0.16), 0.013)
        _ico("TravelerKnitCap", (0, -0.01, j["head_z"] + 0.18), head_r * 0.94, second, rig, "head", (1.08, 1.0, 0.55), 2)
        _ico("TravelerPomPom", (0.04, -0.01, j["head_z"] + 0.34), 0.07, accent, rig, "head", subdivisions=2)
        _box("TravelerSatchel", (-0.37, -0.02, 0.87), (0.40, 0.26, 0.47), canvas, rig, "pelvis", (0.02, 0, -0.07), 0.027)
        _beam("TravelerSatchelStrap", (-0.42, 0.15, 0.92), (0.23, 0.18, 1.40), 0.028, leather, rig, "chest", 8)
        _cylinder("TravelerThermos", (0.34, -0.24, 0.88), 0.075, 0.42, second, rig, "pelvis", 10)
        for index, (x, z) in enumerate(((-0.20, 1.28), (0.0, 1.26), (0.20, 1.28), (-0.17, 1.05), (0.17, 1.05), (-0.17, 0.82), (0.17, 0.82), (-0.30, 0.75), (0.30, 0.75))):
            _ico(f"TravelerParkaToggle{index}", (x, 0.225, z), 0.042, accent if index < 5 else canvas, rig, "chest" if z > 1.0 else "spine", (1.0, 0.34, 1.0), 2)
    elif variant == "forager":
        _cone("ForagerShoulderShawl", (0, -0.02, 1.19), 0.47, 0.24, 0.58, second, rig, "chest", 12)
        _torus("ForagerEarMuffBand", (0, -0.01, j["head_z"] + 0.08), 0.245, 0.025, accent, rig, "head", (math.pi / 2, 0, 0), 12, 4)
        for side in (-1, 1):
            _cylinder(f"ForagerEarMuff{side}", (side * 0.205, 0, j["head_z"] + 0.02), 0.075, 0.06, accent, rig, "head", 10, (0, math.pi / 2, 0))
        _box("ForagerBasket", (0.37, 0.02, 0.68), (0.44, 0.34, 0.43), canvas, rig, "hand.R", (0, 0, -0.04), 0.025)
        _torus("ForagerBasketHandle", (0.37, 0.02, 0.92), 0.20, 0.026, leather, rig, "hand.R", (math.pi / 2, 0, 0), 12, 4)
        for index, x in enumerate((0.25, 0.37, 0.49)):
            _ico(f"ForagerBundle{index}", (x, 0.02, 0.92 + (index % 2) * 0.06), 0.07, accent if index == 1 else second, rig, "hand.R", subdivisions=2)
        for index, (x, z) in enumerate(((-0.20, 1.32), (0, 1.36), (0.20, 1.32), (-0.25, 1.13), (0.25, 1.13), (0, 1.10))):
            _ico(f"ForagerShawlKnot{index}", (x, 0.245, z), 0.050, accent if index % 2 else canvas, rig, "chest", (1.0, 0.32, 0.9), 2)
    else:
        _cone("RefugeePoncho", (0, -0.03, 1.16), 0.52, 0.27, 0.94, accent, rig, "chest", 12)
        _cloth_wear("RefugeePonchoStripe", (0, 0.25, 1.02), (0.74, 0.025, 0.075), second, rig, "chest", (0, 0, -0.03))
        _cylinder("RefugeeBeanie", (0, -0.01, j["head_z"] + 0.22), 0.23, 0.20, second, rig, "head", 12)
        _box("RefugeeBedrollPack", (0, -0.29, 1.03), (0.60, 0.32, 0.68), canvas, rig, "chest", (0.02, 0, 0), 0.030)
        _cylinder("RefugeeBedroll", (0, -0.31, 1.43), 0.13, 0.56, accent, rig, "chest", 11, (0, math.pi / 2, 0))
        for side in (-1, 1):
            _beam(f"RefugeePackStrap{side}", (side * 0.22, 0.14, 1.31), (side * 0.27, 0.12, 0.78), 0.027, leather, rig, "chest", 8)
        _beam("RefugeeWalkingStick", (-0.39, 0.05, 0.11), (-0.43, 0.10, 1.17), 0.032, leather, rig, "hand.L", 9)
        _cylinder("RefugeeStickCap", (-0.39, 0.05, 0.12), 0.042, 0.10, metal, rig, "hand.L", 8)
        for index, (x, z) in enumerate(((-0.28, 1.36), (0, 1.39), (0.28, 1.36), (-0.31, 1.18), (0.31, 1.18), (-0.33, 0.99), (0.33, 0.99), (-0.28, 0.81), (0.28, 0.81))):
            _ico(f"RefugeePonchoKnot{index}", (x, 0.255, z), 0.045, second if index % 2 else canvas, rig, "chest", (1.0, 0.32, 0.86), 2)
    _merge_rigid_character_parts(rig, f"NpcCustomer{title}R10SkinnedMesh")
    create_staff_actions(rig)
    return model


def _create_dog_rig(model):
    data = bpy.data.armatures.new("StormR10QuadrupedSkeleton")
    rig = bpy.data.objects.new("StormR10ShepherdDogRig", data)
    bpy.context.collection.objects.link(rig)
    rig.parent = model
    rig.show_in_front = True
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    edit = data.edit_bones
    _bone(edit, "root", (0, -0.15, 0.04), (0, -0.15, 0.45))
    _bone(edit, "spine", (0, -0.55, 0.79), (0, 0.28, 0.82), "root")
    _bone(edit, "chest", (0, 0.12, 0.82), (0, 0.55, 0.96), "spine")
    _bone(edit, "neck", (0, 0.48, 0.92), (0, 0.76, 1.12), "chest")
    _bone(edit, "head", (0, 0.72, 1.10), (0, 1.13, 1.18), "neck")
    _bone(edit, "tail.base", (0, -0.52, 0.86), (0, -0.92, 1.05), "spine")
    _bone(edit, "tail.tip", (0, -0.92, 1.05), (0, -1.24, 1.28), "tail.base")
    for suffix, sign in (("L", -1), ("R", 1)):
        for prefix, y, parent in (("front", 0.36, "chest"), ("rear", -0.43, "spine")):
            x = sign * 0.25
            _bone(edit, f"{prefix}_upper.{suffix}", (x, y, 0.78), (x, y + 0.015, 0.42), parent)
            _bone(edit, f"{prefix}_lower.{suffix}", (x, y + 0.015, 0.42), (x, y + 0.05, 0.13), f"{prefix}_upper.{suffix}")
            _bone(edit, f"{prefix}_paw.{suffix}", (x, y + 0.05, 0.13), (x, y + 0.20, 0.10), f"{prefix}_lower.{suffix}")
    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    return rig


def _dog_part(obj, rig, bone):
    return bone_parent(obj, rig, bone)


def _create_dog_actions(rig):
    action = _new_action(rig, "idle")
    _key_pose(rig, 1, rotations={"head": (-0.03, 0, -0.04), "tail.base": (0.08, 0, -0.18), "tail.tip": (0.08, 0, -0.18)})
    _key_pose(rig, 13, rotations={"head": (0.04, 0.02, 0.05), "tail.base": (-0.10, 0, 0.28), "tail.tip": (-0.08, 0, 0.24)}, locations={"root": (0, 0, 0.012)})
    _key_pose(rig, 25, rotations={"head": (-0.03, 0, -0.04), "tail.base": (0.08, 0, -0.18), "tail.tip": (0.08, 0, -0.18)})
    _finish_action(rig, action, "idle", 1, 25)

    action = _new_action(rig, "walk")
    for frame, phase in ((1, 1), (9, 0), (17, -1), (25, 0), (33, 1)):
        if phase:
            rotations = {"spine": (0.025, 0, -0.025 * phase), "head": (-0.035, 0, 0.02 * phase), "tail.base": (0.08, 0, -0.24 * phase), "tail.tip": (0.10, 0, -0.18 * phase)}
            for prefix, diagonal in (("front", 1), ("rear", -1)):
                rotations[f"{prefix}_upper.L"] = (0.52 * phase * diagonal, 0, 0)
                rotations[f"{prefix}_lower.L"] = (-0.34 * max(phase * diagonal, 0), 0, 0)
                rotations[f"{prefix}_upper.R"] = (-0.52 * phase * diagonal, 0, 0)
                rotations[f"{prefix}_lower.R"] = (0.34 * min(phase * diagonal, 0), 0, 0)
            _key_pose(rig, frame, rotations=rotations, locations={"root": (0, 0, 0.028)})
        else:
            rotations = {"spine": (0.04, 0, 0), "head": (-0.02, 0, 0)}
            for prefix in ("front", "rear"):
                for suffix in ("L", "R"):
                    rotations[f"{prefix}_upper.{suffix}"] = (-0.08, 0, 0)
                    rotations[f"{prefix}_lower.{suffix}"] = (0.26, 0, 0)
            _key_pose(rig, frame, rotations=rotations, locations={"root": (0, 0, -0.012)})
    _finish_action(rig, action, "walk", 1, 33)

    action = _new_action(rig, "run")
    for frame, phase in ((1, 1), (6, 0), (11, -1), (16, 0), (21, 1)):
        if phase:
            rotations = {"spine": (0.10, 0, -0.04 * phase), "head": (-0.09, 0, 0.025 * phase), "tail.base": (-0.12, 0, -0.18 * phase)}
            for prefix, diagonal in (("front", 1), ("rear", -1)):
                rotations[f"{prefix}_upper.L"] = (0.76 * phase * diagonal, 0, 0)
                rotations[f"{prefix}_lower.L"] = (-0.48 * max(phase * diagonal, 0), 0, 0)
                rotations[f"{prefix}_upper.R"] = (-0.76 * phase * diagonal, 0, 0)
                rotations[f"{prefix}_lower.R"] = (0.48 * min(phase * diagonal, 0), 0, 0)
            _key_pose(rig, frame, rotations=rotations, locations={"root": (0, 0, 0.055)})
        else:
            rotations = {"spine": (0.14, 0, 0), "head": (-0.10, 0, 0)}
            for prefix in ("front", "rear"):
                for suffix in ("L", "R"):
                    rotations[f"{prefix}_upper.{suffix}"] = (-0.18, 0, 0)
                    rotations[f"{prefix}_lower.{suffix}"] = (0.48, 0, 0)
            _key_pose(rig, frame, rotations=rotations, locations={"root": (0, 0, -0.025)})
    _finish_action(rig, action, "run", 1, 21)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 33
    bpy.context.scene.frame_set(1)
    _reset_pose(rig)


def build_shepherd_dog():
    reset_scene()
    model = root("NpcShepherdDogR10")
    rig = _create_dog_rig(model)
    sable = _mat("R10 Dog Sable Fur", "#4A3528", 0.94, shadow="#201611")
    tan = _mat("R10 Dog Tan Fur", "#B87942", 0.92, shadow="#684023")
    cream = _mat("R10 Dog Cream Ruff", "#D1B58A", 0.94, shadow="#7C6243")
    dark = _mat("R10 Dog Mask", "#2B2521", 0.90, shadow="#0E0B09")
    eye = _mat("R10 Dog Amber Eye", "#D99A32", 0.40, shadow="#684011")
    collar = _mat("R10 Dog Storm Teal Collar", "#4D8C8F", 0.46, 0.30, shadow="#24484B")
    brass = _mat("R10 Dog Brass Tag", "#D9A23D", 0.30, 0.72, shadow="#714B18")
    _dog_part(add_ico("DogBody", (0, -0.08, 0.82), 0.62, sable, 3, (0.88, 1.35, 0.78)), rig, "spine")
    _dog_part(add_ico("DogChest", (0, 0.39, 0.90), 0.51, tan, 3, (0.93, 0.85, 1.02)), rig, "chest")
    _dog_part(add_ico("DogRuff", (0, 0.52, 1.02), 0.45, cream, 3, (1.02, 0.67, 0.90)), rig, "neck")
    _dog_part(add_ico("DogHead", (0, 0.84, 1.20), 0.36, tan, 3, (0.98, 0.98, 1.05)), rig, "head")
    _dog_part(add_ico("DogMask", (0, 0.96, 1.22), 0.30, dark, 2, (0.86, 0.65, 0.82)), rig, "head")
    _dog_part(add_ico("DogMuzzle", (0, 1.15, 1.08), 0.23, cream, 2, (0.78, 1.05, 0.62)), rig, "head")
    _dog_part(add_ico("DogNose", (0, 1.37, 1.10), 0.105, dark, 2, (1.0, 0.65, 0.72)), rig, "head")
    for suffix, sign in (("L", -1), ("R", 1)):
        _dog_part(add_cone(f"DogEar{suffix}", (sign * 0.22, 0.80, 1.50), 0.16, 0.035, 0.45, dark, 7, (0, sign * 0.10, sign * 0.04)), rig, "head")
        _dog_part(add_ico(f"DogEyeWhite{suffix}", (sign * 0.13, 1.13, 1.27), 0.105, cream, 2, (1.0, 0.35, 0.72)), rig, "head")
        _dog_part(add_ico(f"DogIris{suffix}", (sign * 0.13, 1.20, 1.27), 0.055, eye, 2, (1.0, 0.25, 1.0)), rig, "head")
        _dog_part(add_ico(f"DogPupil{suffix}", (sign * 0.13, 1.23, 1.27), 0.025, dark, 1, (1.0, 0.22, 1.0)), rig, "head")
        for prefix, y in (("front", 0.36), ("rear", -0.43)):
            x = sign * 0.25
            upper = f"{prefix}_upper.{suffix}"
            lower = f"{prefix}_lower.{suffix}"
            paw = f"{prefix}_paw.{suffix}"
            _dog_part(add_beam(f"Dog{prefix.title()}Upper{suffix}", (x, y, 0.76), (x, y + 0.015, 0.42), 0.095, sable if prefix == "rear" else tan, 9), rig, upper)
            _dog_part(add_beam(f"Dog{prefix.title()}Lower{suffix}", (x, y + 0.015, 0.42), (x, y + 0.05, 0.13), 0.075, tan, 8), rig, lower)
            _dog_part(add_ico(f"Dog{prefix.title()}Paw{suffix}", (x, y + 0.13, 0.105), 0.105, dark, 2, (0.84, 1.25, 0.52)), rig, paw)
    # Asymmetrical sable patches keep the coat authored rather than procedural.
    for index, (x, y, z, scale) in enumerate(((-0.34, 0.05, 0.92, (0.35, 0.18, 0.40)), (0.35, -0.20, 0.80, (0.32, 0.20, 0.36)), (-0.25, 0.50, 1.04, (0.28, 0.15, 0.30)))):
        _dog_part(add_ico(f"DogSablePatch{index}", (x, y, z), 0.25, dark, 2, scale), rig, "chest" if y > 0.3 else "spine")
    _dog_part(add_torus("DogCollar", (0, 0.64, 1.05), 0.31, 0.045, collar, 14, 4, (math.pi / 2, 0, 0)), rig, "neck")
    _dog_part(add_cylinder("DogTag", (0, 0.89, 0.92), 0.065, 0.035, brass, 9, (math.pi / 2, 0, 0)), rig, "neck")
    for suffix, sign in (("L", -1), ("R", 1)):
        _dog_part(add_ico(f"DogCollarStud{suffix}", (sign * 0.19, 0.82, 1.02), 0.045, brass, 2, (1.0, 0.35, 1.0)), rig, "neck")
    _dog_part(add_beam("DogTailBase", (0, -0.52, 0.86), (0, -0.92, 1.05), 0.095, sable, 9), rig, "tail.base")
    _dog_part(add_beam("DogTailTip", (0, -0.92, 1.05), (0, -1.24, 1.28), 0.065, dark, 8), rig, "tail.tip")
    _merge_rigid_character_parts(rig, "NpcShepherdDogR10SkinnedMesh")
    _create_dog_actions(rig)
    return model


def build_strong_cow_accessories():
    reset_scene()
    model = root("StrongCowAccessoriesR10")
    horn = _mat("R10 Strong Cow Bone Horn", "#D7B77A", 0.82, shadow="#73552D")
    horn_tip = _mat("R10 Strong Cow Horn Tip", "#6D4A2A", 0.76, shadow="#2D1C10")
    collar = _mat("R10 Strong Cow Ember Collar", "#9D3827", 0.48, 0.42, "#D55227", 0.62, "#4B1510")
    brass = _mat("R10 Strong Cow Collar Brass", "#D9A23D", 0.30, 0.72, shadow="#714B18")
    # Coordinates match the source cow's authored object space. Blender Y maps
    # to glTF -Z, so the former runtime z=+1.45 anchor is authored at y=-1.45.
    for suffix, sign in (("L", -1), ("R", 1)):
        first = add_cone(f"StrongCowHornBase{suffix}", (sign * 1.05, -1.45, 3.30), 0.19, 0.10, 0.88, horn, 10, (0, sign * 0.62, 0))
        first.parent = model
        second = add_cone(f"StrongCowHornTip{suffix}", (sign * 1.46, -1.45, 3.74), 0.11, 0.015, 0.72, horn_tip, 9, (0, sign * 1.02, 0))
        second.parent = model
    ring = add_torus("StrongCowEmberCollar", (0, 0, 2.20), 1.20, 0.08, collar, 20, 5)
    ring.parent = model
    tag = add_box("StrongCowCollarTag", (0, -1.18, 1.98), (0.34, 0.10, 0.42), brass)
    tag.parent = model
    gem = add_ico("StrongCowCollarEmber", (0, -1.26, 1.98), 0.13, collar, 2, (0.85, 0.55, 1.15))
    gem.parent = model
    parent_loose(model)
    return model


for filename, builder in (
    ("characters/staff-hunter.glb", build_hunter),
    ("characters/staff-cashier.glb", build_cashier),
    ("characters/customer-traveler.glb", lambda: build_customer("traveler")),
    ("characters/customer-forager.glb", lambda: build_customer("forager")),
    ("characters/customer-refugee.glb", lambda: build_customer("refugee")),
    ("characters/staff-shepherd-dog.glb", build_shepherd_dog),
):
    export_glb(filename, builder(), character_forward=True)

export_glb("strong-cow-accessories.glb", build_strong_cow_accessories())
