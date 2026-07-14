"""Render reproducible R8 turntables, silhouette proof and art evidence."""

import math
import shutil
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ui_kit import add_area_light, add_camera, add_lighting, clear_scene, configure_render, import_glb, look_at, make_material, object_bounds, pose_hero, render_to


REPO_ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_ROOT = REPO_ROOT / "docs" / "evidence" / "R8"
HEROES = [
    ("butcher-matron", "custom/characters/protagonist-butcher-matron.glb", "butcher"),
    ("vet-sniper", "custom/characters/protagonist-vet-sniper.glb", "sniper"),
    ("mech-youth", "custom/characters/protagonist-mech-youth.glb", "mechanic"),
]


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


def frame_scene(width, height, margin=1.16, camera_pitch=0.06):
    bpy.context.view_layer.update()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.visible_get()]
    minimum, maximum = object_bounds(meshes)
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    aspect = width / height
    ortho_scale = max(size.z, size.x / aspect) * margin
    distance = max(8.0, max(size.x, size.z) * 2.6)
    camera = add_camera(
        (center.x, minimum.y - distance, center.z + size.z * camera_pitch),
        (center.x, center.y, center.z),
        lens=62,
        ortho_scale=ortho_scale,
    )
    print(f"R8 FRAME {width}x{height} bounds={tuple(round(value, 3) for value in (*minimum, *maximum))} ortho={ortho_scale:.3f}")
    return center, max(1.0, ortho_scale / 2.8)


def evidence_render(path, width, height, transparent=False):
    configure_render(width, height, transparent)
    bpy.context.scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.018, 0.022, 1)
    bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.52
    render_to(path)


def stitch_cells(paths, destination, columns, rows, cell_width, cell_height):
    pixels = np.zeros((rows * cell_height, columns * cell_width, 4), dtype=np.float32)
    for index, path in enumerate(paths):
        image = bpy.data.images.load(str(path), check_existing=False)
        values = np.empty(len(image.pixels), dtype=np.float32)
        image.pixels.foreach_get(values)
        values = values.reshape((cell_height, cell_width, 4))
        row = index // columns
        column = index % columns
        pixels[row * cell_height:(row + 1) * cell_height, column * cell_width:(column + 1) * cell_width] = values
        bpy.data.images.remove(image)
    atlas = bpy.data.images.new(destination.stem, width=columns * cell_width, height=rows * cell_height, alpha=True)
    atlas.pixels.foreach_set(pixels.ravel())
    atlas.filepath_raw = str(destination)
    atlas.file_format = "PNG"
    atlas.save()
    bpy.data.images.remove(atlas)
    for path in paths:
        path.unlink(missing_ok=True)
    print(f"R8 EVIDENCE STITCH {destination.relative_to(REPO_ROOT)} | {destination.stat().st_size} bytes")


def render_turntable(phase, root_path, slug, relative_path):
    cells = []
    for index, yaw in enumerate((0, math.pi / 2, math.pi, math.pi * 1.5)):
        clear_scene()
        configure_render(400, 520, False)
        bpy.context.scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.018, 0.022, 1)
        bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.68
        objects = import_from(root_path, relative_path)
        holder_for(objects, f"{phase}-{slug}-{index}", (0, 0, 0), 0.90, yaw)
        target, light_scale = frame_scene(400, 520, 1.24)
        add_lighting(target, light_scale)
        cell = EVIDENCE_ROOT / f".{phase}-{slug}-turntable-{index}.png"
        render_to(cell)
        cells.append(cell)
    stitch_cells(cells, EVIDENCE_ROOT / f"{phase}-{slug}-turntable.png", 4, 1, 400, 520)


def render_silhouette_sheet(root_path):
    cells = []
    for index, (slug, relative, pose) in enumerate(HEROES):
        clear_scene()
        configure_render(500, 620, False)
        world = bpy.context.scene.world.node_tree.nodes["Background"]
        world.inputs["Color"].default_value = (0.82, 0.75, 0.62, 1)
        world.inputs["Strength"].default_value = 0.9
        black = make_material("R8 Pure Black Silhouette", "#000000", 1.0)
        objects = import_from(root_path, relative)
        pose_hero(objects, pose)
        for obj in objects:
            if obj.type == "MESH":
                obj.data.materials.clear()
                obj.data.materials.append(black)
        holder_for(objects, f"Silhouette-{slug}", (0, 0, 0), 0.92, 0)
        frame_scene(500, 620, 1.18)
        bpy.ops.object.light_add(type="AREA", location=(0, -4, 6))
        light = bpy.context.object
        light.data.energy = 450
        light.data.size = 6
        look_at(light, (0, 0, 1))
        cell = EVIDENCE_ROOT / f".silhouette-{index}.png"
        render_to(cell)
        cells.append(cell)
    stitch_cells(cells, EVIDENCE_ROOT / "after-silhouette-three-heroes.png", 3, 1, 500, 620)


def render_cast_sheet(root_path):
    specs = [
        ("custom/zombies/zombie-ash.glb", 0.82),
        ("custom/zombies/zombie-frost.glb", 0.82),
        ("custom/zombies/zombie-rust.glb", 0.82),
        ("custom/boss-zombie.glb", 0.46),
        ("custom/characters/npc-lao-zhou.glb", 0.78),
        ("custom/characters/npc-nurse-lin.glb", 0.78),
        ("custom/characters/npc-kid-bao.glb", 0.84),
        ("custom/characters/npc-scout-he.glb", 0.78),
    ]
    cells = []
    for index, (relative, scale) in enumerate(specs):
        clear_scene()
        configure_render(450, 425, False)
        bpy.context.scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.010, 0.018, 0.023, 1)
        bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.58
        objects = import_from(root_path, relative)
        holder_for(objects, f"Cast-{Path(relative).stem}", (0, 0, 0), scale, 0)
        target, light_scale = frame_scene(450, 425, 1.22)
        add_lighting(target, light_scale)
        cell = EVIDENCE_ROOT / f".cast-{index}.png"
        render_to(cell)
        cells.append(cell)
    stitch_cells(cells, EVIDENCE_ROOT / "after-enemy-boss-npc-cast.png", 4, 2, 450, 425)


def copy_after_art():
    EVIDENCE_ROOT.mkdir(parents=True, exist_ok=True)
    for slug, relative, _pose in HEROES:
        source_name = Path(relative).stem + ".png"
        shutil.copy2(REPO_ROOT / "public" / "images" / "characters" / source_name, EVIDENCE_ROOT / f"after-{slug}-hero-art.png")
    shutil.copy2(REPO_ROOT / "public" / "images" / "ui" / "background" / "menu-background.png", EVIDENCE_ROOT / "after-menu-background.png")


args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
phase = args[args.index("--phase") + 1] if "--phase" in args else "after"
root_path = Path(args[args.index("--model-root") + 1]).resolve() if "--model-root" in args else REPO_ROOT / "public" / "models"
EVIDENCE_ROOT.mkdir(parents=True, exist_ok=True)
for hero_slug, hero_path, _pose in HEROES:
    render_turntable(phase, root_path, hero_slug, hero_path)
if phase == "after":
    render_silhouette_sheet(root_path)
    render_cast_sheet(root_path)
    copy_after_art()
