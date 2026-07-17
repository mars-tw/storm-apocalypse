"""Storm R13 authored world-consistency pack.

The ten environment props are procedural low-poly assets.  The two cattle are
bone-authored quadrupeds with real limb-pose locomotion, hurt, eating and death
clips so the interactive pasture does not regress to whole-sprite motion.
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from animated_asset_utils import _bone, _finish_action, _key_pose, _new_action, _reset_pose, bone_parent
from blender_utils import (
    REPO_ROOT,
    add_beam,
    add_box,
    add_cone,
    add_cylinder,
    add_ico,
    add_prism,
    add_roof_prism,
    add_torus,
    bevel,
    export_glb,
    parent_loose,
    reset_scene,
    root,
)
from hero_rig_factory import _mat


WORLD_DIR = "world"


def _world_root(name):
    model = root(name)
    model["storm_release"] = "R13"
    model["storm_style_anchor"] = "R8"
    model["storm_units"] = "meters"
    return model


def _parent_all(model):
    parent_loose(model)
    return model


def _batch_static_by_material(model):
    """Merge rigid prop pieces sharing a material into export draw batches."""
    parent_loose(model)
    groups = {}
    for obj in list(model.children_recursive):
        if obj.type != "MESH" or not obj.data.materials:
            continue
        groups.setdefault(obj.data.materials[0], []).append(obj)
    for material, objects in groups.items():
        if len(objects) == 1:
            objects[0].name = f"{model.name}_{material.name}_Batch"
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        bpy.ops.object.join()
        active.name = f"{model.name}_{material.name}_Batch"
        active.parent = model
    bpy.ops.object.select_all(action="DESELECT")
    return model


def _snow_cap(name, location, scale, material):
    cap = add_ico(name, location, 0.5, material, 2, scale)
    bevel(cap, 0.012)
    return cap


def _create_cow_rig(model, variant):
    data = bpy.data.armatures.new(f"StormR13CowSkeleton{variant.title()}")
    rig = bpy.data.objects.new(f"StormR13CowRig{variant.title()}", data)
    bpy.context.collection.objects.link(rig)
    rig.parent = model
    rig.show_in_front = True
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    edit = data.edit_bones
    _bone(edit, "root", (0, -0.20, 0.05), (0, -0.20, 0.48))
    _bone(edit, "spine", (0, -0.72, 1.02), (0, 0.33, 1.04), "root")
    _bone(edit, "chest", (0, 0.18, 1.04), (0, 0.78, 1.17), "spine")
    _bone(edit, "neck", (0, 0.68, 1.16), (0, 1.04, 1.44), "chest")
    _bone(edit, "head", (0, 0.97, 1.40), (0, 1.47, 1.38), "neck")
    _bone(edit, "tail.base", (0, -0.70, 1.08), (0, -1.09, 1.10), "spine")
    _bone(edit, "tail.tip", (0, -1.09, 1.10), (0, -1.31, 0.73), "tail.base")
    for suffix, sign in (("L", -1), ("R", 1)):
        for prefix, y, parent in (("front", 0.48, "chest"), ("rear", -0.53, "spine")):
            x = sign * 0.42
            _bone(edit, f"{prefix}_upper.{suffix}", (x, y, 0.94), (x, y + 0.015, 0.48), parent)
            _bone(edit, f"{prefix}_lower.{suffix}", (x, y + 0.015, 0.48), (x, y + 0.055, 0.12), f"{prefix}_upper.{suffix}")
            _bone(edit, f"{prefix}_hoof.{suffix}", (x, y + 0.055, 0.12), (x, y + 0.23, 0.10), f"{prefix}_lower.{suffix}")
    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    return rig


def _cow_part(obj, rig, bone):
    return bone_parent(obj, rig, bone)


def _create_cow_actions(rig):
    # Breathing idle is a skeletal clip and keeps the physics root stationary.
    action = _new_action(rig, "idle")
    _key_pose(rig, 1, rotations={"head": (-0.02, 0, -0.03), "tail.base": (0.05, 0, -0.10)})
    _key_pose(rig, 17, rotations={"spine": (0.025, 0, 0), "head": (0.025, 0, 0.04), "tail.base": (-0.06, 0, 0.18)}, locations={"root": (0, 0, 0.012)})
    _key_pose(rig, 33, rotations={"head": (-0.02, 0, -0.03), "tail.base": (0.05, 0, -0.10)})
    _finish_action(rig, action, "idle", 1, 33)

    action = _new_action(rig, "Eating")
    _key_pose(rig, 1, rotations={"neck": (0.18, 0, 0), "head": (-0.10, 0, 0)})
    _key_pose(rig, 13, rotations={"neck": (0.88, 0, 0), "head": (0.34, 0, 0.05), "tail.base": (0.04, 0, -0.16)})
    _key_pose(rig, 25, rotations={"neck": (1.02, 0, 0), "head": (0.22, 0, -0.05), "tail.base": (-0.04, 0, 0.18)})
    _key_pose(rig, 37, rotations={"neck": (0.18, 0, 0), "head": (-0.10, 0, 0)})
    _finish_action(rig, action, "Eating", 1, 37)

    action = _new_action(rig, "Walk")
    for frame, phase in ((1, 1), (9, 0), (17, -1), (25, 0), (33, 1)):
        rotations = {"spine": (0.025, 0, -0.018 * phase), "head": (-0.025, 0, 0.018 * phase), "tail.base": (0.06, 0, -0.22 * phase)}
        if phase:
            # Diagonal quadruped gait visibly changes all four limb poses.
            for prefix, diagonal in (("front", 1), ("rear", -1)):
                rotations[f"{prefix}_upper.L"] = (0.48 * phase * diagonal, 0, 0)
                rotations[f"{prefix}_lower.L"] = (-0.28 * max(phase * diagonal, 0), 0, 0)
                rotations[f"{prefix}_upper.R"] = (-0.48 * phase * diagonal, 0, 0)
                rotations[f"{prefix}_lower.R"] = (0.28 * min(phase * diagonal, 0), 0, 0)
            _key_pose(rig, frame, rotations=rotations, locations={"root": (0, 0, 0.025)})
        else:
            for prefix in ("front", "rear"):
                for suffix in ("L", "R"):
                    rotations[f"{prefix}_upper.{suffix}"] = (-0.07, 0, 0)
                    rotations[f"{prefix}_lower.{suffix}"] = (0.22, 0, 0)
            _key_pose(rig, frame, rotations=rotations, locations={"root": (0, 0, -0.012)})
    _finish_action(rig, action, "Walk", 1, 33)

    action = _new_action(rig, "Idle_HitReact1")
    _key_pose(rig, 1)
    _key_pose(rig, 4, rotations={"spine": (-0.12, 0.10, -0.10), "neck": (-0.22, 0, 0.16), "head": (0.18, 0, -0.18), "tail.base": (-0.24, 0, 0.30)})
    _key_pose(rig, 9, rotations={"spine": (0.07, -0.05, 0.05), "neck": (0.10, 0, -0.08), "head": (-0.08, 0, 0.08)})
    _key_pose(rig, 15)
    _finish_action(rig, action, "Idle_HitReact1", 1, 15)

    action = _new_action(rig, "Death")
    _key_pose(rig, 1, rotations={"neck": (-0.12, 0, 0), "head": (0.12, 0, 0)})
    _key_pose(rig, 8, rotations={"root": (0.02, 0.46, 0.03), "spine": (-0.18, 0, 0.08), "neck": (-0.30, 0, -0.10)}, locations={"root": (0, 0, -0.08)})
    fallen = {"root": (0.04, 1.42, 0.06), "spine": (-0.20, 0, 0.08), "neck": (-0.42, 0, -0.10), "head": (0.20, 0, 0.05)}
    for prefix in ("front", "rear"):
        for suffix, sign in (("L", -1), ("R", 1)):
            fallen[f"{prefix}_upper.{suffix}"] = (0.20 * sign, 0, 0.32 * sign)
            fallen[f"{prefix}_lower.{suffix}"] = (-0.42, 0, 0)
    _key_pose(rig, 18, rotations=fallen, locations={"root": (0, 0, -0.22)})
    _key_pose(rig, 31, rotations=fallen, locations={"root": (0, 0, -0.22)})
    _finish_action(rig, action, "Death", 1, 31)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 37
    bpy.context.scene.frame_set(1)
    _reset_pose(rig)


def build_cow(variant):
    reset_scene()
    title = variant.title()
    model = _world_root(f"NpcCow{title}R13")
    rig = _create_cow_rig(model, variant)
    if variant == "brown":
        hide = _mat("R13 Cow Brown Hide", "#80543B", 0.90, shadow="#39251E")
        patch = _mat("R13 Cow Cream Patch", "#C7AA7A", 0.94, shadow="#735D3C")
        muzzle = _mat("R13 Cow Warm Muzzle", "#B97C6A", 0.86, shadow="#654038")
        horn = _mat("R13 Cow Bone Horn", "#D1B67E", 0.82, shadow="#735A32")
        accent = _mat("R13 Cow Ice Teal Ear Tag", "#5E9FA5", 0.48, 0.18, shadow="#294E52")
    else:
        hide = _mat("R13 Cow Strong Charcoal Hide", "#4A4542", 0.91, shadow="#1D1C1C")
        patch = _mat("R13 Cow Strong Frost Patch", "#B9C5C1", 0.95, shadow="#66716F")
        muzzle = _mat("R13 Cow Strong Muzzle", "#9B6D62", 0.86, shadow="#513530")
        horn = _mat("R13 Cow Strong Horn", "#D7B77A", 0.80, shadow="#6D4A2A")
        accent = _mat("R13 Cow Ember Collar", "#A64832", 0.46, 0.36, "#E16832", 0.48, "#4B1810")
    dark = _mat("R13 Cow Shared Hoof", "#24282A", 0.74, shadow="#0D1011")
    eye = _mat("R13 Cow Shared Amber Eye", "#D89B3F", 0.38, shadow="#6A4216")
    _cow_part(add_ico(f"Cow{title}Body", (0, -0.10, 1.09), 0.72, hide, 3, (1.10, 1.60, 0.80)), rig, "spine")
    _cow_part(add_ico(f"Cow{title}Chest", (0, 0.52, 1.16), 0.60, patch, 3, (1.12, 0.86, 0.96)), rig, "chest")
    _cow_part(add_cone(f"Cow{title}Neck", (0, 0.80, 1.32), 0.43, 0.31, 0.78, hide, 10, (0.34, 0, 0)), rig, "neck")
    _cow_part(add_ico(f"Cow{title}Head", (0, 1.15, 1.47), 0.43, hide, 3, (1.08, 1.12, 0.88)), rig, "head")
    _cow_part(add_ico(f"Cow{title}Muzzle", (0, 1.51, 1.33), 0.31, muzzle, 2, (1.12, 0.84, 0.63)), rig, "head")
    _cow_part(add_ico(f"Cow{title}ForeheadPatch", (0.05, 1.34, 1.61), 0.25, patch, 2, (0.76, 0.34, 0.82)), rig, "head")
    for suffix, sign in (("L", -1), ("R", 1)):
        _cow_part(add_cone(f"Cow{title}Ear{suffix}", (sign * 0.42, 1.13, 1.56), 0.16, 0.04, 0.40, hide, 8, (0, sign * 1.18, 0)), rig, "head")
        _cow_part(add_cone(f"Cow{title}Horn{suffix}", (sign * 0.34, 1.05, 1.83), 0.12, 0.018, 0.50 if variant == "strong" else 0.36, horn, 9, (0, sign * 0.66, 0)), rig, "head")
        _cow_part(add_ico(f"Cow{title}Eye{suffix}", (sign * 0.25, 1.48, 1.53), 0.065, eye, 2, (1.0, 0.30, 0.80)), rig, "head")
        _cow_part(add_ico(f"Cow{title}Pupil{suffix}", (sign * 0.25, 1.53, 1.53), 0.030, dark, 1, (1.0, 0.20, 1.0)), rig, "head")
        if sign > 0:
            _cow_part(add_box(f"Cow{title}EarTag", (sign * 0.52, 1.18, 1.48), (0.09, 0.035, 0.13), accent), rig, "head")
        for prefix, y in (("front", 0.48), ("rear", -0.53)):
            x = sign * 0.42
            upper_bone = f"{prefix}_upper.{suffix}"
            lower_bone = f"{prefix}_lower.{suffix}"
            hoof_bone = f"{prefix}_hoof.{suffix}"
            upper_mat = patch if (prefix == "front") == (suffix == "L") else hide
            _cow_part(add_beam(f"Cow{title}{prefix.title()}Upper{suffix}", (x, y, 0.94), (x, y + 0.015, 0.48), 0.14, upper_mat, 9), rig, upper_bone)
            _cow_part(add_beam(f"Cow{title}{prefix.title()}Lower{suffix}", (x, y + 0.015, 0.48), (x, y + 0.055, 0.14), 0.105, hide, 8), rig, lower_bone)
            _cow_part(add_ico(f"Cow{title}{prefix.title()}Hoof{suffix}", (x, y + 0.14, 0.115), 0.135, dark, 2, (0.86, 1.25, 0.52)), rig, hoof_bone)
    _cow_part(add_beam(f"Cow{title}TailBase", (0, -0.70, 1.08), (0, -1.09, 1.10), 0.085, hide, 8), rig, "tail.base")
    _cow_part(add_beam(f"Cow{title}TailTip", (0, -1.09, 1.10), (0, -1.31, 0.73), 0.065, hide, 7), rig, "tail.tip")
    _cow_part(add_ico(f"Cow{title}TailTuft", (0, -1.32, 0.68), 0.13, dark, 2, (0.82, 0.82, 1.30)), rig, "tail.tip")
    if variant == "strong":
        _cow_part(add_torus("CowStrongEmberCollar", (0, 0.76, 1.28), 0.39, 0.065, accent, 16, 5, (math.pi / 2, 0, 0)), rig, "neck")
        _cow_part(add_box("CowStrongCollarTag", (0, 1.08, 1.11), (0.24, 0.07, 0.31), accent), rig, "neck")
    _create_cow_actions(rig)
    return model


def build_pine(variant):
    reset_scene()
    model = _world_root(f"WorldPine{variant.title()}R13")
    bark = _mat("R13 Shared Pine Bark", "#4C3428", 0.94, shadow="#211713")
    bark_cut = _mat("R13 Shared Pine Cut", "#99714B", 0.89, shadow="#4B3421")
    needles = _mat(f"R13 Pine {variant.title()} Needles", {"sentinel": "#345754", "windswept": "#3E6258", "young": "#4A6E5C"}[variant], 0.96, shadow="#172B2A")
    snow = _mat("R13 Shared Pine Snow", "#C5D9DC", 0.98, shadow="#6E8A91")
    specs = {
        "sentinel": (4.9, 0.31, [(1.2, 1.42), (2.0, 1.22), (2.75, 1.00), (3.45, 0.76), (4.05, 0.50)]),
        "windswept": (4.2, 0.28, [(1.05, 1.28), (1.75, 1.10), (2.42, 0.86), (3.08, 0.63), (3.58, 0.42)]),
        "young": (3.15, 0.23, [(0.78, 0.96), (1.35, 0.82), (1.90, 0.66), (2.42, 0.46)]),
    }
    height, trunk_radius, tiers = specs[variant]
    trunk = add_cylinder(f"Pine{variant.title()}Trunk", (0, 0, height * 0.44), trunk_radius, height * 0.88, bark, 8)
    trunk.parent = model
    stump = add_cylinder(f"Pine{variant.title()}RootCollar", (0, 0, 0.10), trunk_radius * 1.45, 0.20, bark_cut, 9)
    stump.parent = model
    lean = -0.12 if variant == "windswept" else 0.0
    for index, (z, radius) in enumerate(tiers):
        x = lean * index
        crown = add_cone(f"Pine{variant.title()}Crown{index}", (x, 0, z + 0.38), radius, 0.05, 1.22 if variant != "young" else 0.96, needles, 9, (0, 0.08 * (index % 2), 0))
        crown.parent = model
        cap = add_cone(f"Pine{variant.title()}SnowCap{index}", (x - 0.04, -0.03, z + 0.78), radius * 0.82, 0.035, 0.25, snow, 9, (0.04, 0, -0.05 if variant == "windswept" else 0))
        cap.parent = model
    return _batch_static_by_material(model)


def build_rock(variant):
    reset_scene()
    model = _world_root(f"WorldRock{variant.title()}R13")
    stone = _mat(f"R13 Rock {variant.title()} Stone", "#53636A" if variant == "shelf" else "#46565D", 0.91, 0.02, shadow="#222E33")
    fracture = _mat("R13 Shared Rock Fracture", "#76878B", 0.88, shadow="#3A484C")
    snow = _mat("R13 Shared Rock Snow", "#C4D8DA", 0.98, shadow="#718A8E")
    if variant == "shelf":
        body = add_ico("RockShelfBody", (0, 0, 0.55), 0.88, stone, 2, (1.48, 0.88, 0.68))
        slab = add_prism("RockShelfFracture", [(-0.72, -0.32, 0.48), (0.75, -0.28, 0.53), (0.55, 0.30, 0.67), (-0.55, 0.34, 0.66), (-0.34, -0.08, 1.05)], [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (0, 3, 2, 1)], fracture)
        cap = _snow_cap("RockShelfSnow", (-0.08, -0.03, 1.00), (1.28, 0.72, 0.22), snow)
        for item in (body, slab, cap):
            item.parent = model
    else:
        body = add_ico("RockSpireBody", (0, 0, 0.78), 0.94, stone, 2, (0.78, 0.92, 1.28))
        chip = add_ico("RockSpireChip", (0.52, 0.05, 0.37), 0.43, fracture, 1, (0.78, 0.92, 0.68))
        cap = _snow_cap("RockSpireSnow", (-0.06, -0.03, 1.63), (0.67, 0.74, 0.20), snow)
        for item in (body, chip, cap):
            item.parent = model
    return _batch_static_by_material(model)


def build_fence(variant):
    reset_scene()
    model = _world_root(f"WorldFence{variant.title()}R13")
    wood = _mat("R13 Shared Fence Weathered Wood", "#75513A", 0.93, shadow="#38271F")
    cut = _mat("R13 Shared Fence Cut Wood", "#A98158", 0.89, shadow="#58402A")
    iron = _mat("R13 Shared Fence Iron", "#4E5B5D", 0.38, 0.72, shadow="#20282A")
    snow = _mat("R13 Shared Fence Snow", "#C6DADC", 0.98, shadow="#718B90")
    post_xs = (-1.22, 1.22) if variant == "rail" else (-1.38, 1.38)
    for index, x in enumerate(post_xs):
        post = add_box(f"Fence{variant.title()}Post{index}", (x, 0, 0.88), (0.25, 0.28, 1.76), wood)
        bevel(post, 0.035)
        post.parent = model
        cap = add_cone(f"Fence{variant.title()}PostCap{index}", (x, 0, 1.86), 0.22, 0.03, 0.33, cut, 6)
        cap.parent = model
        snow_cap = add_cone(f"Fence{variant.title()}PostSnow{index}", (x - 0.03, -0.02, 2.03), 0.25, 0.04, 0.14, snow, 7)
        snow_cap.parent = model
    if variant == "rail":
        for index, z in enumerate((0.62, 1.25)):
            rail = add_box(f"FenceRail{index}", (0, 0, z), (2.70, 0.20, 0.20), wood, (0, -0.06 * (index * 2 - 1), 0))
            bevel(rail, 0.028)
            rail.parent = model
            drift = add_box(f"FenceRailSnow{index}", (-0.06, -0.03, z + 0.13), (2.46, 0.22, 0.07), snow, (0, -0.06 * (index * 2 - 1), 0))
            bevel(drift, 0.018)
            drift.parent = model
    else:
        gate = add_box("FenceGatePanel", (0, 0, 0.93), (2.45, 0.18, 1.38), wood)
        gate.parent = model
        for z in (0.50, 1.36):
            brace = add_box(f"FenceGateRail{z}", (0, -0.13, z), (2.28, 0.12, 0.16), cut)
            brace.parent = model
        diagonal = add_beam("FenceGateDiagonal", (-1.02, -0.14, 0.43), (1.02, -0.14, 1.45), 0.085, cut, 7)
        diagonal.parent = model
        for x in (-1.09, 1.09):
            hinge = add_cylinder(f"FenceGateHinge{x}", (x, -0.18, 0.98), 0.07, 0.22, iron, 8, (math.pi / 2, 0, 0))
            hinge.parent = model
        latch = add_box("FenceGateLatch", (0.87, -0.20, 1.13), (0.38, 0.12, 0.13), iron)
        latch.parent = model
        snow_bank = add_box("FenceGateSnow", (0, -0.03, 1.68), (2.28, 0.20, 0.08), snow)
        bevel(snow_bank, 0.020)
        snow_bank.parent = model
    return _batch_static_by_material(model)


def build_snowhouse_shell():
    reset_scene()
    model = _world_root("WorldSnowhouseShellR13")
    wood = _mat("R13 Snowhouse Timber", "#6B4935", 0.92, shadow="#2F211A")
    plaster = _mat("R13 Snowhouse Frost Plaster", "#AFC6C9", 0.97, shadow="#5A767D")
    roof = _mat("R13 Snowhouse Roof Charcoal", "#34444A", 0.89, shadow="#172329")
    snow = _mat("R13 Snowhouse Roof Snow", "#C8DBDD", 0.99, shadow="#728B90")
    stone = _mat("R13 Snowhouse Foundation", "#536168", 0.91, shadow="#252F34")
    floor = add_box("SnowhouseFoundation", (0, 0, 0.18), (4.90, 4.25, 0.36), stone)
    bevel(floor, 0.08)
    floor.parent = model
    # Separate wall planes preserve chunky readable forms while keeping a clean
    # door/window overlay contract for the other two GLBs.
    for name, loc, dims in (
        ("Front", (0, 2.00, 1.35), (4.80, 0.24, 2.34)),
        ("Back", (0, -2.00, 1.35), (4.80, 0.24, 2.34)),
        ("Left", (-2.28, 0, 1.35), (0.24, 3.78, 2.34)),
        ("Right", (2.28, 0, 1.35), (0.24, 3.78, 2.34)),
    ):
        wall = add_box(f"SnowhouseWall{name}", loc, dims, plaster)
        bevel(wall, 0.045)
        wall.parent = model
    for x in (-2.15, 2.15):
        for y in (-1.84, 1.84):
            post = add_box(f"SnowhouseCorner{x}{y}", (x, y, 1.44), (0.26, 0.27, 2.58), wood)
            bevel(post, 0.035)
            post.parent = model
    roof_body = add_roof_prism("SnowhouseRoof", (0, 0, 2.52), 5.42, 4.65, 0.10, 1.38, roof)
    roof_body.parent = model
    roof_snow = add_roof_prism("SnowhouseRoofSnow", (-0.08, -0.03, 2.70), 5.62, 4.84, 0.10, 1.46, snow)
    roof_snow.parent = model
    chimney = add_box("SnowhouseChimney", (-1.42, -0.56, 3.67), (0.55, 0.55, 1.18), stone)
    bevel(chimney, 0.055)
    chimney.parent = model
    chimney_cap = add_box("SnowhouseChimneySnow", (-1.47, -0.58, 4.33), (0.70, 0.68, 0.18), snow)
    bevel(chimney_cap, 0.055)
    chimney_cap.parent = model
    return _batch_static_by_material(model)


def build_snowhouse_door():
    reset_scene()
    model = _world_root("WorldSnowhouseDoorR13")
    wood = _mat("R13 Snowhouse Door Oxblood", "#803743", 0.86, shadow="#3B1721")
    trim = _mat("R13 Snowhouse Door Timber", "#765238", 0.91, shadow="#38261A")
    iron = _mat("R13 Snowhouse Door Iron", "#4D5A5B", 0.36, 0.74, shadow="#20282A")
    brass = _mat("R13 Snowhouse Door Brass", "#C8903E", 0.34, 0.70, shadow="#67461A")
    snow = _mat("R13 Snowhouse Door Snow", "#C7DBDD", 0.99, shadow="#718B90")
    panel = add_box("SnowhouseDoorPanel", (0, 0, 1.05), (1.18, 0.16, 2.10), wood)
    bevel(panel, 0.055)
    panel.parent = model
    for x in (-0.70, 0.70):
        jamb = add_box(f"SnowhouseDoorJamb{x}", (x, 0, 1.11), (0.20, 0.24, 2.34), trim)
        bevel(jamb, 0.028)
        jamb.parent = model
    header = add_box("SnowhouseDoorHeader", (0, 0, 2.28), (1.58, 0.24, 0.22), trim)
    bevel(header, 0.028)
    header.parent = model
    for z in (0.48, 1.08, 1.68):
        strap = add_box(f"SnowhouseDoorStrap{z}", (0, -0.12, z), (1.02, 0.08, 0.09), iron)
        strap.parent = model
    handle = add_torus("SnowhouseDoorHandle", (0.35, -0.17, 1.08), 0.12, 0.027, brass, 10, 4, (math.pi / 2, 0, 0))
    handle.parent = model
    drift = add_box("SnowhouseDoorSnowDrift", (-0.06, -0.03, 2.43), (1.50, 0.25, 0.11), snow)
    bevel(drift, 0.025)
    drift.parent = model
    return _batch_static_by_material(model)


def build_snowhouse_window():
    reset_scene()
    model = _world_root("WorldSnowhouseWindowR13")
    trim = _mat("R13 Snowhouse Window Timber", "#755038", 0.91, shadow="#38251A")
    glass = _mat("R13 Snowhouse Warm Glass", "#E1A24C", 0.26, 0.02, "#F08A32", 0.55, "#71451B")
    iron = _mat("R13 Snowhouse Window Iron", "#4C5859", 0.38, 0.72, shadow="#20282A")
    snow = _mat("R13 Snowhouse Window Snow", "#C8DBDD", 0.99, shadow="#728B90")
    glass_panel = add_box("SnowhouseWindowGlass", (0, 0, 0.86), (1.25, 0.12, 1.18), glass)
    glass_panel.parent = model
    for x in (-0.73, 0.73):
        side = add_box(f"SnowhouseWindowSide{x}", (x, 0, 0.86), (0.18, 0.22, 1.48), trim)
        bevel(side, 0.025)
        side.parent = model
    for z in (0.12, 1.60):
        cross = add_box(f"SnowhouseWindowRail{z}", (0, 0, z), (1.62, 0.22, 0.18), trim)
        bevel(cross, 0.025)
        cross.parent = model
    mullion = add_box("SnowhouseWindowMullion", (0, -0.10, 0.86), (0.08, 0.08, 1.15), iron)
    mullion.parent = model
    transom = add_box("SnowhouseWindowTransom", (0, -0.10, 0.86), (1.22, 0.08, 0.08), iron)
    transom.parent = model
    sill = add_box("SnowhouseWindowSillSnow", (-0.04, -0.04, 1.74), (1.70, 0.27, 0.13), snow)
    bevel(sill, 0.03)
    sill.parent = model
    return _batch_static_by_material(model)


ASSETS = (
    ("cow-brown.glb", lambda: build_cow("brown"), True),
    ("cow-strong.glb", lambda: build_cow("strong"), True),
    ("pine-sentinel.glb", lambda: build_pine("sentinel"), False),
    ("pine-windswept.glb", lambda: build_pine("windswept"), False),
    ("pine-young.glb", lambda: build_pine("young"), False),
    ("rock-shelf.glb", lambda: build_rock("shelf"), False),
    ("rock-spire.glb", lambda: build_rock("spire"), False),
    ("fence-rail.glb", lambda: build_fence("rail"), False),
    ("fence-gate.glb", lambda: build_fence("gate"), False),
    ("snowhouse-shell.glb", build_snowhouse_shell, False),
    ("snowhouse-door.glb", build_snowhouse_door, False),
    ("snowhouse-window.glb", build_snowhouse_window, False),
)


def render_contact_sheet():
    reset_scene()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 1.25
    scene.world.color = (0.018, 0.030, 0.038)
    evidence = REPO_ROOT / "docs" / "evidence" / "R13_art" / "world-pack-agx.png"
    evidence.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(evidence)

    floor_mat = _mat("R13 Evidence Snow", "#91A8AC", 0.98, shadow="#40565C")
    floor = add_box("EvidenceFloor", (0, 0, -0.12), (18, 13, 0.24), floor_mat)
    floor.location.y = 0
    labels = []
    placements = [
        (-6.5, 2.4, 0.75), (-3.8, 2.4, 0.75), (-0.8, 2.5, 0.62), (1.3, 2.5, 0.62), (3.3, 2.5, 0.70), (5.4, 2.5, 0.88),
        (-6.4, -2.4, 0.88), (-4.1, -2.4, 0.78), (-1.4, -2.4, 0.78), (2.1, -2.2, 0.46), (5.2, -2.2, 0.75), (7.0, -2.2, 0.75),
    ]
    for (filename, _, _), (x, y, scale) in zip(ASSETS, placements):
        before = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(REPO_ROOT / "public" / "models" / "custom" / WORLD_DIR / filename))
        imported = [obj for obj in bpy.context.scene.objects if obj not in before and obj.parent is None]
        for obj in imported:
            obj.location.x += x
            obj.location.y += y
            obj.scale *= scale
        labels.append(filename)

    bpy.ops.object.camera_add(location=(13.8, 18.2, 13.3))
    camera = bpy.context.object
    camera.data.lens = 55
    camera.rotation_euler = (Vector((0.4, 0.0, 1.5)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    for name, kind, location, energy, color, size in (
        ("R13WarmKey", "AREA", (-7.0, 5.0, 10.0), 1400, (1.0, 0.58, 0.30), 5.8),
        ("R13ColdFill", "AREA", (7.0, 4.0, 7.0), 850, (0.34, 0.70, 0.84), 6.5),
        ("R13Rim", "AREA", (0.0, -8.0, 8.0), 1050, (0.94, 0.31, 0.12), 3.4),
        ("R13Bounce", "AREA", (0.0, 3.0, 1.0), 620, (0.52, 0.72, 0.76), 7.5),
    ):
        bpy.ops.object.light_add(type=kind, location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.color = color
        light.data.shape = "DISK"
        light.data.size = size
        light.rotation_euler = (Vector((0.0, 0.0, 1.4)) - light.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED {evidence} | {evidence.stat().st_size} bytes | {len(labels)} assets")


for filename, builder, character_forward in ASSETS:
    export_glb(f"{WORLD_DIR}/{filename}", builder(), character_forward=character_forward)

render_contact_sheet()
