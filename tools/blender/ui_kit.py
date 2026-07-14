"""Storm R8 Blender-rendered UI kit.

All gameplay icons are framed from GLBs, the selection art uses the exported
18-bone protagonists, and every render shares STORM_UI_PRESET. Run with:

  blender --background --python tools/blender/ui_kit.py
"""

import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
MODEL_ROOT = REPO_ROOT / "public" / "models"
UI_ROOT = REPO_ROOT / "public" / "images" / "ui"
CHARACTER_ROOT = REPO_ROOT / "public" / "images" / "characters"

STORM_UI_PRESET = {
    "name": "R8.1 Exposure Recovery",
    "renderer": "EEVEE",
    "view_transform": "AgX",
    "look": "AgX Base",
    "exposure_ev": 1.25,
    "transparent_icons": True,
    "camera": {"lens_mm": 62, "turntable_yaw_deg": -28, "pitch_deg": 17},
    "lighting": {
        "key": {"color": "#FFC58A", "energy": 1400, "size": 5.8},
        "fill": {"color": "#70B3C4", "energy": 850, "size": 6.5},
        "bounce": {"color": "#A9CED4", "energy": 620, "size": 7.5},
        "rim": {"color": "#F06735", "energy": 1050, "size": 3.4},
    },
    "palette": {
        "night": "#07131A",
        "steel": "#242B2C",
        "rust": "#8F3B1F",
        "sand": "#C18652",
        "ice": "#79C3D2",
        "signal": "#E36D3E",
    },
    "characterPalettes": {
        "butcher_matron": {
            "main": ["#962D3D", "#31434A", "#D2A78F"],
            "accent": "#E4A340",
            "story": "oxblood apron / charcoal wool / worn canvas / brass tally",
        },
        "vet_sniper": {
            "main": ["#40513E", "#252D30", "#704A31"],
            "accent": "#72C3C5",
            "story": "moss greatcoat / coal layer / saddle leather / cold optic",
        },
        "mech_youth": {
            "main": ["#536473", "#2A313C", "#9B6737"],
            "accent": "#F47A27",
            "story": "slate jacket / soot workwear / ochre kit / signal-orange tools",
        },
    },
    "surfaceResponse": {
        "skin": {"roughness": 0.67, "metallic": 0.0},
        "cloth": {"roughness": 0.90, "metallic": 0.0},
        "leather": {"roughness": 0.70, "metallic": 0.0},
        "metal": {"roughness": 0.32, "metallic": 0.78},
        "volumeBreakup": "COLOR_0 vertical AO gradient",
        "wear": "contrasting cloth hem geometry + metallic scratch highlights",
        "albedoValueRange": [0.25, 0.8],
    },
    "tiers": {
        "low": {"atlas_cell": 128, "portrait": [256, 384], "background": [960, 540]},
        "medium": {"atlas_cell": 192, "portrait": [384, 576], "background": [1280, 720]},
        "high": {"atlas_cell": 256, "portrait": [512, 768], "background": [1920, 1080]},
    },
}

ICON_SPECS = [
    ("tower-ballista", "custom/tower-ballista.glb", "asset", None),
    ("tower-frost", "custom/tower-frost.glb", "asset", None),
    ("tower-cannon", "custom/tower-cannon.glb", "asset", None),
    ("weapon-machete", "custom/weapons/machete.glb", "asset", None),
    ("weapon-axe", "custom/weapons/axe.glb", "asset", None),
    ("weapon-smg", "custom/weapons/smg.glb", "asset", None),
    ("skill-butcher", "custom/characters/protagonist-butcher-matron.glb", "hero", "butcher"),
    ("skill-sniper", "custom/characters/protagonist-vet-sniper.glb", "hero", "sniper"),
    ("skill-mechanic", "custom/characters/protagonist-mech-youth.glb", "hero", "mechanic"),
    ("skill-hunter", "survivor.glb", "asset", None),
    ("skill-cashier", "custom/cash-register.glb", "asset", None),
    ("skill-dog", "custom/doghouse.glb", "asset", None),
]

HERO_SPECS = [
    ("protagonist-butcher-matron", "custom/characters/protagonist-butcher-matron.glb", "butcher"),
    ("protagonist-vet-sniper", "custom/characters/protagonist-vet-sniper.glb", "sniper"),
    ("protagonist-mech-youth", "custom/characters/protagonist-mech-youth.glb", "mechanic"),
]


