"""Build three R8 zombie variants (palette and story-prop variation)."""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from animated_asset_utils import _finish_action, _key_pose, _new_action, bone_parent, create_humanoid_rig
from blender_utils import *
from hero_rig_factory import _rgb


def mat(name, top, bottom, roughness=0.9, metallic=0.0, emission=None, strength=0.0):
    return stylized_material(name, _rgb(top), _rgb(bottom), roughness, metallic, _rgb(emission) if emission else None, strength)


def bind(obj, rig, bone):
    return bone_parent(obj, rig, bone)


def box(name, location, dimensions, material, rig, bone, rotation=(0, 0, 0), edge=0.014):
    obj = add_box(name, location, dimensions, material, rotation)
    bevel(obj, min(edge, min(dimensions) * 0.18), 1)
    return bind(obj, rig, bone)


def vertex_master_material(name, roughness, metallic):
    master = material(name, (1.0, 1.0, 1.0), roughness, metallic)
    nodes = master.node_tree.nodes
    links = master.node_tree.links
    vertex = nodes.new("ShaderNodeVertexColor")
    vertex.layer_name = "StormGradient"
    links.new(vertex.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
    return master


def merge_rigid_zombie_parts(rig, variant):
    """Collapse rigid bone-parented parts into one 18-bone skinned mesh.

    COLOR_0 already contains each source piece's palette/AO gradient.  Swapping
    to two shared master materials before joining preserves that breakup while
    reducing a zombie from ~40 source meshes to one mesh/two primitives.
    """
    surface_master = vertex_master_material(f"R8 Zombie {variant} Shared Surface", 0.91, 0.0)
    metal_master = vertex_master_material(f"R8 Zombie {variant} Shared Metal", 0.34, 0.78)
    meshes = [obj for obj in list(bpy.context.scene.objects) if obj.type == "MESH" and obj.parent == rig and obj.parent_type == "BONE"]
    for obj in meshes:
        source = obj.data.materials[0] if obj.data.materials else None
        bsdf = source.node_tree.nodes.get("Principled BSDF") if source and source.use_nodes else None
        metallic = float(bsdf.inputs["Metallic"].default_value) if bsdf else 0.0
        obj.data.materials.clear()
        obj.data.materials.append(metal_master if metallic >= 0.5 else surface_master)
        bone_name = obj.parent_bone
        world = obj.matrix_world.copy()
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
    active.name = f"ZombieR8{variant.title()}SkinnedMesh"
    active.parent = rig
    active.parent_type = "OBJECT"
    active.matrix_parent_inverse = rig.matrix_world.inverted()
    for modifier in list(active.modifiers):
        active.modifiers.remove(modifier)
    decimate = active.modifiers.new("R8 Zombie Post-Join Budget", "DECIMATE")
    decimate.ratio = 0.90
    decimate.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = active
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    armature = active.modifiers.new("R8 Zombie Shared Armature", "ARMATURE")
    armature.object = rig

    # Joining can leave duplicate slots that point to the same master. Remap to
    # exactly surface + metal so glTF emits only two primitives.
    old_slots = list(active.data.materials)
    unique = [surface_master, metal_master]
    mapping = {index: unique.index(slot) for index, slot in enumerate(old_slots)}
    for polygon in active.data.polygons:
        polygon.material_index = mapping.get(polygon.material_index, 0)
    active.data.materials.clear()
    for slot in unique:
        active.data.materials.append(slot)
    return active


def enemy_actions(rig):
    action = _new_action(rig, "Idle")
    _key_pose(rig, 1, rotations={"spine": (0.12, 0, -0.08), "head": (-0.10, 0.04, 0.09), "upper_arm.L": (-0.25, 0, -0.18), "upper_arm.R": (-0.18, 0, 0.22)})
    _key_pose(rig, 18, rotations={"spine": (0.18, -0.03, 0.1), "chest": (-0.07, 0, -0.09), "head": (0.08, -0.03, -0.12)}, locations={"pelvis": (0, 0, 0.025)})
    _key_pose(rig, 36, rotations={"spine": (0.12, 0, -0.08), "head": (-0.10, 0.04, 0.09), "upper_arm.L": (-0.25, 0, -0.18), "upper_arm.R": (-0.18, 0, 0.22)})
    _finish_action(rig, action, "Idle", 1, 36)

    action = _new_action(rig, "Walk")
    for frame, side in ((1, 1), (9, 0), (17, -1), (25, 0), (33, 1)):
        if side:
            _key_pose(
                rig, frame,
                rotations={
                    "spine": (0.28, 0, -0.10 * side), "chest": (-0.08, 0, 0.11 * side), "head": (-0.15, 0, -0.05 * side),
                    "thigh.L": (0.52 * side, 0, 0.05), "shin.L": (-0.28 * max(side, 0), 0, 0),
                    "thigh.R": (-0.52 * side, 0, -0.05), "shin.R": (0.28 * min(side, 0), 0, 0),
                    "upper_arm.L": (-0.46 * side - 0.25, 0, -0.18), "forearm.L": (-0.26, 0, 0),
                    "upper_arm.R": (0.46 * side - 0.22, 0, 0.2), "forearm.R": (-0.23, 0, 0),
                },
                locations={"root": (0, 0, 0.035)},
            )
        else:
            _key_pose(rig, frame, rotations={"spine": (0.25, 0, 0), "thigh.L": (-0.06, 0, 0), "shin.L": (0.34, 0, 0), "thigh.R": (-0.06, 0, 0), "shin.R": (0.34, 0, 0)}, locations={"root": (0, 0, -0.015)})
    _finish_action(rig, action, "Walk", 1, 33)

    # 1-7 anticipation, frame 12 active impact, 13-24 recovery.
    action = _new_action(rig, "Idle_Attack")
    _key_pose(rig, 1, rotations={"spine": (0.22, 0, 0)})
    _key_pose(rig, 7, rotations={"pelvis": (0, 0, 0.16), "spine": (-0.12, 0.08, 0.34), "chest": (-0.10, 0.06, 0.42), "upper_arm.R": (-1.32, 0.22, 0.48), "forearm.R": (-0.68, 0.12, 0.16), "upper_arm.L": (-0.9, -0.18, -0.34)}, locations={"root": (0, -0.07, 0.02)})
    _key_pose(rig, 12, rotations={"pelvis": (0, 0, -0.26), "spine": (0.34, -0.08, -0.48), "chest": (0.18, -0.04, -0.58), "head": (-0.12, 0.04, 0.24), "upper_arm.R": (1.16, -0.35, -0.58), "forearm.R": (0.42, -0.12, -0.26), "upper_arm.L": (0.72, 0.24, 0.42)}, locations={"root": (0, 0.15, -0.04)})
    _key_pose(rig, 18, rotations={"spine": (0.24, 0, -0.16), "upper_arm.R": (0.28, 0, -0.16), "upper_arm.L": (0.22, 0, 0.12)})
    _key_pose(rig, 24, rotations={"spine": (0.22, 0, 0)})
    _finish_action(rig, action, "Idle_Attack", 1, 24)

    action = _new_action(rig, "HitReact")
    _key_pose(rig, 1, rotations={"spine": (0.22, 0, 0)})
    _key_pose(rig, 4, rotations={"spine": (-0.34, 0.1, 0.22), "chest": (-0.22, -0.05, 0.26), "head": (0.38, -0.12, -0.24), "upper_arm.L": (-0.5, 0, -0.35), "upper_arm.R": (-0.44, 0, 0.34)}, locations={"root": (0, -0.11, 0.02)})
    _key_pose(rig, 10, rotations={"spine": (0.22, 0, 0)})
    _finish_action(rig, action, "HitReact", 1, 10)

    action = _new_action(rig, "Death")
    _key_pose(rig, 1, rotations={"spine": (0.22, 0, 0)})
    _key_pose(rig, 10, rotations={"pelvis": (0.16, 0, -0.18), "spine": (-0.46, 0.12, 0.34), "chest": (-0.40, 0.08, 0.28), "head": (0.3, -0.12, -0.25), "upper_arm.L": (-0.68, 0.12, -0.45), "upper_arm.R": (0.48, -0.1, 0.38)}, locations={"root": (0, -0.18, -0.2)})
    _key_pose(rig, 22, rotations={"root": (1.32, 0.1, -0.12), "pelvis": (0.45, 0, -0.2), "spine": (-0.66, 0.08, 0.18), "chest": (-0.52, 0.06, 0.14), "head": (0.48, -0.08, -0.18), "thigh.L": (0.52, 0, 0), "shin.L": (-0.5, 0, 0), "thigh.R": (-0.36, 0, 0), "shin.R": (0.36, 0, 0)}, locations={"root": (0, 0.18, -1.12)})
    _key_pose(rig, 32, rotations={"root": (1.5, 0.1, -0.14), "pelvis": (0.5, 0, -0.22), "spine": (-0.72, 0.08, 0.14), "chest": (-0.58, 0.05, 0.10), "head": (0.52, -0.06, -0.16)}, locations={"root": (0, 0.28, -1.36)})
    _finish_action(rig, action, "Death", 1, 32)
    bpy.context.scene.frame_end = 36
    bpy.context.scene.frame_set(1)


VARIANTS = {
    "ash": {
        "skin": ("#87907A", "#3D463A"), "cloth": ("#5A514A", "#2A2421"), "accent": ("#C28A3B", "#68451B"),
        "prop": "road-sign",
    },
    "frost": {
        "skin": ("#809BA0", "#344A50"), "cloth": ("#425A68", "#1B2D37"), "accent": ("#73C6D3", "#2B6875"),
        "prop": "rib-cage",
    },
    "rust": {
        "skin": ("#8C8269", "#40392B"), "cloth": ("#70402F", "#351A13"), "accent": ("#D26732", "#70280F"),
        "prop": "bucket-chain",
    },
}


def build_zombie(variant):
    reset_scene()
    spec = VARIANTS[variant]
    model = root(f"ZombieR8{variant.title()}")
    rig, j = create_humanoid_rig(model, 1.76, 0.68, 0.55)
    skin = mat(f"R8 Zombie {variant} Skin", *spec["skin"], 0.94)
    cloth = mat(f"R8 Zombie {variant} Torn Cloth", *spec["cloth"], 0.97)
    accent = mat(f"R8 Zombie {variant} Accent", *spec["accent"], 0.68, 0.25 if variant != "frost" else 0.0)
    wound = mat("R8 Zombie Wound", "#8F2630", "#3D0910", 0.76)
    bone = mat("R8 Zombie Bone", "#D2C39A", "#716449", 0.92)
    iron = mat("R8 Shared Scarred Iron", "#8A999B", "#343E40", 0.32, 0.78)
    eye = mat("R8 Zombie Sick Eye", "#E2D98E", "#7C743A", 0.48, 0, "#9E9A42", 0.24)
    boots = mat("R8 Zombie Rot Boot", "#342C27", "#130F0D", 0.84)

    for suffix, sign in (("L", -1), ("R", 1)):
        leg_x = sign * j["leg_x"]
        bind(add_beam(f"ZombieThigh{suffix}", (leg_x, 0, j["hip_z"]), (leg_x, 0.02, j["knee_z"]), 0.112, cloth if suffix == "L" else skin, 9), rig, f"thigh.{suffix}")
        bind(add_beam(f"ZombieShin{suffix}", (leg_x, 0.02, j["knee_z"]), (leg_x, 0.06, j["ankle_z"]), 0.098, skin, 9), rig, f"shin.{suffix}")
        bind(add_cylinder(f"ZombieBoot{suffix}", (leg_x, 0.11, j["ankle_z"]), 0.13, 0.32, boots, 9, (math.pi / 2, 0, 0)), rig, f"foot.{suffix}")
        bind(add_beam(f"ZombieUpperArm{suffix}", (sign * j["shoulder_x"], 0, j["shoulder_z"]), (sign * j["elbow_x"], 0.03, j["elbow_z"]), 0.098 if suffix == "L" else 0.082, wound if suffix == "R" else skin, 9), rig, f"upper_arm.{suffix}")
        bind(add_beam(f"ZombieForearm{suffix}", (sign * j["elbow_x"], 0.03, j["elbow_z"]), (sign * j["hand_x"], 0.08, j["hand_z"]), 0.085, skin, 9), rig, f"forearm.{suffix}")
        bind(add_ico(f"ZombieClaw{suffix}", (sign * j["hand_x"], 0.08, j["hand_z"]), 0.12, wound, 2, (0.82, 0.7, 1.18)), rig, f"hand.{suffix}")
        for finger in (-1, 0, 1):
            x = sign * j["hand_x"] + finger * 0.035
            bind(add_cone(f"ZombieClawTip{suffix}{finger}", (x, 0.10, j["hand_z"] - 0.14), 0.025, 0, 0.13, bone, 6), rig, f"hand.{suffix}")

    box("ZombiePelvisRag", (0, 0, j["hip_z"] + 0.10), (0.57, 0.36, 0.31), cloth, rig, "pelvis", (0, 0, 0.05), 0.018)
    box("ZombieTorso", (0, 0, 1.12), (0.62, 0.39, 0.66), cloth, rig, "chest", (0.04, 0, -0.08), 0.025)
    # Ragged garment triangles break the hem and shoulder silhouette.
    for index, (x, width, height) in enumerate(((-0.24, 0.2, 0.28), (0.0, 0.22, 0.18), (0.24, 0.18, 0.32))):
        rag = add_prism(
            f"ZombieTornHem{index}",
            [(x - width / 2, 0.19, 0.91), (x + width / 2, 0.19, 0.91), (x + width * 0.18, 0.20, 0.91 - height),
             (x - width / 2, 0.24, 0.91), (x + width / 2, 0.24, 0.91), (x + width * 0.18, 0.25, 0.91 - height)],
            [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], cloth,
        )
        bind(rag, rig, "spine")
    bind(add_ico("ZombieHead", (0.05, 0.02, j["head_z"]), 0.215, skin, 2, (0.95, 0.92, 1.08)), rig, "head")
    box("ZombieBrokenJaw", (0.08, 0.19, j["head_z"] - 0.15), (0.34, 0.20, 0.17), wound, rig, "head", (0.05, 0, -0.12), 0.018)
    for side in (-1, 1):
        bind(add_ico(f"ZombieEye{side}", (side * 0.085 + 0.05, 0.196, j["head_z"] + 0.05), 0.055 if side < 0 else 0.038, eye, 2, (1, 0.35, 0.82)), rig, "head")
    for index, x in enumerate((-0.08, 0.0, 0.08, 0.15)):
        box(f"ZombieTooth{index}", (x + 0.05, 0.305, j["head_z"] - 0.14 - (index % 2) * 0.02), (0.035, 0.025, 0.075), bone, rig, "head", (0, 0, (index - 1.5) * 0.06), 0.004)
    # Visible humerus and a chest wound are shared horror anchors.
    bind(add_beam("ZombieExposedArmBone", (j["elbow_x"], 0.08, j["elbow_z"] + 0.08), (j["hand_x"] - 0.02, 0.10, j["hand_z"] + 0.06), 0.032, bone, 8), rig, "forearm.R")
    bind(add_ico("ZombieShoulderWound", (j["shoulder_x"] * 0.75, 0.23, j["shoulder_z"] - 0.08), 0.14, wound, 2, (1.1, 0.35, 0.8)), rig, "chest")

    if spec["prop"] == "road-sign":
        bind(add_beam("ZombieRoadSignPost", (-0.30, -0.22, 0.66), (0.34, -0.22, 1.68), 0.038, iron, 8), rig, "chest")
        box("ZombieRoadSignShard", (0.24, -0.22, 1.55), (0.38, 0.07, 0.28), accent, rig, "chest", (0, -0.35, 0.1), 0.018)
        for index, x in enumerate((0.10, 0.24, 0.37)):
            bind(add_ico(f"ZombieRoadSignRivet{index}", (x, -0.265, 1.55), 0.034, iron, 1, (1, 0.55, 1)), rig, "chest")
    elif spec["prop"] == "rib-cage":
        for index in range(4):
            z = 1.02 + index * 0.105
            bind(add_torus(f"ZombieRib{index}", (0, 0.23, z), 0.19 + index * 0.015, 0.021, bone, 11, 3, (math.pi / 2, 0, 0)), rig, "chest")
        bind(add_beam("ZombieFrozenSpine", (0, -0.18, 0.88), (0, -0.18, 1.52), 0.035, accent, 8), rig, "chest")
    else:
        bind(add_cylinder("ZombieBucketHelmet", (0.05, 0, j["head_z"] + 0.16), 0.25, 0.30, iron, 10), rig, "head")
        for index in range(4):
            angle = index * 0.32
            bind(add_torus(f"ZombieChainLink{index}", (-0.34 + index * 0.02, 0.04, 1.30 - index * 0.17), 0.07, 0.018, accent, 9, 3, (math.pi / 2, angle, 0)), rig, "chest")

    merge_rigid_zombie_parts(rig, variant)
    enemy_actions(rig)
    return model


for variant_name in VARIANTS:
    export_glb(f"zombies/zombie-{variant_name}.glb", build_zombie(variant_name), character_forward=True)
