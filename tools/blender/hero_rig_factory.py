"""Fresh R2 low-poly protagonist models with a shared procedural rig."""

import math

from animated_asset_utils import add_bone_socket, bone_parent, create_humanoid_actions, create_humanoid_rig
from blender_utils import *


def _rgb(value):
    value = value.lstrip("#")
    srgb = tuple(int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))
    return tuple(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in srgb)


def _mat(name, value, roughness=0.88, metallic=0.0, emission=None, strength=0.0):
    return material(name, _rgb(value), roughness, metallic, _rgb(emission) if emission else None, strength)


def _bind(obj, rig, bone):
    return bone_parent(obj, rig, bone)


def _beam(name, start, end, radius, mat, rig, bone, vertices=7):
    return _bind(add_beam(name, start, end, radius, mat, vertices), rig, bone)


def _box(name, location, dimensions, mat, rig, bone, rotation=(0, 0, 0)):
    return _bind(add_box(name, location, dimensions, mat, rotation), rig, bone)


def _cylinder(name, location, radius, depth, mat, rig, bone, vertices=7, rotation=(0, 0, 0)):
    return _bind(add_cylinder(name, location, radius, depth, mat, vertices, rotation), rig, bone)


def _ico(name, location, radius, mat, rig, bone, scale=(1, 1, 1)):
    return _bind(add_ico(name, location, radius, mat, 1, scale), rig, bone)


def _torus(name, location, major, minor, mat, rig, bone, rotation=(0, 0, 0), major_segments=10):
    return _bind(add_torus(name, location, major, minor, mat, major_segments, 3, rotation), rig, bone)


def _build_body(prefix, height, shoulder, hip_width, mats, proportions=None):
    proportions = proportions or {}
    model = root(prefix)
    rig, joints = create_humanoid_rig(model, height, shoulder, hip_width)
    leg_radius = proportions.get("leg_radius", 0.105)
    arm_radius = proportions.get("arm_radius", 0.09)
    hand_radius = proportions.get("hand_radius", 0.105)
    head_radius = proportions.get("head_radius", height * 0.115)
    boot_radius = proportions.get("boot_radius", leg_radius * 1.18)
    hand_y = 0.055

    for suffix, sign in (("L", -1), ("R", 1)):
        leg_x = sign * joints["leg_x"]
        _beam(
            f"{prefix}Thigh{suffix}",
            (leg_x, 0, joints["hip_z"] - 0.02),
            (leg_x, 0.01, joints["knee_z"] + 0.015),
            leg_radius * 1.08,
            mats["trousers"], rig, f"thigh.{suffix}", 7,
        )
        _beam(
            f"{prefix}Shin{suffix}",
            (leg_x, 0.01, joints["knee_z"] + 0.02),
            (leg_x, 0.025, joints["ankle_z"] + 0.02),
            leg_radius,
            mats["trousers"], rig, f"shin.{suffix}", 7,
        )
        _cylinder(
            f"{prefix}Boot{suffix}",
            (leg_x, 0.075, joints["ankle_z"]),
            boot_radius,
            0.29,
            mats["boots"], rig, f"foot.{suffix}", 7,
            (math.pi / 2, 0, 0),
        )
        _beam(
            f"{prefix}UpperArm{suffix}",
            (sign * joints["shoulder_x"], 0, joints["shoulder_z"]),
            (sign * joints["elbow_x"], 0.015, joints["elbow_z"]),
            arm_radius * 1.08,
            mats["coat"], rig, f"upper_arm.{suffix}", 7,
        )
        _beam(
            f"{prefix}Forearm{suffix}",
            (sign * joints["elbow_x"], 0.015, joints["elbow_z"]),
            (sign * joints["hand_x"], hand_y, joints["hand_z"]),
            arm_radius,
            mats["coat"], rig, f"forearm.{suffix}", 7,
        )
        _ico(
            f"{prefix}Hand{suffix}",
            (sign * joints["hand_x"], hand_y, joints["hand_z"]),
            hand_radius,
            mats["skin"], rig, f"hand.{suffix}", (0.78, 0.68, 1.08),
        )

    _box(
        f"{prefix}Pelvis",
        (0, 0, joints["hip_z"] + height * 0.055),
        (hip_width, 0.34, height * 0.2),
        mats["trousers"], rig, "pelvis",
    )
    _box(
        f"{prefix}Torso",
        (0, 0, (joints["waist_z"] + joints["chest_z"]) * 0.5),
        (shoulder * 0.92, 0.38, joints["chest_z"] - joints["waist_z"] + height * 0.17),
        mats["coat"], rig, "chest",
    )
    _cylinder(
        f"{prefix}Neck",
        (0, 0, joints["neck_z"]),
        head_radius * 0.42,
        height * 0.095,
        mats["skin"], rig, "neck", 7,
    )
    _ico(
        f"{prefix}Head",
        (0, 0.012, joints["head_z"]),
        head_radius,
        mats["skin"], rig, "head", proportions.get("head_scale", (1, 0.94, 1.08)),
    )
    # A small faceted nose and brow line keep expression readable without textures.
    _ico(
        f"{prefix}Nose",
        (0, head_radius * 0.84, joints["head_z"] - head_radius * 0.02),
        head_radius * 0.17,
        mats["skin"], rig, "head", (0.62, 0.92, 0.7),
    )
    _box(
        f"{prefix}Brow",
        (0, head_radius * 0.82, joints["head_z"] + head_radius * 0.2),
        (head_radius * 0.86, 0.025, 0.026),
        mats["hair"], rig, "head",
    )

    socket_location = (joints["hand_x"], hand_y, joints["hand_z"])
    add_bone_socket("WeaponSocket", rig, "hand.R", socket_location)
    return model, rig, joints, head_radius


