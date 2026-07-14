"""Storm R8 boutique stylized-low-poly protagonists on the shared 18-bone rig."""

import math

from animated_asset_utils import add_bone_socket, bone_parent, create_humanoid_actions, create_humanoid_rig
from blender_utils import *


def _rgb(value):
    value = value.lstrip("#")
    srgb = tuple(int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))
    return tuple(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in srgb)


def _shade(value, amount=0.58):
    return tuple(channel * amount for channel in _rgb(value))


def _mat(name, value, roughness=0.88, metallic=0.0, emission=None, strength=0.0, shadow=None):
    return stylized_material(
        name,
        _rgb(value),
        _rgb(shadow) if shadow else _shade(value),
        roughness,
        metallic,
        _rgb(emission) if emission else None,
        strength,
    )


def _bind(obj, rig, bone):
    return bone_parent(obj, rig, bone)


def _beam(name, start, end, radius, mat, rig, bone, vertices=9):
    return _bind(add_beam(name, start, end, radius, mat, vertices), rig, bone)


def _box(name, location, dimensions, mat, rig, bone, rotation=(0, 0, 0), edge=0.014):
    obj = add_box(name, location, dimensions, mat, rotation)
    bevel(obj, min(edge, min(dimensions) * 0.2), 1)
    return _bind(obj, rig, bone)


def _cylinder(name, location, radius, depth, mat, rig, bone, vertices=10, rotation=(0, 0, 0)):
    return _bind(add_cylinder(name, location, radius, depth, mat, vertices, rotation), rig, bone)


def _cone(name, location, radius1, radius2, depth, mat, rig, bone, vertices=10, rotation=(0, 0, 0)):
    return _bind(add_cone(name, location, radius1, radius2, depth, mat, vertices, rotation), rig, bone)


def _ico(name, location, radius, mat, rig, bone, scale=(1, 1, 1), subdivisions=2):
    return _bind(add_ico(name, location, radius, mat, subdivisions, scale), rig, bone)


def _torus(name, location, major, minor, mat, rig, bone, rotation=(0, 0, 0), major_segments=12, minor_segments=4):
    return _bind(add_torus(name, location, major, minor, mat, major_segments, minor_segments, rotation), rig, bone)


def _face(prefix, rig, joints, radius, mats, iris, expression="steady"):
    """Build readable eyes, pupils, brows and a small mouth plane."""
    eye_z = joints["head_z"] + radius * 0.12
    brow_z = eye_z + radius * 0.30
    for suffix, sign in (("L", -1), ("R", 1)):
        x = sign * radius * 0.40
        _ico(f"{prefix}EyeWhite{suffix}", (x, radius * 0.89, eye_z), radius * 0.29, mats["eye_white"], rig, "head", (1.0, 0.30, 0.72), 2)
        _ico(f"{prefix}Iris{suffix}", (x, radius * 1.055, eye_z), radius * 0.135, iris, rig, "head", (1.0, 0.22, 1.0), 2)
        _ico(f"{prefix}Pupil{suffix}", (x, radius * 1.095, eye_z), radius * 0.06, mats["pupil"], rig, "head", (1.0, 0.18, 1.0), 1)
        if expression == "fierce":
            inner = brow_z - radius * 0.03
            outer = brow_z + radius * 0.08
        elif expression == "curious":
            inner = brow_z + radius * 0.04
            outer = brow_z - radius * 0.01
        else:
            inner = brow_z + radius * 0.015
            outer = brow_z + radius * 0.04
        start = (sign * radius * 0.14, radius * 1.02, inner)
        end = (sign * radius * 0.69, radius * 0.98, outer)
        _beam(f"{prefix}Brow{suffix}", start, end, radius * 0.055, mats["hair"], rig, "head", 7)
    _box(
        f"{prefix}Mouth",
        (0, radius * 1.0, joints["head_z"] - radius * 0.34),
        (radius * 0.48, radius * 0.04, radius * 0.055),
        mats["mouth"], rig, "head", (0, 0, -0.035), radius * 0.015,
    )


def _cloth_wear(prefix, location, dimensions, mat, rig, bone, rotation=(0, 0, 0)):
    return _box(prefix, location, dimensions, mat, rig, bone, rotation, edge=0.006)


def _metal_scratch(prefix, starts, mat, rig, bone):
    for index, (start, end) in enumerate(starts):
        _beam(f"{prefix}{index}", start, end, 0.008, mat, rig, bone, 5)