def srgb(hex_value):
    value = hex_value.lstrip("#")
    channels = [int(value[index:index + 2], 16) / 255 for index in (0, 2, 4)]
    return tuple(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.users == 0:
            bpy.data.collections.remove(collection)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.armatures, bpy.data.actions):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def configure_render(width, height, transparent):
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 72
    scene.render.fps = 24
    scene.view_settings.view_transform = "AgX"
    # Blender 5 labels the neutral AgX look "None"; older builds expose it as
    # "AgX - Base Contrast".  Both are the uncrushed base response requested
    # for the R8.1 studio renders.
    for neutral_look in ("AgX - Base Contrast", "None"):
        try:
            scene.view_settings.look = neutral_look
            break
        except TypeError:
            continue
    scene.view_settings.exposure = 1.25
    world = bpy.data.worlds.new("Storm R6 World") if not scene.world else scene.world
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (*srgb("#07131A"), 1)
    background.inputs["Strength"].default_value = 0.38 if transparent else 0.58
    return scene


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_camera(location, target, lens=62, ortho_scale=None):
    bpy.ops.object.camera_add(location=location)
    camera = bpy.context.object
    camera.name = "StormUiCamera"
    camera.data.lens = lens
    if ortho_scale:
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = ortho_scale
    look_at(camera, target)
    bpy.context.scene.camera = camera
    return camera


def add_area_light(name, location, target, energy, color, size):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.color = srgb(color)
    light.data.shape = "DISK"
    light.data.size = size
    look_at(light, target)
    return light


def add_lighting(target, scale=1.0):
    tx, ty, tz = target
    falloff = max(1.0, scale * scale)
    add_area_light("StormKey", (tx - 4.4 * scale, ty - 4.6 * scale, tz + 6.2 * scale), target, 1400 * falloff, "#FFC58A", 5.8 * scale)
    add_area_light("StormFill", (tx + 4.5 * scale, ty - 1.0 * scale, tz + 3.1 * scale), target, 850 * falloff, "#70B3C4", 6.5 * scale)
    add_area_light("StormBounce", (tx - 0.4 * scale, ty - 1.4 * scale, tz - 1.8 * scale), target, 620 * falloff, "#A9CED4", 7.5 * scale)
    add_area_light("StormRim", (tx + 0.5 * scale, ty + 4.2 * scale, tz + 4.6 * scale), target, 1050 * falloff, "#F06735", 3.4 * scale)


def import_glb(relative_path):
    path = MODEL_ROOT / relative_path
    if not path.exists():
        raise FileNotFoundError(f"Missing required GLB: {path}")
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path), import_shading="NORMALS")
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    if not any(obj.type == "MESH" for obj in imported):
        raise RuntimeError(f"GLB contains no renderable mesh: {path}")
    return imported


def object_bounds(objects):
    points = []
    for obj in objects:
        if obj.type != "MESH" or not obj.visible_get():
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return Vector((-1, -1, 0)), Vector((1, 1, 2))
    return (
        Vector(tuple(min(point[index] for point in points) for index in range(3))),
        Vector(tuple(max(point[index] for point in points) for index in range(3))),
    )


