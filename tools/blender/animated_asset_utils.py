"""Rig and NLA helpers shared by the animated R2 Blender assets."""

import math

import bpy
from mathutils import Matrix, Vector


HUMANOID_BONES = (
    "root",
    "pelvis",
    "spine",
    "chest",
    "neck",
    "head",
    "thigh.L",
    "shin.L",
    "foot.L",
    "thigh.R",
    "shin.R",
    "foot.R",
    "upper_arm.L",
    "forearm.L",
    "hand.L",
    "upper_arm.R",
    "forearm.R",
    "hand.R",
)


def _bone(edit_bones, name, head, tail, parent=None):
    bone = edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    bone.roll = 0.0
    bone.use_connect = False
    if parent:
        bone.parent = edit_bones[parent]
    return bone


def create_humanoid_rig(model_root, height, shoulder_width, hip_width):
    """Create the same 18-bone hierarchy for every protagonist."""
    hip_z = height * 0.48
    waist_z = height * 0.62
    chest_z = height * 0.76
    neck_z = height * 0.86
    head_base = height * 0.88
    shoulder_z = height * 0.765
    elbow_z = height * 0.57
    hand_z = height * 0.43
    knee_z = height * 0.27
    ankle_z = height * 0.075
    shoulder_x = shoulder_width * 0.5
    elbow_x = shoulder_width * 0.64
    hand_x = shoulder_width * 0.68
    leg_x = hip_width * 0.27

    joints = {
        "hip_z": hip_z,
        "waist_z": waist_z,
        "chest_z": chest_z,
        "neck_z": neck_z,
        "head_z": height * 0.94,
        "shoulder_z": shoulder_z,
        "elbow_z": elbow_z,
        "hand_z": hand_z,
        "knee_z": knee_z,
        "ankle_z": ankle_z,
        "shoulder_x": shoulder_x,
        "elbow_x": elbow_x,
        "hand_x": hand_x,
        "leg_x": leg_x,
    }

    armature_data = bpy.data.armatures.new("StormSharedHumanoidSkeleton")
    armature = bpy.data.objects.new("StormSharedHumanoidRig", armature_data)
    bpy.context.collection.objects.link(armature)
    armature.parent = model_root
    armature.show_in_front = True
    armature_data.display_type = "STICK"
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    edit = armature_data.edit_bones

    _bone(edit, "root", (0, 0, 0.02), (0, 0, hip_z * 0.52))
    _bone(edit, "pelvis", (0, 0, hip_z * 0.52), (0, 0, hip_z), "root")
    _bone(edit, "spine", (0, 0, hip_z), (0, 0, waist_z), "pelvis")
    _bone(edit, "chest", (0, 0, waist_z), (0, 0, chest_z), "spine")
    _bone(edit, "neck", (0, 0, chest_z), (0, 0, neck_z), "chest")
    _bone(edit, "head", (0, 0, head_base), (0, 0, height), "neck")

    for suffix, sign in (("L", -1), ("R", 1)):
        hip = (sign * leg_x, 0, hip_z)
        knee = (sign * leg_x, 0.015, knee_z)
        ankle = (sign * leg_x, 0.01, ankle_z)
        toe = (sign * leg_x, 0.24, ankle_z * 0.72)
        _bone(edit, f"thigh.{suffix}", hip, knee, "pelvis")
        _bone(edit, f"shin.{suffix}", knee, ankle, f"thigh.{suffix}")
        _bone(edit, f"foot.{suffix}", ankle, toe, f"shin.{suffix}")

        shoulder = (sign * shoulder_x, 0, shoulder_z)
        elbow = (sign * elbow_x, 0.015, elbow_z)
        hand = (sign * hand_x, 0.055, hand_z)
        finger = (sign * hand_x, 0.16, hand_z - height * 0.035)
        _bone(edit, f"upper_arm.{suffix}", shoulder, elbow, "chest")
        _bone(edit, f"forearm.{suffix}", elbow, hand, f"upper_arm.{suffix}")
        _bone(edit, f"hand.{suffix}", hand, finger, f"forearm.{suffix}")

    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    armature.select_set(False)
    return armature, joints


def bone_parent(obj, armature, bone_name):
    """Rigid-bind a low-poly part to a bone without changing its rest transform."""
    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world
    return obj


def add_bone_socket(name, armature, bone_name, location):
    socket = bpy.data.objects.new(name, None)
    socket.empty_display_type = "PLAIN_AXES"
    socket.empty_display_size = 0.08
    bpy.context.collection.objects.link(socket)
    socket.location = location
    return bone_parent(socket, armature, bone_name)