def build_butcher_matron():
    reset_scene()
    mats = {
        "skin": _mat("Matron Skin", "#C4A484"),
        "coat": _mat("Matron Slate Coat", "#3E4A52"),
        "trousers": _mat("Matron Dark Trousers", "#30383C"),
        "boots": _mat("Matron Boots", "#2A2420"),
        "hair": _mat("Matron Hair", "#352A24"),
    }
    apron = _mat("Matron Blood Apron", "#8B2E2E")
    stain = _mat("Matron Apron Stain", "#5D171B")
    fur = _mat("Matron Fur", "#C9B8A0")
    iron = _mat("Matron Cleaver Iron", "#5C6465", 0.42, 0.62)
    leather = _mat("Matron Cleaver Grip", "#4B2A18")
    model, rig, j, head_r = _build_body(
        "ProtagonistButcherMatronR2", 1.68, 0.78, 0.68, mats,
        {"leg_radius": 0.125, "arm_radius": 0.108, "hand_radius": 0.115, "head_scale": (1.08, 0.94, 1.03)},
    )
    _box("MatronApronBib", (0, 0.213, 1.19), (0.46, 0.055, 0.43), apron, rig, "chest")
    _box("MatronApronSkirt", (0, 0.224, 0.83), (0.66, 0.06, 0.58), apron, rig, "spine")
    _box("MatronApronStain", (-0.17, 0.262, 0.93), (0.2, 0.024, 0.15), stain, rig, "spine", (0, 0, -0.18))
    for side in (-1, 1):
        _beam(f"MatronApronStrap{side}", (side * 0.22, 0.23, 1.39), (side * 0.31, 0.2, 0.84), 0.018, leather, rig, "chest", 5)
        _torus(f"MatronFurCuff{side}", (side * j["elbow_x"], 0.015, j["elbow_z"]), 0.12, 0.035, fur, rig, f"forearm.{ 'L' if side < 0 else 'R' }")
    _torus("MatronFurCollar", (0, 0, 1.39), 0.27, 0.075, fur, rig, "chest", major_segments=11)
    _ico("MatronHairCap", (0, -0.012, j["head_z"] + head_r * 0.54), head_r * 0.94, mats["hair"], rig, "head", (1.08, 0.96, 0.54))
    _box("MatronHeadScarf", (0, -0.02, j["head_z"] + head_r * 0.74), (0.38, 0.33, 0.09), apron, rig, "head", (0.04, 0, 0.04))
    _box("MatronApronPocket", (0.2, 0.267, 0.78), (0.2, 0.03, 0.2), stain, rig, "spine")
    _beam("MatronScaleCord", (-0.26, 0.2, 0.92), (-0.31, 0.2, 0.66), 0.014, leather, rig, "pelvis", 5)
    _cylinder("MatronScaleWeight", (-0.31, 0.2, 0.6), 0.055, 0.13, iron, rig, "pelvis", 6)

    # Signature cleaver is rigid-bound to the weapon hand and follows all attack arcs.
    hand = (j["hand_x"], 0.055, j["hand_z"])
    _beam("MatronCleaverGrip", hand, (hand[0], hand[1], hand[2] + 0.34), 0.045, leather, rig, "hand.R", 7)
    blade = add_prism(
        "MatronCleaverBlade",
        [
            (hand[0] - 0.055, hand[1] - 0.025, hand[2] + 0.3),
            (hand[0] + 0.055, hand[1] - 0.025, hand[2] + 0.3),
            (hand[0] + 0.17, hand[1] - 0.025, hand[2] + 0.78),
            (hand[0] - 0.22, hand[1] - 0.025, hand[2] + 0.72),
            (hand[0] - 0.055, hand[1] + 0.025, hand[2] + 0.3),
            (hand[0] + 0.055, hand[1] + 0.025, hand[2] + 0.3),
            (hand[0] + 0.17, hand[1] + 0.025, hand[2] + 0.78),
            (hand[0] - 0.22, hand[1] + 0.025, hand[2] + 0.72),
        ],
        [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)],
        iron,
    )
    _bind(blade, rig, "hand.R")
    _cylinder("MatronCleaverRivet", (hand[0], hand[1] + 0.032, hand[2] + 0.52), 0.032, 0.035, leather, rig, "hand.R", 6, (math.pi / 2, 0, 0))
    create_humanoid_actions(rig)
    return model