def pose_hero(objects, pose):
    armature = next((obj for obj in objects if obj.type == "ARMATURE"), None)
    if not armature:
        return
    armature.animation_data_clear()
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.location = (0, 0, 0)
        bone.rotation_euler = (0, 0, 0)
    poses = {
        "butcher": {
            "rotations": {
                "pelvis": (0, 0, 0.18), "spine": (-0.08, 0.05, 0.22), "chest": (-0.07, 0.10, 0.30),
                "head": (-0.04, -0.10, -0.18), "upper_arm.R": (-1.48, 0.34, 0.58), "forearm.R": (-0.72, 0.20, 0.24),
                "hand.R": (0.02, 0.82, 0.18), "upper_arm.L": (0.38, -0.12, -0.55), "forearm.L": (-0.62, 0.08, -0.24),
                "hand.L": (0, 0, -0.32), "thigh.R": (-0.14, 0, 0),
            },
            "locations": {"pelvis": (0, 0, 0.03)},
        },
        "sniper": {
            "rotations": {
                "pelvis": (0.05, 0, -0.11), "spine": (0.18, 0.04, -0.16), "chest": (-0.08, 0.02, 0.18), "head": (-0.11, 0.08, -0.12),
                "upper_arm.R": (1.28, -0.30, -0.24), "forearm.R": (0.58, 0.12, -0.10),
                "upper_arm.L": (1.12, 0.30, 0.46), "forearm.L": (0.84, -0.10, 0.24),
                "thigh.L": (1.18, 0.04, 0.08), "shin.L": (-1.35, 0, 0), "foot.L": (0.32, 0, 0),
                "thigh.R": (-0.42, 0, -0.04), "shin.R": (0.72, 0, 0),
            },
            "locations": {"pelvis": (0, 0, -0.35), "root": (0, 0, 0.02)},
        },
        "mechanic": {
            "rotations": {
                "pelvis": (0.10, 0, -0.12), "spine": (0.22, 0, -0.18), "chest": (-0.05, 0.05, 0.20),
                "head": (-0.16, -0.05, -0.14), "upper_arm.R": (0.72, 0.12, 0.45), "forearm.R": (-0.92, 0.08, 0.28),
                "upper_arm.L": (0.62, -0.10, -0.40), "forearm.L": (-0.82, 0, -0.20),
                "thigh.L": (1.08, 0.05, 0.16), "shin.L": (-1.36, 0, 0), "foot.L": (0.38, 0, 0),
                "thigh.R": (0.94, -0.04, -0.14), "shin.R": (-1.28, 0, 0), "foot.R": (0.34, 0, 0),
            },
            "locations": {"pelvis": (0, 0, -0.39)},
        },
    }
    for name, rotation in poses[pose]["rotations"].items():
        if name in armature.pose.bones:
            armature.pose.bones[name].rotation_euler = rotation
    for name, location in poses[pose].get("locations", {}).items():
        if name in armature.pose.bones:
            armature.pose.bones[name].location = location
    bpy.context.view_layer.update()


def add_pose_beam(name, start, end, radius, material, vertices=12):
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=delta.length, location=(start_v + end_v) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def add_pose_story_prop(pose):
    """Add render-only interaction props while the GLB keeps its own silhouette kit."""
    if pose == "sniper":
        iron = make_material("Portrait Rifle Iron", "#526064", 0.31, 0.82)
        wood = make_material("Portrait Rifle Walnut", "#70402A", 0.68)
        lens = make_material("Portrait Rifle Optic", "#72C3C5", 0.25, 0, "#4AA1AA", 0.28)
        add_pose_beam("PortraitAimedRifleBarrel", (-0.72, -0.48, 1.03), (0.98, -0.48, 1.34), 0.045, iron, 14)
        stock = add_cube("PortraitAimedRifleStock", (-0.58, -0.48, 0.99), (0.42, 0.17, 0.21), wood, 0.025)
        stock.rotation_euler.y = math.radians(-10)
        scope = add_pose_beam("PortraitAimedRifleScope", (-0.05, -0.52, 1.27), (0.42, -0.52, 1.35), 0.067, lens, 12)
        scope.rotation_euler.rotate_axis("Z", 0.0)
    elif pose == "mechanic":
        iron = make_material("Portrait Repair Iron", "#7F9092", 0.35, 0.76)
        orange = make_material("Portrait Repair Accent", "#F47A27", 0.38, 0.58)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.20, minor_radius=0.055, major_segments=14, minor_segments=4, location=(0.32, -0.32, 0.16), rotation=(math.pi / 2, 0, 0))
        gear = bpy.context.object
        gear.name = "PortraitRepairGear"
        gear.data.materials.append(iron)
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.075, depth=0.13, location=(0.32, -0.32, 0.16), rotation=(math.pi / 2, 0, 0))
        hub = bpy.context.object
        hub.name = "PortraitRepairHub"
        hub.data.materials.append(orange)
        add_pose_beam("PortraitLooseBolt", (0.58, -0.33, 0.08), (0.69, -0.33, 0.16), 0.025, iron, 8)