def _reset_pose(armature):
    for bone in armature.pose.bones:
        bone.location = (0.0, 0.0, 0.0)
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)


def _key_pose(armature, frame, rotations=None, locations=None, scales=None):
    _reset_pose(armature)
    rotations = rotations or {}
    locations = locations or {}
    scales = scales or {}
    for name, value in rotations.items():
        armature.pose.bones[name].rotation_euler = value
    for name, value in locations.items():
        armature.pose.bones[name].location = value
    for name, value in scales.items():
        armature.pose.bones[name].scale = value
    for bone in armature.pose.bones:
        bone.keyframe_insert("location", frame=frame, group=bone.name)
        bone.keyframe_insert("rotation_euler", frame=frame, group=bone.name)
        bone.keyframe_insert("scale", frame=frame, group=bone.name)


def _finish_action(target, action, name, start, end):
    action["fps"] = 24
    action["clip_start"] = int(start)
    action["clip_end"] = int(end)
    target.animation_data.action = None
    track = target.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, start, action)
    strip.name = name
    strip.action_frame_start = start
    strip.action_frame_end = end
    strip.extrapolation = "NOTHING"
    strip.blend_type = "REPLACE"


def _new_action(target, name):
    target.animation_data_create()
    action = bpy.data.actions.new(name)
    target.animation_data.action = action
    return action


