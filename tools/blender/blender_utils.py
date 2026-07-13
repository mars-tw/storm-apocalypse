"""Shared low-poly construction helpers for Storm Apocalypse custom assets."""

from mathutils import Vector
import bpy
import math
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = REPO_ROOT / "public" / "models" / "custom"


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.armatures,
        bpy.data.actions,
    ):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene.render.fps = 24
    bpy.context.scene.render.fps_base = 1.0
    bpy.context.scene.world.color = (0.035, 0.045, 0.055)


def material(name, color, roughness=0.82, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        strength_input = bsdf.inputs.get("Emission Strength")
        if emission_input:
            emission_input.default_value = (*emission, 1.0)
        if strength_input:
            strength_input.default_value = emission_strength
    return mat


def assign(obj, mat):
    if mat is not None:
        obj.data.materials.append(mat)
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = False
    return obj


def root(name):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    bpy.context.collection.objects.link(obj)
    return obj


def add_box(name, location, dimensions, mat, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return assign(obj, mat)


def add_cylinder(name, location, radius, depth, mat, vertices=8, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, end_fill_type="NGON", location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return assign(obj, mat)


def add_cone(name, location, radius1, radius2, depth, mat, vertices=7, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, end_fill_type="NGON", location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return assign(obj, mat)


def add_ico(name, location, radius, mat, subdivisions=1, scale=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return assign(obj, mat)


def add_torus(name, location, major_radius, minor_radius, mat, major_segments=12, minor_segments=4, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return assign(obj, mat)


def add_beam(name, start, end, radius, mat, vertices=6):
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    obj = add_cylinder(name, (start_v + end_v) * 0.5, radius, delta.length, mat, vertices)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    return obj


def add_prism(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return assign(obj, mat)


def add_roof_prism(name, center, width, depth, wall_height, ridge_height, mat):
    cx, cy, cz = center
    x = width * 0.5
    y = depth * 0.5
    vertices = [
        (cx - x, cy - y, cz), (cx + x, cy - y, cz),
        (cx - x, cy + y, cz), (cx + x, cy + y, cz),
        (cx, cy - y, cz + ridge_height), (cx, cy + y, cz + ridge_height),
    ]
    faces = [(0, 1, 4), (2, 5, 3), (0, 2, 3, 1), (0, 4, 5, 2), (1, 3, 5, 4)]
    return add_prism(name, vertices, faces, mat)


def add_crystal(name, location, radius, height, mat, sides=5, rotation_z=0.0):
    x, y, z = location
    ring_z = z + height * 0.38
    vertices = [(x, y, z), (x, y, z + height)]
    for index in range(sides):
        angle = rotation_z + index * math.tau / sides
        vertices.append((x + math.cos(angle) * radius, y + math.sin(angle) * radius, ring_z))
    faces = []
    for index in range(sides):
        a = 2 + index
        b = 2 + (index + 1) % sides
        faces.append((0, b, a))
        faces.append((1, a, b))
    return add_prism(name, vertices, faces, mat)


def parent(child, parent_obj):
    child.parent = parent_obj
    return child


def parent_loose(model_root):
    for obj in list(bpy.context.scene.objects):
        if obj != model_root and obj.parent is None:
            obj.parent = model_root


def triangle_count():
    return sum(max(0, len(poly.vertices) - 2) for mesh in bpy.data.meshes for poly in mesh.polygons)


def export_glb(filename, model_root):
    parent_loose(model_root)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / filename
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    model_root.select_set(True)
    for child in model_root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = model_root
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_force_sampling=True,
        export_frame_step=1,
        export_skins=True,
        export_def_bones=True,
    )
    size = out.stat().st_size
    print(f"EXPORTED {filename} | {triangle_count()} tris | {size} bytes")


def render_portrait(filename, target=(0.0, 0.0, 1.02), camera_location=(2.7, 4.8, 2.25)):
    """Render a transparent, softly lit selection-card portrait."""
    output = REPO_ROOT / "public" / "images" / "characters" / filename
    output.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 384
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(output)

    bpy.ops.object.camera_add(location=camera_location)
    camera = bpy.context.object
    camera.name = "PortraitCamera"
    camera.data.lens = 68
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-2.8, 3.8, 5.2))
    key = bpy.context.object
    key.name = "PortraitKey"
    key.data.energy = 760
    key.data.shape = "DISK"
    key.data.size = 4.0
    key.rotation_euler = (Vector(target) - key.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.light_add(type="AREA", location=(3.2, 1.5, 3.2))
    fill = bpy.context.object
    fill.name = "PortraitFill"
    fill.data.energy = 430
    fill.data.color = (0.45, 0.72, 0.86)
    fill.data.size = 3.0
    fill.rotation_euler = (Vector(target) - fill.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.light_add(type="AREA", location=(0.0, -2.5, 3.6))
    rim = bpy.context.object
    rim.name = "PortraitRim"
    rim.data.energy = 520
    rim.data.color = (0.92, 0.45, 0.2)
    rim.data.size = 2.5
    rim.rotation_euler = (Vector(target) - rim.location).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.render.render(write_still=True)
    print(f"RENDERED {filename} | {output.stat().st_size} bytes")