def _hook(prefix, anchor, scale, metal, rig, bone):
    x, y, z = anchor
    points = [
        (x, y, z + scale * 0.62),
        (x, y, z + scale * 0.18),
        (x + scale * 0.08, y, z - scale * 0.08),
        (x + scale * 0.29, y, z - scale * 0.16),
        (x + scale * 0.43, y, z - scale * 0.02),
    ]
    for index in range(len(points) - 1):
        _beam(f"{prefix}Segment{index}", points[index], points[index + 1], scale * 0.055, metal, rig, bone, 7)
    _cone(f"{prefix}Point", points[-1], scale * 0.085, 0, scale * 0.25, metal, rig, bone, 7, (0, math.pi / 2, 0))


def _merge_rigid_character_parts(rig, name):
    """Bake articulated rigid pieces into one skinned mesh without detail loss."""
    meshes = [obj for obj in list(bpy.context.scene.objects) if obj.type == "MESH" and obj.parent == rig and obj.parent_type == "BONE"]

    # Keep the authored COLOR_0 palette/gradient, but collapse the dozens of
    # one-off swatches into five shared physical surface responses.  The GLB
    # therefore retains visible skin/cloth/leather/metal separation without
    # turning every scratch and facial feature into another draw call.
    surface_materials = {
        "skin": stylized_material("R8 Shared Skin Response", (1, 1, 1), (1, 1, 1), 0.68, 0.0),
        "cloth": stylized_material("R8 Shared Cloth Response", (1, 1, 1), (1, 1, 1), 0.91, 0.0),
        "leather": stylized_material("R8 Shared Leather Response", (1, 1, 1), (1, 1, 1), 0.72, 0.0),
        "metal": stylized_material("R8 Shared Metal Response", (1, 1, 1), (1, 1, 1), 0.29, 0.78),
        "lens": stylized_material("R8 Shared Lens Response", (1, 1, 1), (1, 1, 1), 0.24, 0.0, (0.22, 0.55, 0.58), 0.24),
    }

    def surface_for(material_slot):
        if material_slot is None:
            return surface_materials["cloth"]
        label = material_slot.name.lower()
        bsdf = material_slot.node_tree.nodes.get("Principled BSDF") if material_slot.use_nodes else None
        metallic = float(bsdf.inputs["Metallic"].default_value) if bsdf else 0.0
        if "lens" in label or "cyan accent" in label:
            return surface_materials["lens"]
        if metallic >= 0.5 or any(token in label for token in ("iron", "brass", "metal", "scratch", "signal orange")):
            return surface_materials["metal"]
        if any(token in label for token in ("leather", "walnut", "wood")):
            return surface_materials["leather"]
        if any(token in label for token in ("skin", "eye", "iris", "pupil", "mouth", "hair", "stubble", "freckle")):
            return surface_materials["skin"]
        return surface_materials["cloth"]

    for obj in meshes:
        bone_name = obj.parent_bone
        world = obj.matrix_world.copy()
        original = obj.data.materials[0] if obj.data.materials else None
        physical_surface = surface_for(original)
        obj.data.materials.clear()
        obj.data.materials.append(physical_surface)
        obj.parent = rig
        obj.parent_type = "OBJECT"
        obj.matrix_world = world
        group = obj.vertex_groups.get(bone_name) or obj.vertex_groups.new(name=bone_name)
        group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")

    bpy.ops.object.select_all(action="DESELECT")
    active = meshes[0]
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active
    bpy.ops.object.join()
    active.name = name
    active.parent = rig
    active.parent_type = "OBJECT"
    active.matrix_parent_inverse = rig.matrix_world.inverted()
    for modifier in list(active.modifiers):
        active.modifiers.remove(modifier)
    armature = active.modifiers.new("R8 Shared 18 Bone Skin", "ARMATURE")
    armature.object = rig

    return active