def build_vet_sniper():
    reset_scene()
    mats = {
        "skin": _mat("Sniper Skin", "#B79272"),
        "coat": _mat("Sniper Military Greatcoat", "#3F4F3A"),
        "trousers": _mat("Sniper Inner", "#2C3034"),
        "boots": _mat("Sniper Boots", "#202326"),
        "hair": _mat("Sniper Hair", "#30302A"),
    }
    wrap = _mat("Sniper Wrap", "#5C4A32")
    lens = _mat("Sniper Cold Lens", "#6A8A8A", 0.36, 0.12, "#6A8A8A", 0.35)
    iron = _mat("Sniper Rifle Iron", "#282F30", 0.38, 0.66)
    wood = _mat("Sniper Rifle Stock", "#56351E")
    model, rig, j, head_r = _build_body(
        "ProtagonistVetSniperR2", 1.78, 0.66, 0.55, mats,
        {"leg_radius": 0.095, "arm_radius": 0.084, "hand_radius": 0.1, "head_scale": (0.94, 0.92, 1.1)},
    )
    _box("SniperGreatcoatSkirt", (0, -0.01, 0.86), (0.59, 0.39, 0.62), mats["coat"], rig, "spine")
    for side in (-1, 1):
        _box(f"SniperCoatTail{side}", (side * 0.19, -0.075, 0.62), (0.22, 0.22, 0.54), mats["coat"], rig, "pelvis", (side * 0.05, 0, side * 0.035))
        suffix = "L" if side < 0 else "R"
        for index in range(2):
            _torus(f"SniperCalfWrap{suffix}{index}", (side * j["leg_x"], 0.015, 0.29 + index * 0.12), 0.105, 0.023, wrap, rig, f"shin.{suffix}")
        _box(f"SniperShoulderTab{suffix}", (side * j["shoulder_x"] * 0.84, 0.025, j["shoulder_z"] + 0.025), (0.22, 0.25, 0.06), wrap, rig, f"upper_arm.{suffix}", (0, side * 0.08, 0))
    _ico("SniperHairCap", (0, -0.02, j["head_z"] + head_r * 0.52), head_r * 0.91, mats["hair"], rig, "head", (0.96, 0.9, 0.52))
    _bind(add_cone("SniperHood", (0, -0.055, j["head_z"] + 0.045), 0.255, 0.18, 0.36, mats["coat"], 8), rig, "head")
    _box("SniperEyePatch", (-0.075, head_r * 0.88, j["head_z"] + 0.025), (0.11, 0.028, 0.085), lens, rig, "head", (0, 0, -0.12))
    _beam("SniperPatchBand", (-0.17, 0.16, j["head_z"] + 0.08), (0.13, 0.16, j["head_z"] - 0.005), 0.012, wrap, rig, "head", 5)
    for side in (-1, 1):
        _box(f"SniperAmmoPouch{side}", (side * 0.2, 0.215, 0.94), (0.17, 0.09, 0.23), wrap, rig, "pelvis", (0.05, 0, side * 0.06))

    # Long rifle and sling are a clear back silhouette even when another weapon is equipped.
    _beam("SniperRifleBarrel", (-0.27, -0.25, 0.62), (0.3, -0.25, 1.66), 0.045, iron, rig, "chest", 8)
    _box("SniperRifleStock", (-0.33, -0.25, 0.53), (0.22, 0.16, 0.42), wood, rig, "chest", (0, -0.52, 0.08))
    _cylinder("SniperRifleScope", (0.05, -0.27, 1.24), 0.065, 0.42, lens, rig, "chest", 8, (0, math.radians(29), 0))
    _beam("SniperRifleSling", (-0.34, -0.12, 0.58), (0.31, -0.1, 1.58), 0.018, wrap, rig, "chest", 5)
    _box("SniperBoltHandle", (0.08, -0.18, 1.2), (0.16, 0.055, 0.055), iron, rig, "chest", (0, -0.45, 0))
    create_humanoid_actions(rig)
    return model


