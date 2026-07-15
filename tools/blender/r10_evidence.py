"""Render reproducible Storm R10 outsider-vs-stylized cast evidence."""

import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from blender_utils import add_beam, add_box, add_cone, add_cylinder, add_ico, material
from ui_kit import add_camera, add_lighting, clear_scene, configure_render, object_bounds, render_to, srgb


REPO_ROOT = Path(__file__).resolve().parents[2]
MODEL_ROOT = REPO_ROOT / "public" / "models"
EVIDENCE_ROOT = REPO_ROOT / "docs" / "evidence" / "R10"
CELL_WIDTH = 300
CELL_HEIGHT = 420


def import_from(root_path, relative_path):
    path = root_path / relative_path
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path), import_shading="NORMALS")
    return [obj for obj in bpy.context.scene.objects if obj not in before]


def holder_for(objects, name, location, scale, yaw):
    holder = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(holder)
    for obj in objects:
        if obj.parent is None:
            obj.parent = holder
    holder.location = location
    holder.scale = (scale, scale, scale)
    holder.rotation_euler.z = yaw
    return holder


def frame_scene(width, height, margin=1.16):
    bpy.context.view_layer.update()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.visible_get()]
    minimum, maximum = object_bounds(meshes)
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    aspect = width / height
    ortho_scale = max(size.z, size.x / aspect) * margin
    distance = max(8.0, max(size.x, size.z) * 2.6)
    add_camera((center.x, minimum.y - distance, center.z + size.z * 0.06), (center.x, center.y, center.z), lens=62, ortho_scale=ortho_scale)


def evidence_render(path):
    configure_render(CELL_WIDTH, CELL_HEIGHT, False)
    world = bpy.context.scene.world.node_tree.nodes["Background"]
    world.inputs["Color"].default_value = (*srgb("#1B2931"), 1)
    world.inputs["Strength"].default_value = 0.82
    frame_scene(CELL_WIDTH, CELL_HEIGHT, 1.24)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.visible_get()]
    minimum, maximum = object_bounds(meshes)
    target = (minimum + maximum) * 0.5
    add_lighting(target, max(1.0, (maximum.z - minimum.z) / 2.8))
    render_to(path)


def imported_cell(relative, name, scale, output):
    clear_scene()
    objects = import_from(MODEL_ROOT, relative)
    holder_for(objects, name, (0, 0, 0), scale, 0)
    evidence_render(output)


def procedural_dog_cell(output):
    """Rebuild the pre-R10 rigid primitive dog for an apples-to-apples render."""
    clear_scene()
    fur = material("Before Dog Fur", srgb("#3A281C"), 0.95)
    tan = material("Before Dog Tan", srgb("#AD6B33"), 0.90)
    dark = material("Before Dog Dark", srgb("#1C1510"), 0.88)
    body = add_ico("BeforeDogBody", (0, 0, 0.72), 0.42, fur, 2, (1.0, 1.85, 1.0))
    head = add_ico("BeforeDogHead", (0, 0.82, 0.95), 0.43, tan, 2)
    muzzle = add_box("BeforeDogMuzzle", (0, 1.16, 0.84), (0.38, 0.48, 0.25), tan)
    for side in (-1, 1):
        add_cone(f"BeforeDogEar{side}", (side * 0.25, 0.77, 1.35), 0.14, 0, 0.55, fur, 5)
        for y in (-0.45, 0.45):
            add_cylinder(f"BeforeDogLeg{side}{y}", (side * 0.28, y, 0.34), 0.08, 0.68, tan, 6)
    add_beam("BeforeDogTail", (0, -0.65, 0.88), (0, -1.20, 1.50), 0.07, fur, 6)
    add_ico("BeforeDogNose", (0, 1.42, 0.88), 0.08, dark, 1)
    evidence_render(output)


def compose(paths, destination, columns, rows, delete=False):
    pixels = np.zeros((rows * CELL_HEIGHT, columns * CELL_WIDTH, 4), dtype=np.float32)
    for index, path in enumerate(paths):
        image = bpy.data.images.load(str(path), check_existing=False)
        values = np.empty(len(image.pixels), dtype=np.float32)
        image.pixels.foreach_get(values)
        values = values.reshape((CELL_HEIGHT, CELL_WIDTH, 4))
        row = index // columns
        column = index % columns
        pixels[row * CELL_HEIGHT:(row + 1) * CELL_HEIGHT, column * CELL_WIDTH:(column + 1) * CELL_WIDTH] = values
        bpy.data.images.remove(image)
    atlas = bpy.data.images.new(destination.stem, width=columns * CELL_WIDTH, height=rows * CELL_HEIGHT, alpha=True)
    atlas.pixels.foreach_set(pixels.ravel())
    atlas.filepath_raw = str(destination)
    atlas.file_format = "PNG"
    atlas.save()
    bpy.data.images.remove(atlas)
    if delete:
        for path in paths:
            path.unlink(missing_ok=True)
    print(f"R10 EVIDENCE {destination.relative_to(REPO_ROOT)} | {destination.stat().st_size} bytes")


EVIDENCE_ROOT.mkdir(parents=True, exist_ok=True)
before = []
after = []
before_specs = [
    ("survivor.glb", "BeforeHunter", 0.82),
    ("customer.glb", "BeforeCashier", 0.85),
    ("customer.glb", "BeforeTraveler", 0.85),
    ("customer.glb", "BeforeForager", 0.85),
    ("customer.glb", "BeforeRefugee", 0.85),
]
after_specs = [
    ("custom/characters/staff-hunter.glb", "AfterHunter", 0.90),
    ("custom/characters/staff-cashier.glb", "AfterCashier", 0.94),
    ("custom/characters/customer-traveler.glb", "AfterTraveler", 0.92),
    ("custom/characters/customer-forager.glb", "AfterForager", 0.98),
    ("custom/characters/customer-refugee.glb", "AfterRefugee", 0.88),
    ("custom/characters/staff-shepherd-dog.glb", "AfterDog", 0.95),
]
for index, (relative, name, scale) in enumerate(before_specs):
    path = EVIDENCE_ROOT / f".before-{index}.png"
    imported_cell(relative, name, scale, path)
    before.append(path)
dog_before = EVIDENCE_ROOT / ".before-5.png"
procedural_dog_cell(dog_before)
before.append(dog_before)
for index, (relative, name, scale) in enumerate(after_specs):
    path = EVIDENCE_ROOT / f".after-{index}.png"
    imported_cell(relative, name, scale, path)
    after.append(path)

compose(before, EVIDENCE_ROOT / "before-r10-outsider-cast.png", 6, 1)
compose(after, EVIDENCE_ROOT / "after-r10-stylized-cast.png", 6, 1)
# Blender image rows are bottom-origin: after+before renders old on the visual
# top row and the normalized R10 cast on the visual bottom row.
compose(after + before, EVIDENCE_ROOT / "before-after-r10-normalization.png", 6, 2, delete=True)