def _build_body(prefix, height, shoulder, hip_width, mats, proportions=None):
    proportions = proportions or {}
    model = root(prefix)
    rig, joints = create_humanoid_rig(model, height, shoulder, hip_width)
    leg_radius = proportions.get("leg_radius", 0.105)
    arm_radius = proportions.get("arm_radius", 0.09)
    hand_radius = proportions.get("hand_radius", 0.105)
    head_radius = proportions.get("head_radius", height * 0.115)
    boot_radius = proportions.get("boot_radius", leg_radius * 1.22)
    hand_y = 0.055

    for suffix, sign in (("L", -1), ("R", 1)):
        leg_x = sign * joints["leg_x"]
        _beam(f"{prefix}Thigh{suffix}", (leg_x, 0, joints["hip_z"] - 0.02), (leg_x, 0.01, joints["knee_z"] + 0.015), leg_radius * 1.08, mats["trousers"], rig, f"thigh.{suffix}", 10)
        _beam(f"{prefix}Shin{suffix}", (leg_x, 0.01, joints["knee_z"] + 0.02), (leg_x, 0.025, joints["ankle_z"] + 0.02), leg_radius, mats["trousers"], rig, f"shin.{suffix}", 10)
        _cylinder(f"{prefix}Boot{suffix}", (leg_x, 0.085, joints["ankle_z"]), boot_radius, 0.31, mats["boots"], rig, f"foot.{suffix}", 10, (math.pi / 2, 0, 0))
        _box(f"{prefix}BootToe{suffix}", (leg_x, 0.20, joints["ankle_z"] - 0.015), (boot_radius * 1.72, 0.28, 0.18), mats["boots"], rig, f"foot.{suffix}", (0.02, 0, 0), 0.018)
        _beam(f"{prefix}UpperArm{suffix}", (sign * joints["shoulder_x"], 0, joints["shoulder_z"]), (sign * joints["elbow_x"], 0.015, joints["elbow_z"]), arm_radius * 1.08, mats["coat"], rig, f"upper_arm.{suffix}", 10)
        _beam(f"{prefix}Forearm{suffix}", (sign * joints["elbow_x"], 0.015, joints["elbow_z"]), (sign * joints["hand_x"], hand_y, joints["hand_z"]), arm_radius, mats["coat"], rig, f"forearm.{suffix}", 10)
        _ico(f"{prefix}Hand{suffix}", (sign * joints["hand_x"], hand_y, joints["hand_z"]), hand_radius, mats["skin"], rig, f"hand.{suffix}", (0.78, 0.68, 1.08), 3)

    _box(f"{prefix}Pelvis", (0, 0, joints["hip_z"] + height * 0.055), (hip_width, 0.36, height * 0.2), mats["trousers"], rig, "pelvis", edge=0.022)
    _box(f"{prefix}Torso", (0, 0, (joints["waist_z"] + joints["chest_z"]) * 0.5), (shoulder * 0.92, 0.40, joints["chest_z"] - joints["waist_z"] + height * 0.17), mats["coat"], rig, "chest", edge=0.028)
    _cylinder(f"{prefix}Neck", (0, 0, joints["neck_z"]), head_radius * 0.42, height * 0.095, mats["skin"], rig, "neck", 10)
    _ico(f"{prefix}Head", (0, 0.012, joints["head_z"]), head_radius, mats["skin"], rig, "head", proportions.get("head_scale", (1, 0.94, 1.08)), 3)
    _ico(f"{prefix}Nose", (0, head_radius * 0.87, joints["head_z"] - head_radius * 0.04), head_radius * 0.18, mats["skin"], rig, "head", (0.58, 0.9, 0.72), 1)

    socket_location = (joints["hand_x"], hand_y, joints["hand_z"])
    add_bone_socket("WeaponSocket", rig, "hand.R", socket_location)
    return model, rig, joints, head_radius