def build_mech_youth():
    reset_scene()
    mats = {
        "skin": _mat("Mech Skin", "#C49A75"),
        "coat": _mat("Mech Jacket", "#4A5560"),
        "trousers": _mat("Mech Trousers", "#2F3540"),
        "boots": _mat("Mech Boots", "#25282D"),
        "hair": _mat("Mech Hair", "#2E2924"),
    }
    orange = _mat("Mech Tool Orange", "#C45C26", 0.62, 0.16)
    belt = _mat("Mech Tool Belt", "#6B5B3E")
    patch = _mat("Mech Patches", "#7A3E3E")
    lens = _mat("Mech Goggle Lens", "#6DA3A7", 0.32, 0.1, "#4E8992", 0.22)
    model, rig, j, head_r = _build_body(
        "ProtagonistMechYouthR2", 1.55, 0.69, 0.62, mats,
        {"leg_radius": 0.112, "arm_radius": 0.096, "hand_radius": 0.11, "head_radius": 0.205, "head_scale": (1.14, 1.0, 1.05)},
    )
    _box("MechJacketHem", (0, 0.01, 0.82), (0.68, 0.41, 0.19), mats["coat"], rig, "spine")
    _box("MechToolBelt", (0, 0.015, 0.75), (0.72, 0.44, 0.115), belt, rig, "pelvis")
    for index, x in enumerate((-0.245, 0, 0.245)):
        _box(f"MechToolPouch{index}", (x, 0.255, 0.7 + (index % 2) * 0.025), (0.16, 0.085, 0.22), belt, rig, "pelvis")
    _box("MechKneePadL", (-j["leg_x"], 0.11, j["knee_z"]), (0.2, 0.08, 0.18), orange, rig, "shin.L")
    _box("MechKneePadR", (j["leg_x"], 0.11, j["knee_z"]), (0.2, 0.08, 0.18), orange, rig, "shin.R")
    _box("MechElbowPatch", (-j["elbow_x"], 0.085, j["elbow_z"]), (0.16, 0.075, 0.19), patch, rig, "forearm.L", (0, 0, -0.2))
    _box("MechGlove", (j["hand_x"], 0.055, j["hand_z"]), (0.18, 0.15, 0.19), orange, rig, "hand.R", (0, 0, 0.1))
    _ico("MechHairCap", (0, -0.012, j["head_z"] + head_r * 0.53), head_r * 0.94, mats["hair"], rig, "head", (1.12, 1.0, 0.53))
    for side in (-1, 1):
        _cylinder(f"MechGoggleFrame{side}", (side * 0.095, 0.158, j["head_z"] + 0.145), 0.08, 0.06, orange, rig, "head", 9, (math.pi / 2, 0, 0))
        _cylinder(f"MechGoggleLens{side}", (side * 0.095, 0.192, j["head_z"] + 0.145), 0.057, 0.018, lens, rig, "head", 8, (math.pi / 2, 0, 0))
    _beam("MechGoggleBridge", (-0.035, 0.19, j["head_z"] + 0.145), (0.035, 0.19, j["head_z"] + 0.145), 0.016, orange, rig, "head", 5)
    _beam("MechGoggleStrap", (-0.18, 0.03, j["head_z"] + 0.14), (0.18, 0.03, j["head_z"] + 0.14), 0.016, belt, rig, "head", 5)

    # Wrench and screwdriver break up the tool-belt silhouette.
    _beam("MechWrenchHandle", (0.29, 0.2, 0.76), (0.39, 0.2, 0.46), 0.026, orange, rig, "pelvis", 6)
    _torus("MechWrenchRing", (0.405, 0.2, 0.415), 0.066, 0.02, orange, rig, "pelvis", (math.pi / 2, 0, 0), 8)
    _beam("MechScrewdriver", (-0.3, 0.2, 0.77), (-0.36, 0.2, 0.48), 0.022, patch, rig, "pelvis", 6)
    _cylinder("MechScrewdriverGrip", (-0.31, 0.2, 0.76), 0.045, 0.13, orange, rig, "pelvis", 7, (0.2, 0.05, 0))
    _box("MechChestBadge", (-0.18, 0.215, 1.08), (0.16, 0.025, 0.1), patch, rig, "chest", (0, 0, -0.08))
    create_humanoid_actions(rig)
    return model