def create_humanoid_actions(armature):
    """Author the four shared 24fps clips using a consistent retarget pose space."""
    action = _new_action(armature, "idle")
    _key_pose(armature, 1)
    _key_pose(
        armature,
        13,
        rotations={"spine": (0.025, 0, 0), "chest": (-0.018, 0.012, 0)},
        locations={"pelvis": (0, 0, 0.012)},
        scales={"chest": (1.01, 1.01, 1.025)},
    )
    _key_pose(
        armature,
        25,
        rotations={"spine": (-0.012, 0, 0), "head": (0.018, 0, -0.025)},
        locations={"pelvis": (0, 0, -0.006)},
        scales={"chest": (0.995, 0.995, 0.99)},
    )
    _key_pose(
        armature,
        37,
        rotations={"spine": (0.022, 0, 0), "head": (-0.01, 0, 0.018)},
        locations={"pelvis": (0, 0, 0.01)},
        scales={"chest": (1.008, 1.008, 1.02)},
    )
    _key_pose(armature, 49)
    _finish_action(armature, action, "idle", 1, 49)

    action = _new_action(armature, "run")
    for frame, side in ((1, 1), (7, 0), (13, -1), (19, 0), (25, 1)):
        if side:
            _key_pose(
                armature,
                frame,
                rotations={
                    "spine": (0.15, 0, -0.055 * side),
                    "chest": (-0.05, 0, 0.09 * side),
                    "head": (-0.08, 0, -0.035 * side),
                    "thigh.L": (0.72 * side, 0, 0.04),
                    "shin.L": (-0.35 * max(side, 0), 0, 0),
                    "thigh.R": (-0.72 * side, 0, -0.04),
                    "shin.R": (0.35 * min(side, 0), 0, 0),
                    "upper_arm.L": (-0.62 * side, 0, -0.1),
                    "forearm.L": (-0.12, 0, 0),
                    "upper_arm.R": (0.62 * side, 0, 0.1),
                    "forearm.R": (-0.12, 0, 0),
                },
                locations={"root": (0, 0, 0.035)},
            )
        else:
            _key_pose(
                armature,
                frame,
                rotations={
                    "spine": (0.12, 0, 0),
                    "thigh.L": (-0.08, 0, 0),
                    "shin.L": (0.42, 0, 0),
                    "thigh.R": (-0.08, 0, 0),
                    "shin.R": (0.42, 0, 0),
                    "upper_arm.L": (0, 0, -0.08),
                    "upper_arm.R": (0, 0, 0.08),
                },
                locations={"root": (0, 0, -0.012)},
            )
    _finish_action(armature, action, "run", 1, 25)

    # Melee has an explicit anticipation / strike / follow-through / settle arc.
    action = _new_action(armature, "attack_melee")
    _key_pose(armature, 1)
    _key_pose(
        armature,
        7,
        rotations={
            "pelvis": (0, 0, 0.18),
            "spine": (-0.12, 0.12, 0.42),
            "chest": (-0.1, 0.08, 0.5),
            "head": (0, -0.08, -0.24),
            "upper_arm.R": (-1.75, 0.36, 0.58),
            "forearm.R": (-0.72, 0.18, 0.2),
            "hand.R": (0, 0, 0.42),
            "upper_arm.L": (0.28, -0.12, -0.28),
            "thigh.R": (-0.18, 0, 0),
        },
        locations={"root": (0, -0.035, 0.01)},
    )
    _key_pose(
        armature,
        13,
        rotations={
            "pelvis": (0, 0, -0.34),
            "spine": (0.18, -0.12, -0.68),
            "chest": (0.12, -0.08, -0.78),
            "head": (-0.08, 0.06, 0.34),
            "upper_arm.R": (1.28, -0.48, -0.72),
            "forearm.R": (0.46, -0.2, -0.36),
            "hand.R": (0.18, 0, -0.52),
            "upper_arm.L": (-0.3, 0.1, 0.32),
            "thigh.L": (0.16, 0, 0),
        },
        locations={"root": (0, 0.12, -0.025)},
    )
    _key_pose(
        armature,
        19,
        rotations={
            "pelvis": (0, 0, -0.12),
            "spine": (0.08, 0, -0.24),
            "chest": (0.04, 0, -0.28),
            "upper_arm.R": (0.45, -0.1, -0.25),
            "forearm.R": (0.2, 0, -0.12),
        },
        locations={"root": (0, 0.04, 0)},
    )
    _key_pose(armature, 24)
    _finish_action(armature, action, "attack_melee", 1, 24)

    action = _new_action(armature, "attack_ranged")
    _key_pose(armature, 1)
    _key_pose(
        armature,
        5,
        rotations={
            "pelvis": (0, 0, -0.08),
            "spine": (0.05, 0, -0.08),
            "chest": (-0.04, 0, 0.1),
            "head": (-0.06, 0.05, -0.08),
            "upper_arm.R": (1.24, -0.24, -0.22),
            "forearm.R": (0.48, 0.1, -0.08),
            "hand.R": (-0.08, 0, 0),
            "upper_arm.L": (1.08, 0.28, 0.42),
            "forearm.L": (0.78, -0.08, 0.22),
        },
    )
    _key_pose(
        armature,
        8,
        rotations={
            "spine": (0.02, 0, -0.08),
            "chest": (-0.02, 0, 0.1),
            "head": (-0.055, 0.05, -0.08),
            "upper_arm.R": (1.24, -0.24, -0.22),
            "forearm.R": (0.48, 0.1, -0.08),
            "upper_arm.L": (1.08, 0.28, 0.42),
            "forearm.L": (0.78, -0.08, 0.22),
        },
        locations={"root": (0, 0.025, 0)},
    )
    _key_pose(
        armature,
        10,
        rotations={
            "spine": (-0.16, 0, -0.1),
            "chest": (-0.13, 0.03, 0.12),
            "head": (0.08, 0.05, -0.08),
            "upper_arm.R": (0.98, -0.2, -0.22),
            "forearm.R": (0.35, 0.1, -0.08),
            "upper_arm.L": (0.88, 0.24, 0.4),
            "forearm.L": (0.62, -0.08, 0.22),
        },
        locations={"root": (0, -0.09, -0.01)},
    )
    _key_pose(
        armature,
        14,
        rotations={
            "spine": (0.02, 0, -0.04),
            "upper_arm.R": (0.58, -0.1, -0.1),
            "forearm.R": (0.22, 0, 0),
            "upper_arm.L": (0.5, 0.1, 0.16),
            "forearm.L": (0.28, 0, 0.08),
        },
        locations={"root": (0, -0.02, 0)},
    )
    _key_pose(armature, 18)
    _finish_action(armature, action, "attack_ranged", 1, 18)

    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 49
    bpy.context.scene.frame_set(1)
    _reset_pose(armature)


def create_object_clip(target, clip_name, keyframes):
    """Add an NLA track; same-named tracks merge into one glTF AnimationGroup."""
    action = _new_action(target, f"{target.name}_{clip_name}")
    for frame, values in keyframes:
        if "location" in values:
            target.location = values["location"]
            target.keyframe_insert("location", frame=frame)
        if "rotation" in values:
            target.rotation_mode = "XYZ"
            target.rotation_euler = values["rotation"]
            target.keyframe_insert("rotation_euler", frame=frame)
        if "scale" in values:
            target.scale = values["scale"]
            target.keyframe_insert("scale", frame=frame)
    _finish_action(target, action, clip_name, keyframes[0][0], keyframes[-1][0])


def make_loop_linear(action):
    """Keep utility available for clips that should not ease at mechanical impacts."""
    for curve in action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "LINEAR"