def build_butcher_matron():
    reset_scene()
    mats = {
        "skin": _mat("R8 Skin Warm", "#B98268", 0.7, shadow="#71463D"),
        "coat": _mat("R8 Matron Charcoal Wool", "#31434A", 0.91, shadow="#17272D"),
        "trousers": _mat("R8 Matron Smoke", "#243238", 0.9, shadow="#111B20"),
        "boots": _mat("R8 Dark Leather", "#352720", 0.72, shadow="#160F0C"),
        "hair": _mat("R8 Matron Hair", "#3A2722", 0.82, shadow="#170E0C"),
        "eye_white": _mat("R8 Eye White", "#E6D8C4", 0.62, shadow="#A68C79"),
        "pupil": _mat("R8 Pupil", "#120D0C", 0.54, shadow="#050303"),
        "mouth": _mat("R8 Mouth", "#642E31", 0.78, shadow="#2C1014"),
    }
    apron = _mat("R8 Matron Oxblood Apron", "#962D3D", 0.86, shadow="#4A111D")
    apron_wear = _mat("R8 Matron Apron Wear", "#D2A78F", 0.9, shadow="#8F6654")
    brass = _mat("R8 Matron Brass Accent", "#E4A340", 0.31, 0.72, shadow="#765022")
    iron = _mat("R8 Shared Scarred Iron", "#8A999B", 0.32, 0.78, shadow="#343E40")
    scratch = _mat("R8 Metal Scratch", "#D8E2DC", 0.2, 0.82, shadow="#738080")
    leather = _mat("R8 Brown Leather", "#70422B", 0.7, shadow="#321A10")
    iris = _mat("R8 Matron Amber Iris", "#D8912D", 0.42, shadow="#6D3D12")
    model, rig, j, head_r = _build_body(
        "ProtagonistButcherMatronR8", 1.70, 0.91, 0.75, mats,
        {"leg_radius": 0.14, "arm_radius": 0.125, "hand_radius": 0.135, "head_scale": (1.11, 0.96, 1.02)},
    )

    _box("MatronApronBib", (0, 0.226, 1.20), (0.54, 0.065, 0.45), apron, rig, "chest", edge=0.018)
    skirt = add_prism(
        "MatronApronSkirt",
        [(-0.34, 0.22, 1.02), (0.34, 0.22, 1.02), (0.42, 0.22, 0.50), (-0.38, 0.22, 0.50),
         (-0.34, 0.285, 1.02), (0.34, 0.285, 1.02), (0.42, 0.285, 0.50), (-0.38, 0.285, 0.50)],
        [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], apron,
    )
    bevel(skirt, 0.018, 1)
    _bind(skirt, rig, "spine")
    _cloth_wear("MatronApronWornHem", (0.02, 0.292, 0.515), (0.73, 0.018, 0.055), apron_wear, rig, "spine", (0, 0, -0.015))
    _cloth_wear("MatronApronWornSide", (-0.37, 0.292, 0.74), (0.045, 0.018, 0.28), apron_wear, rig, "spine", (0, 0, -0.08))
    _box("MatronApronPocket", (0.19, 0.295, 0.79), (0.23, 0.035, 0.22), leather, rig, "spine", (0, 0, -0.05), 0.012)
    for side in (-1, 1):
        _beam(f"MatronApronStrap{side}", (side * 0.25, 0.24, 1.41), (side * 0.33, 0.215, 0.84), 0.021, leather, rig, "chest", 7)
        _torus(f"MatronBrassCuff{side}", (side * j["elbow_x"], 0.015, j["elbow_z"]), 0.14, 0.034, brass, rig, f"forearm.{ 'L' if side < 0 else 'R' }", major_segments=12)
    _torus("MatronCollar", (0, 0, 1.42), 0.29, 0.072, leather, rig, "chest", major_segments=14)
    _ico("MatronHairCap", (0, -0.015, j["head_z"] + head_r * 0.55), head_r * 0.96, mats["hair"], rig, "head", (1.1, 0.98, 0.55), 2)
    _box("MatronHeadScarfBand", (0, 0.005, j["head_z"] + head_r * 0.72), (0.41, 0.34, 0.11), apron, rig, "head", (0.03, 0, 0.035), 0.018)
    _ico("MatronHeadScarfKnot", (-0.21, -0.04, j["head_z"] + head_r * 0.65), 0.095, apron, rig, "head", (1.0, 0.85, 1.0), 1)
    _box("MatronHeadScarfTailLong", (-0.28, -0.10, j["head_z"] + 0.02), (0.12, 0.06, 0.43), apron, rig, "head", (0.08, -0.16, -0.18), 0.012)
    _box("MatronHeadScarfTailShort", (-0.14, -0.13, j["head_z"] + 0.06), (0.1, 0.055, 0.31), apron_wear, rig, "head", (-0.05, 0.13, 0.13), 0.01)
    _face("Matron", rig, j, head_r, mats, iris, "fierce")
    for side in (-1, 1):
        _beam(f"MatronEyeWrinkle{side}", (side * head_r * 0.48, head_r * 1.0, j["head_z"] - head_r * 0.04), (side * head_r * 0.72, head_r * 0.96, j["head_z"] - head_r * 0.12), 0.008, mats["mouth"], rig, "head", 5)
    _beam("MatronForeheadCrease", (-0.06, head_r * 1.02, j["head_z"] + head_r * 0.42), (0.07, head_r * 1.02, j["head_z"] + head_r * 0.39), 0.009, mats["mouth"], rig, "head", 5)

    hand = (j["hand_x"], 0.055, j["hand_z"])
    _beam("MatronCleaverGrip", hand, (hand[0], hand[1], hand[2] + 0.39), 0.052, leather, rig, "hand.R", 10)
    blade = add_prism(
        "MatronSignatureCleaver",
        [(hand[0] - 0.07, hand[1] - 0.035, hand[2] + 0.31), (hand[0] + 0.07, hand[1] - 0.035, hand[2] + 0.31),
         (hand[0] + 0.21, hand[1] - 0.035, hand[2] + 0.89), (hand[0] - 0.28, hand[1] - 0.035, hand[2] + 0.82),
         (hand[0] - 0.07, hand[1] + 0.035, hand[2] + 0.31), (hand[0] + 0.07, hand[1] + 0.035, hand[2] + 0.31),
         (hand[0] + 0.21, hand[1] + 0.035, hand[2] + 0.89), (hand[0] - 0.28, hand[1] + 0.035, hand[2] + 0.82)],
        [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], iron,
    )
    bevel(blade, 0.018, 2)
    _bind(blade, rig, "hand.R")
    _cylinder("MatronCleaverRivet", (hand[0], hand[1] + 0.048, hand[2] + 0.55), 0.036, 0.04, brass, rig, "hand.R", 10, (math.pi / 2, 0, 0))
    _metal_scratch("MatronCleaverScratch", [
        ((hand[0] - 0.15, hand[1] + 0.045, hand[2] + 0.64), (hand[0] + 0.06, hand[1] + 0.045, hand[2] + 0.72)),
        ((hand[0] - 0.1, hand[1] + 0.046, hand[2] + 0.74), (hand[0] + 0.12, hand[1] + 0.046, hand[2] + 0.8)),
    ], scratch, rig, "hand.R")
    _beam("MatronHookChain", (-0.42, 0.17, 0.96), (-0.50, 0.20, 0.72), 0.025, brass, rig, "pelvis", 8)
    _hook("MatronMeatHook", (-0.50, 0.20, 0.52), 0.42, iron, rig, "pelvis")
    _merge_rigid_character_parts(rig, "ProtagonistButcherMatronR8SkinnedMesh")
    create_humanoid_actions(rig)
    return model