def render_to(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    if not path.exists() or path.stat().st_size < 1024:
        raise RuntimeError(f"Render is missing or too small: {path}")
    print(f"R8 UI RENDER {path.relative_to(REPO_ROOT)} | {path.stat().st_size} bytes")


def render_icon(name, model_path, kind, pose):
    clear_scene()
    configure_render(256, 256, True)
    objects = import_glb(model_path)
    if kind == "hero":
        pose_hero(objects, pose)
        add_pose_story_prop(pose)
        objects = list(bpy.context.scene.objects)
    minimum, maximum = object_bounds(objects)
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    span = max(size.x, size.y, size.z)
    add_camera((center.x + span * 1.55, center.y - span * 2.25, center.z + span * 1.2), center, ortho_scale=span * 1.32)
    add_lighting(center, max(0.65, span / 3.2))
    render_to(UI_ROOT / "icons" / f"{name}.png")


def render_portrait(name, model_path, pose):
    clear_scene()
    configure_render(512, 768, True)
    objects = import_glb(model_path)
    pose_hero(objects, pose)
    add_pose_story_prop(pose)
    objects = list(bpy.context.scene.objects)
    minimum, maximum = object_bounds(objects)
    center = (minimum + maximum) * 0.5
    height = maximum.z - minimum.z
    target = Vector((center.x, center.y, minimum.z + height * 0.53))
    add_camera((target.x + height * 0.42, target.y - height * 2.15, target.z + height * 0.22), target, lens=66)
    add_lighting(target, max(0.7, height / 2.0))
    high = CHARACTER_ROOT / f"{name}.png"
    render_to(high)
    resize_png(high, CHARACTER_ROOT / f"{name}-medium.png", 384, 576)
    resize_png(high, CHARACTER_ROOT / f"{name}-low.png", 256, 384)


def make_material(name, base, roughness=0.78, metallic=0.0, emission=None, strength=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*srgb(base), 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        (bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")).default_value = (*srgb(emission), 1)
        if bsdf.inputs.get("Emission Strength"):
            bsdf.inputs["Emission Strength"].default_value = strength
    return material


def place_asset(relative_path, location, scale=1.0, rotation_z=0.0, pose=None):
    objects = import_glb(relative_path)
    if pose:
        pose_hero(objects, pose)
    holder = bpy.data.objects.new(f"UiSet-{Path(relative_path).stem}", None)
    bpy.context.collection.objects.link(holder)
    for obj in objects:
        if obj.parent is None:
            obj.parent = holder
    holder.location = location
    holder.scale = (scale, scale, scale)
    holder.rotation_euler.z = rotation_z
    return holder


def add_cube(name, location, scale, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new("StormWornEdge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def render_menu_background():
    clear_scene()
    configure_render(1920, 1080, False)
    sand = make_material("Sandstorm Ground", "#5E3E2D", 0.96)
    ground = add_cube("WindScouredGround", (0, 0, -0.45), (42, 36, 0.8), sand, 0.18)
    noise = ground.data.materials[0].node_tree.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.8
    noise.inputs["Detail"].default_value = 5.0
    noise.inputs["Roughness"].default_value = 0.72
    bump = ground.data.materials[0].node_tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.24
    ground.data.materials[0].node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    ground.data.materials[0].node_tree.links.new(bump.outputs["Normal"], ground.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Normal"])

    # A recognizable in-world set: the meat stall, cabin frontage and three towers.
    place_asset("custom/butcher-stall.glb", (-2.1, 2.5, 0), 1.45, math.radians(8))
    place_asset("holiday/cabin-door.glb", (-2.2, 5.4, 0), 2.0, math.pi)
    place_asset("holiday/cabin-wall.glb", (-5.9, 5.4, 0), 2.0, math.pi)
    place_asset("holiday/cabin-wall.glb", (1.5, 5.4, 0), 2.0, math.pi)
    place_asset("holiday/cabin-roof.glb", (-2.2, 5.4, 4.15), 2.1, math.pi)
    place_asset("holiday/lantern.glb", (-0.4, 3.9, 2.25), 1.4, math.pi)
    place_asset("custom/tower-ballista.glb", (-9.0, 5.5, 0), 1.0, math.radians(18))
    place_asset("custom/tower-frost.glb", (7.7, 7.2, 0), 1.0, math.radians(-18))
    place_asset("custom/tower-cannon.glb", (11.5, 2.4, 0), 0.9, math.radians(-38))
    place_asset("custom/characters/protagonist-butcher-matron.glb", (2.7, 0.2, 0), 1.45, math.radians(-10), "butcher")
    place_asset("custom/characters/protagonist-vet-sniper.glb", (5.5, 1.5, 0), 1.32, math.radians(-24), "sniper")
    place_asset("custom/characters/protagonist-mech-youth.glb", (0.1, 0.0, 0), 1.42, math.radians(12), "mechanic")

    peak_material = make_material("Distant Rust Peaks", "#231C1A", 1.0)
    for index in range(10):
        bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=3.6 + index % 3, radius2=0, depth=7 + index % 4, location=(-20 + index * 4.6, 13 + (index % 2), 2.0))
        peak = bpy.context.object
        peak.scale.x = 1.6
        peak.data.materials.append(peak_material)

    target = (0, 3.0, 2.1)
    add_camera((18.5, -24.0, 11.0), target, lens=47)
    add_lighting(target, 3.5)
    bpy.ops.object.light_add(type="SUN", location=(-8, -10, 14))
    sun = bpy.context.object
    sun.name = "SandstormSun"
    sun.data.energy = 3.2
    sun.data.color = srgb("#F0A05E")
    sun.data.angle = math.radians(18)
    sun.rotation_euler = (math.radians(28), math.radians(-24), math.radians(-36))
    bpy.context.scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (*srgb("#281915"), 1)
    bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.72
    high = UI_ROOT / "background" / "menu-background.png"
    render_to(high)
    resize_png(high, UI_ROOT / "background" / "menu-background-medium.png", 1280, 720)
    resize_png(high, UI_ROOT / "background" / "menu-background-low.png", 960, 540)


def render_dust_layer():
    clear_scene()
    configure_render(1920, 1080, True)
    dust = make_material("Sandstorm Dust", "#C9864E", 1.0, 0.0, "#B66538", 0.32)
    for index in range(34):
        x = -10 + (index * 7.13) % 20
        z = -5 + (index * 3.71) % 10
        width = 0.8 + index % 5 * 0.42
        streak = add_cube(f"DustStreak{index}", (x, 0, z), (width * 5.5, 0.08, 0.06 + index % 3 * 0.035), dust, 0.03)
        streak.rotation_euler.y = math.radians(-8 + index % 5 * 2)
    add_camera((0, -14, 0), (0, 0, 0), lens=52)
    add_area_light("DustGlow", (0, -5, 8), (0, 0, 0), 550, "#FFC58A", 8)
    high = UI_ROOT / "background" / "menu-dust.png"
    render_to(high)
    resize_png(high, UI_ROOT / "background" / "menu-dust-medium.png", 1280, 720)
    resize_png(high, UI_ROOT / "background" / "menu-dust-low.png", 960, 540)


def rust_material(name, base="#252B2C", rust="#8F3B1F"):
    material = make_material(name, base, 0.68, 0.62)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 5.4
    noise.inputs["Detail"].default_value = 5.0
    noise.inputs["Roughness"].default_value = 0.78
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.33
    ramp.color_ramp.elements[0].color = (*srgb(base), 1)
    ramp.color_ramp.elements[1].position = 0.71
    ramp.color_ramp.elements[1].color = (*srgb(rust), 1)
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
    return material


def render_nine_slice(name, accent, button=False):
    clear_scene()
    configure_render(192, 192, True)
    steel = rust_material(f"{name} Worn Steel")
    accent_material = make_material(f"{name} Accent", accent, 0.38, 0.48, accent, 0.16)
    dark = make_material(f"{name} Recess", "#0B1418", 0.95, 0.08)
    add_cube("PanelCore", (0, 0, 0), (4.4, 4.4, 0.28), dark, 0.2)
    width = 0.48 if button else 0.38
    for x, y, sx, sy in ((0, 2.0, 4.4, width), (0, -2.0, 4.4, width), (-2.0, 0, width, 4.4), (2.0, 0, width, 4.4)):
        add_cube("WornFrame", (x, y, 0.25), (sx, sy, 0.42), steel, 0.13)
    for x in (-1.82, 1.82):
        for y in (-1.82, 1.82):
            bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.12, depth=0.16, location=(x, y, 0.55))
            bpy.context.object.data.materials.append(accent_material)
    add_cube("SignalNotch", (0, 1.88, 0.57), (1.2 if button else 0.72, 0.09, 0.08), accent_material, 0.035)
    for index in range(7):
        scratch = add_cube(f"SandScratch{index}", (-1.5 + index * 0.5, -0.7 + (index % 3) * 0.7, 0.2), (0.38, 0.025, 0.035), accent_material)
        scratch.rotation_euler.z = math.radians(-24 + index * 7)
    add_camera((0, 0, 9), (0, 0, 0), ortho_scale=5.35)
    add_area_light("PanelKey", (-4, -4, 7), (0, 0, 0), 850, "#FFC58A", 5)
    add_area_light("PanelFill", (4, -1, 4), (0, 0, 0), 340, "#70B3C4", 4)
    render_to(UI_ROOT / "chrome" / f"{name}.png")


def resize_png(source, destination, width, height):
    image = bpy.data.images.load(str(source), check_existing=False)
    image.scale(width, height)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = str(destination)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)
    if not destination.exists() or destination.stat().st_size < 512:
        raise RuntimeError(f"Resize failed: {destination}")


def build_atlas():
    cell = 256
    columns = 4
    rows = 3
    atlas_pixels = np.zeros((rows * cell, columns * cell, 4), dtype=np.float32)
    for index, (name, _path, _kind, _pose) in enumerate(ICON_SPECS):
        image = bpy.data.images.load(str(UI_ROOT / "icons" / f"{name}.png"), check_existing=False)
        pixels = np.empty(len(image.pixels), dtype=np.float32)
        image.pixels.foreach_get(pixels)
        pixels = pixels.reshape((cell, cell, 4))
        row = index // columns
        column = index % columns
        atlas_pixels[row * cell:(row + 1) * cell, column * cell:(column + 1) * cell] = pixels
        bpy.data.images.remove(image)
    atlas = bpy.data.images.new("StormR8UiAtlas", width=columns * cell, height=rows * cell, alpha=True)
    atlas.pixels.foreach_set(atlas_pixels.ravel())
    high = UI_ROOT / "atlas" / "ui-atlas-high.png"
    high.parent.mkdir(parents=True, exist_ok=True)
    atlas.filepath_raw = str(high)
    atlas.file_format = "PNG"
    atlas.save()
    bpy.data.images.remove(atlas)
    resize_png(high, UI_ROOT / "atlas" / "ui-atlas-medium.png", columns * 192, rows * 192)
    resize_png(high, UI_ROOT / "atlas" / "ui-atlas-low.png", columns * 128, rows * 128)


def png_dimensions(path):
    with path.open("rb") as handle:
        header = handle.read(24)
    if header[:8] != b"\x89PNG\r\n\x1a\n":
        raise RuntimeError(f"Not a PNG: {path}")
    return struct.unpack(">II", header[16:24])


def write_manifest():
    files = []
    for path in sorted((UI_ROOT).rglob("*.png")) + sorted(CHARACTER_ROOT.glob("protagonist-*.png")):
        width, height = png_dimensions(path)
        files.append({
            "path": path.relative_to(REPO_ROOT / "public").as_posix(),
            "width": width,
            "height": height,
            "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        })
    manifest = {"preset": STORM_UI_PRESET, "atlasOrder": [entry[0] for entry in ICON_SPECS], "assets": files}
    UI_ROOT.mkdir(parents=True, exist_ok=True)
    (UI_ROOT / "render-preset-r8.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"R8 UI KIT COMPLETE | {len(files)} PNG assets")


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--portraits-background-only" in args:
        for spec in HERO_SPECS:
            render_portrait(*spec)
        render_menu_background()
        write_manifest()
        return
    if "--background-only" in args:
        render_menu_background()
        render_dust_layer()
        write_manifest()
        return
    for spec in ICON_SPECS:
        render_icon(*spec)
    build_atlas()
    for spec in HERO_SPECS:
        render_portrait(*spec)
    render_menu_background()
    render_dust_layer()
    render_nine_slice("panel-9s", "#79C3D2")
    render_nine_slice("button-9s", "#C9864E", True)
    render_nine_slice("danger-button-9s", "#E35432", True)
    write_manifest()


if __name__ == "__main__":
    main()
