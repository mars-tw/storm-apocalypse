"""Import exported GLBs and print their real triangle, rig, and clip metadata."""

import sys
from pathlib import Path

import bpy


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for actions in list(bpy.data.actions):
        bpy.data.actions.remove(actions)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for armature in list(bpy.data.armatures):
        bpy.data.armatures.remove(armature)


paths = [Path(value).resolve() for value in sys.argv[sys.argv.index("--") + 1:]] if "--" in sys.argv else []
if not paths:
    raise SystemExit("Pass one or more GLB paths after --")

for path in paths:
    clear()
    bpy.ops.import_scene.gltf(filepath=str(path))
    triangles = sum(max(0, len(poly.vertices) - 2) for mesh in bpy.data.meshes for poly in mesh.polygons)
    clips = sorted(action.name for action in bpy.data.actions)
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    bones = sorted(armatures[0].data.bones.keys()) if armatures else []
    nodes = sorted(obj.name for obj in bpy.context.scene.objects if obj.type in {"EMPTY", "ARMATURE"})
    print(
        f"INSPECT {path.name} | {triangles} tris | clips={','.join(clips) or '-'} "
        f"| bones={len(bones)}:{','.join(bones) or '-'} | animated_nodes={','.join(nodes)}"
    )