def build_vet_sniper():
    reset_scene()
    mats = {
        "skin": _mat("R8 Skin Weathered", "#A8765C", 0.72, shadow="#59362C"),
        "coat": _mat("R8 Sniper Moss Greatcoat", "#40513E", 0.92, shadow="#1B281D"),
        "trousers": _mat("R8 Sniper Coal", "#252D30", 0.88, shadow="#0D1315"),
        "boots": _mat("R8 Dark Leather", "#352720", 0.72, shadow="#160F0C"),
        "hair": _mat("R8 Sniper Hair", "#332F2B", 0.86, shadow="#13100E"),
        "eye_white": _mat("R8 Eye White", "#E6D8C4", 0.62, shadow="#A68C79"),
        "pupil": _mat("R8 Pupil", "#120D0C", 0.54, shadow="#050303"),
        "mouth": _mat("R8 Mouth", "#593032", 0.78, shadow="#251114"),
    }
    leather = _mat("R8 Sniper Saddle Leather", "#704A31", 0.68, shadow="#342015")
    scarf = _mat("R8 Sniper Dust Scarf", "#A56C45", 0.9, shadow="#59331F")
    wear = _mat("R8 Sniper Worn Edge", "#87917B", 0.94, shadow="#455044")
    lens = _mat("R8 Sniper Cyan Accent", "#72C3C5", 0.27, 0.0, "#4AA1AA", 0.28, "#254E55")
    iron = _mat("R8 Shared Scarred Iron", "#8A999B", 0.32, 0.78, shadow="#343E40")
    scratch = _mat("R8 Metal Scratch", "#D8E2DC", 0.2, 0.82, shadow="#738080")
    wood = _mat("R8 Rifle Walnut", "#70402A", 0.67, shadow="#32180F")
    iris = _mat("R8 Sniper Grey Iris", "#6F9291", 0.4, shadow="#304646")
    stubble = _mat("R8 Sniper Stubble", "#463B35", 0.88, shadow="#211814")
    model, rig, j, head_r = _build_body(
        "ProtagonistVetSniperR8", 1.84, 0.67, 0.53, mats,
        {"leg_radius": 0.092, "arm_radius": 0.082, "hand_radius": 0.098, "head_scale": (0.93, 0.92, 1.12)},
    )

    _box("SniperGreatcoatWaist", (0, -0.005, 1.02), (0.58, 0.39, 0.55), mats["coat"], rig, "spine", edge=0.022)
    for side in (-1, 1):
        suffix = "L" if side < 0 else "R"
        tail = add_prism(
            f"SniperCoatTail{suffix}",
            [(side * 0.03, -0.14, 0.98), (side * 0.30, -0.14, 0.98), (side * 0.36, -0.12, 0.28), (side * 0.08, -0.10, 0.46),
             (side * 0.03, 0.10, 0.98), (side * 0.30, 0.10, 0.98), (side * 0.36, 0.08, 0.28), (side * 0.08, 0.08, 0.46)],
            [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], mats["coat"],
        )
        bevel(tail, 0.014, 1)
        _bind(tail, rig, "pelvis")
        _cloth_wear(f"SniperTailWear{suffix}", (side * 0.22, 0.105, 0.34), (0.24, 0.018, 0.05), wear, rig, "pelvis", (0, side * 0.04, side * 0.08))
        _box(f"SniperShoulderTab{suffix}", (side * j["shoulder_x"] * 0.86, 0.03, j["shoulder_z"] + 0.03), (0.22, 0.26, 0.065), leather, rig, f"upper_arm.{suffix}", (0, side * 0.08, 0), 0.012)
        for index in range(3):
            _torus(f"SniperCalfWrap{suffix}{index}", (side * j["leg_x"], 0.015, 0.25 + index * 0.105), 0.104, 0.022, leather, rig, f"shin.{suffix}", major_segments=10)
    _torus("SniperScarfCollar", (0, 0.015, 1.51), 0.245, 0.068, scarf, rig, "chest", major_segments=13)
    _box("SniperScarfTailLong", (-0.34, -0.14, 1.09), (0.16, 0.07, 0.83), scarf, rig, "chest", (0.16, -0.12, -0.22), 0.015)
    _box("SniperScarfTailFork", (-0.50, -0.16, 0.97), (0.12, 0.055, 0.62), wear, rig, "chest", (-0.08, 0.14, 0.30), 0.012)
    _ico("SniperHairCap", (0, -0.02, j["head_z"] + head_r * 0.50), head_r * 0.92, mats["hair"], rig, "head", (0.95, 0.92, 0.55), 2)
    _box("SniperMilitaryCapCrown", (0, -0.015, j["head_z"] + head_r * 0.72), (0.34, 0.30, 0.18), mats["coat"], rig, "head", (0.02, 0, -0.025), 0.025)
    _box("SniperMilitaryCapBrim", (0, 0.16, j["head_z"] + head_r * 0.62), (0.38, 0.24, 0.055), mats["coat"], rig, "head", (0.035, 0, 0), 0.014)
    _box("SniperCapBadge", (0, 0.145, j["head_z"] + head_r * 0.77), (0.09, 0.025, 0.11), lens, rig, "head", (0, 0, 0.08), 0.008)
    _face("Sniper", rig, j, head_r, mats, iris, "steady")
    _beam("SniperCheekScar", (-head_r * 0.66, head_r * 1.02, j["head_z"] + 0.03), (-head_r * 0.25, head_r * 1.05, j["head_z"] - head_r * 0.43), 0.012, scarf, rig, "head", 5)
    for index, (x, z) in enumerate(((-0.12, -0.24), (-0.04, -0.29), (0.06, -0.27), (0.13, -0.22), (-0.15, -0.35), (0.1, -0.36))):
        _ico(f"SniperStubble{index}", (x, head_r * 1.01, j["head_z"] + head_r * z), 0.014, stubble, rig, "head", (1, 0.25, 0.8), 1)
    for side in (-1, 1):
        _box(f"SniperAmmoPouch{side}", (side * 0.2, 0.225, 0.96), (0.17, 0.09, 0.24), leather, rig, "pelvis", (0.05, 0, side * 0.06), 0.012)

    # Permanent back-mounted long rifle owns the silhouette even when gameplay
    # equips a different weapon at WeaponSocket.
    _beam("SniperSignatureRifleBarrel", (-0.29, -0.27, 0.48), (0.37, -0.27, 1.79), 0.048, iron, rig, "chest", 12)
    _cone("SniperRifleMuzzle", (0.39, -0.27, 1.84), 0.08, 0.045, 0.17, iron, rig, "chest", 10, (0, math.radians(-27), 0))
    _box("SniperRifleStock", (-0.34, -0.27, 0.51), (0.23, 0.17, 0.46), wood, rig, "chest", (0, -0.52, 0.08), 0.02)
    _cylinder("SniperRifleScope", (0.08, -0.31, 1.29), 0.069, 0.47, lens, rig, "chest", 12, (0, math.radians(27), 0))
    _cylinder("SniperScopeBell", (0.20, -0.31, 1.52), 0.093, 0.13, iron, rig, "chest", 10, (0, math.radians(27), 0))
    _beam("SniperRifleSling", (-0.38, -0.13, 0.56), (0.34, -0.13, 1.72), 0.021, leather, rig, "chest", 7)
    _box("SniperBoltHandle", (0.09, -0.18, 1.2), (0.18, 0.055, 0.055), iron, rig, "chest", (0, -0.45, 0), 0.01)
    _metal_scratch("SniperRifleScratch", [
        ((-0.04, -0.21, 1.15), (0.10, -0.21, 1.30)),
        ((0.08, -0.21, 1.35), (0.20, -0.21, 1.50)),
    ], scratch, rig, "chest")
    _merge_rigid_character_parts(rig, "ProtagonistVetSniperR8SkinnedMesh")
    create_humanoid_actions(rig)
    return model


def build_mech_youth():
    reset_scene()
    mats = {
        "skin": _mat("R8 Skin Youth", "#C78D67", 0.67, shadow="#754633"),
        "coat": _mat("R8 Mech Slate Jacket", "#536473", 0.88, shadow="#25333E"),
        "trousers": _mat("R8 Mech Soot", "#2A313C", 0.87, shadow="#10151C"),
        "boots": _mat("R8 Dark Leather", "#352720", 0.72, shadow="#160F0C"),
        "hair": _mat("R8 Mech Hair", "#3B2C25", 0.84, shadow="#160E0B"),
        "eye_white": _mat("R8 Eye White", "#E6D8C4", 0.62, shadow="#A68C79"),
        "pupil": _mat("R8 Pupil", "#120D0C", 0.54, shadow="#050303"),
        "mouth": _mat("R8 Mouth", "#6E3432", 0.76, shadow="#2B1111"),
    }
    ochre = _mat("R8 Mech Ochre Leather", "#9B6737", 0.72, shadow="#4B2D17")
    orange = _mat("R8 Mech Signal Orange", "#F47A27", 0.38, 0.62, shadow="#89330E")
    lens = _mat("R8 Mech Cyan Lens", "#6DD4D7", 0.25, 0.0, "#45AEB8", 0.34, "#24535A")
    iron = _mat("R8 Shared Scarred Iron", "#8A999B", 0.32, 0.78, shadow="#343E40")
    scratch = _mat("R8 Metal Scratch", "#D8E2DC", 0.2, 0.82, shadow="#738080")
    patch = _mat("R8 Mech Jacket Wear", "#92A2AA", 0.92, shadow="#53636A")
    iris = _mat("R8 Mech Hazel Iris", "#6C8C55", 0.4, shadow="#314529")
    model, rig, j, head_r = _build_body(
        "ProtagonistMechYouthR8", 1.47, 0.69, 0.59, mats,
        {"leg_radius": 0.11, "arm_radius": 0.092, "hand_radius": 0.12, "head_radius": 0.215, "head_scale": (1.17, 1.02, 1.04)},
    )

    _box("MechJacketHem", (0, 0.01, 0.77), (0.67, 0.42, 0.18), mats["coat"], rig, "spine", edge=0.02)
    _cloth_wear("MechJacketWornHem", (0, 0.23, 0.69), (0.55, 0.022, 0.05), patch, rig, "spine", (0, 0, 0.02))
    _box("MechToolBelt", (0, 0.015, 0.70), (0.73, 0.45, 0.12), ochre, rig, "pelvis", edge=0.018)
    for index, x in enumerate((-0.25, 0, 0.25)):
        _box(f"MechToolPouch{index}", (x, 0.26, 0.65 + (index % 2) * 0.03), (0.17, 0.09, 0.23), ochre, rig, "pelvis", (0, 0, (-1 + index) * 0.06), 0.014)
        _cylinder(f"MechPouchRivet{index}", (x, 0.315, 0.68), 0.023, 0.025, orange, rig, "pelvis", 8, (math.pi / 2, 0, 0))
    for suffix, sign in (("L", -1), ("R", 1)):
        _box(f"MechKneePad{suffix}", (sign * j["leg_x"], 0.115, j["knee_z"]), (0.22, 0.09, 0.19), orange, rig, f"shin.{suffix}", edge=0.018)
        # Both oversized gauntlets are unmistakable even at icon size.
        _box(f"MechOversizeGlove{suffix}", (sign * j["hand_x"], 0.065, j["hand_z"]), (0.23, 0.19, 0.24), orange, rig, f"hand.{suffix}", (0, 0, -sign * 0.06), 0.026)
        _cylinder(f"MechGloveBolt{suffix}", (sign * j["hand_x"], 0.175, j["hand_z"] + 0.03), 0.032, 0.03, iron, rig, f"hand.{suffix}", 8, (math.pi / 2, 0, 0))
    _ico("MechHairCap", (0, -0.015, j["head_z"] + head_r * 0.52), head_r * 0.95, mats["hair"], rig, "head", (1.14, 1.01, 0.54), 2)
    _face("Mech", rig, j, head_r, mats, iris, "curious")
    # Goggles sit high enough for the real eyes to remain readable.
    for suffix, sign in (("L", -1), ("R", 1)):
        _cylinder(f"MechGoggleFrame{suffix}", (sign * 0.105, 0.10, j["head_z"] + 0.205), 0.105, 0.075, orange, rig, "head", 12, (math.pi / 2, 0, 0))
        _cylinder(f"MechGoggleLens{suffix}", (sign * 0.105, 0.145, j["head_z"] + 0.205), 0.078, 0.022, lens, rig, "head", 12, (math.pi / 2, 0, 0))
    _beam("MechGoggleBridge", (-0.035, 0.16, j["head_z"] + 0.205), (0.035, 0.16, j["head_z"] + 0.205), 0.019, orange, rig, "head", 7)
    _beam("MechGoggleStrap", (-0.205, 0.0, j["head_z"] + 0.19), (0.205, 0.0, j["head_z"] + 0.19), 0.022, ochre, rig, "head", 7)
    for index, x in enumerate((-0.12, -0.04, 0.07, 0.13)):
        _ico(f"MechFreckle{index}", (x, head_r * 1.04, j["head_z"] - head_r * (0.12 + (index % 2) * 0.06)), 0.011, mats["mouth"], rig, "head", (1, 0.2, 0.7), 1)

    # The backpack is deliberately wider than the torso and sprouts tools over
    # both shoulders to make the small mechanic recognizable in silhouette.
    _box("MechToolBackpack", (0, -0.30, 1.00), (0.62, 0.31, 0.66), ochre, rig, "chest", (0.03, 0, 0), 0.032)
    _box("MechBackpackTop", (0, -0.31, 1.37), (0.50, 0.27, 0.16), mats["coat"], rig, "chest", edge=0.02)
    for side in (-1, 1):
        _beam(f"MechBackpackStrap{side}", (side * 0.23, 0.18, 1.28), (side * 0.28, 0.14, 0.82), 0.027, ochre, rig, "chest", 8)
    _beam("MechExposedWrenchHandle", (0.28, -0.28, 1.25), (0.46, -0.24, 1.75), 0.036, iron, rig, "chest", 9)
    _torus("MechExposedWrenchRing", (0.48, -0.23, 1.81), 0.095, 0.029, iron, rig, "chest", (math.pi / 2, 0, 0), 12, 4)
    _beam("MechExposedScrewdriver", (-0.30, -0.27, 1.28), (-0.44, -0.25, 1.66), 0.027, scratch, rig, "chest", 8)
    _cylinder("MechScrewdriverGrip", (-0.42, -0.25, 1.61), 0.052, 0.16, orange, rig, "chest", 9, (0.25, 0.06, 0))
    _box("MechChestPatch", (-0.18, 0.225, 1.04), (0.17, 0.026, 0.11), patch, rig, "chest", (0, 0, -0.08), 0.008)
    _metal_scratch("MechWrenchScratch", [
        ((0.34, -0.20, 1.43), (0.39, -0.20, 1.53)),
        ((0.39, -0.20, 1.55), (0.43, -0.20, 1.64)),
    ], scratch, rig, "chest")
    _merge_rigid_character_parts(rig, "ProtagonistMechYouthR8SkinnedMesh")
    create_humanoid_actions(rig)
    return model
