"""Storm R8 named-customer art pass with story props and authored walk clips."""

import math

from animated_asset_utils import create_customer_actions
from blender_utils import *
from hero_rig_factory import _beam, _box, _build_body, _cloth_wear, _cone, _cylinder, _face, _ico, _mat, _torus


def _common(face_skin, coat, trousers, boots, hair):
    return {
        "skin": _mat("R8 NPC Skin " + face_skin[0], face_skin[1], 0.7, shadow=face_skin[2]),
        "coat": coat,
        "trousers": trousers,
        "boots": boots,
        "hair": hair,
        "eye_white": _mat("R8 Eye White", "#E6D8C4", 0.62, shadow="#A68C79"),
        "pupil": _mat("R8 Pupil", "#120D0C", 0.54, shadow="#050303"),
        "mouth": _mat("R8 Mouth", "#642E31", 0.78, shadow="#2C1014"),
    }


def build_lao_zhou():
    reset_scene()
    mats = _common(
        ("Weathered", "#A7795B", "#58372A"),
        _mat("R8 Lao Zhou Ash Coat", "#665F50", 0.93, shadow="#302D26"),
        _mat("R8 NPC Charcoal Trousers", "#303432", 0.9, shadow="#121514"),
        _mat("R8 Dark Leather", "#352720", 0.72, shadow="#160F0C"),
        _mat("R8 Lao Zhou Grey Hair", "#8A8577", 0.89, shadow="#46433D"),
    )
    straw = _mat("R8 Lao Zhou Straw", "#B68B46", 0.95, shadow="#684B22")
    sack = _mat("R8 Lao Zhou Scrap Sack", "#8B6941", 0.94, shadow="#49341D")
    iron = _mat("R8 Shared Scarred Iron", "#8A999B", 0.32, 0.78, shadow="#343E40")
    brass = _mat("R8 Lao Zhou Brass Accent", "#D79A3A", 0.35, 0.68, shadow="#72501E")
    smoke = _mat("R8 Pipe Ember", "#E26E32", 0.45, 0, "#C84F22", 0.5, "#6D2513")
    iris = _mat("R8 Lao Zhou Brown Iris", "#7D5534", 0.45, shadow="#342114")
    model, rig, j, head_r = _build_body(
        "NpcLaoZhouR8", 1.60, 0.65, 0.56, mats,
        {"leg_radius": 0.105, "arm_radius": 0.095, "head_scale": (1.03, 0.95, 1.0)},
    )
    _box("LaoZhouPatchCoat", (-0.22, 0.215, 1.08), (0.21, 0.026, 0.20), sack, rig, "chest", (0, 0, -0.1), 0.008)
    _cloth_wear("LaoZhouCoatHem", (0, 0.22, 0.77), (0.52, 0.02, 0.05), straw, rig, "spine")
    _ico("LaoZhouHairCap", (0, -0.01, j["head_z"] + head_r * 0.52), head_r * 0.92, mats["hair"], rig, "head", (1.02, 0.94, 0.48), 2)
    _face("LaoZhou", rig, j, head_r, mats, iris, "steady")
    _beam("LaoZhouMoustacheL", (-0.02, head_r * 1.03, j["head_z"] - 0.08), (-0.15, head_r * 0.98, j["head_z"] - 0.12), 0.018, mats["hair"], rig, "head", 7)
    _beam("LaoZhouMoustacheR", (0.02, head_r * 1.03, j["head_z"] - 0.08), (0.14, head_r * 0.98, j["head_z"] - 0.11), 0.018, mats["hair"], rig, "head", 7)
    # Wide conical bamboo hat dominates the silhouette.
    _cylinder("LaoZhouHatBrim", (0, -0.01, j["head_z"] + 0.23), 0.46, 0.045, straw, rig, "head", 14)
    _cone("LaoZhouConicalHat", (0, -0.01, j["head_z"] + 0.38), 0.42, 0.025, 0.32, straw, rig, "head", 14)
    _beam("LaoZhouHatCordL", (-0.25, 0.02, j["head_z"] + 0.2), (-0.08, 0.17, j["head_z"] - 0.22), 0.014, sack, rig, "head", 6)
    _beam("LaoZhouHatCordR", (0.25, 0.02, j["head_z"] + 0.2), (0.08, 0.17, j["head_z"] - 0.22), 0.014, sack, rig, "head", 6)
    # Pipe is face-bound so the prop follows his idle glances.
    _beam("LaoZhouPipeStem", (0.10, head_r * 1.0, j["head_z"] - 0.11), (0.36, 0.28, j["head_z"] - 0.20), 0.025, sack, rig, "head", 8)
    _cylinder("LaoZhouPipeBowl", (0.39, 0.28, j["head_z"] - 0.16), 0.065, 0.12, iron, rig, "head", 10)
    _ico("LaoZhouPipeEmber", (0.39, 0.28, j["head_z"] - 0.095), 0.045, smoke, rig, "head", (1, 1, 0.35), 1)
    _box("LaoZhouScrapSack", (-0.30, -0.27, 1.03), (0.50, 0.30, 0.62), sack, rig, "chest", (0.08, 0, -0.18), 0.025)
    _beam("LaoZhouSackStrap", (-0.26, -0.08, 1.41), (0.18, 0.19, 0.80), 0.035, straw, rig, "chest", 8)
    for index, x in enumerate((-0.42, -0.28, -0.12)):
        _beam(f"LaoZhouScrapRod{index}", (x, -0.30, 1.18), (x + 0.08, -0.28, 1.70 - index * 0.1), 0.028, iron if index != 1 else brass, rig, "chest", 8)
    create_customer_actions(rig)
    return model


def build_nurse_lin():
    reset_scene()
    mats = _common(
        ("Nurse", "#C28F74", "#71483A"),
        _mat("R8 Nurse Storm Blue", "#476273", 0.91, shadow="#213541"),
        _mat("R8 Nurse Navy Trousers", "#303D4A", 0.9, shadow="#121B22"),
        _mat("R8 Dark Leather", "#352720", 0.72, shadow="#160F0C"),
        _mat("R8 Nurse Hair", "#382824", 0.85, shadow="#160D0B"),
    )
    canvas = _mat("R8 Nurse Medical Canvas", "#D6D0BE", 0.94, shadow="#8E8879")
    red = _mat("R8 Nurse Cross Accent", "#D64A45", 0.82, shadow="#72211F")
    wear = _mat("R8 Nurse Coat Wear", "#8BA4AE", 0.94, shadow="#4D6570")
    steel = _mat("R8 Shared Scarred Iron", "#8A999B", 0.32, 0.78, shadow="#343E40")
    iris = _mat("R8 Nurse Green Iris", "#5E8C79", 0.4, shadow="#28463A")
    model, rig, j, head_r = _build_body(
        "NpcNurseLinR8", 1.67, 0.64, 0.54, mats,
        {"leg_radius": 0.1, "arm_radius": 0.087, "head_scale": (0.98, 0.94, 1.05)},
    )
    _cone("NurseLinShoulderCape", (0, -0.01, 1.34), 0.44, 0.23, 0.42, mats["coat"], rig, "chest", 12)
    _cloth_wear("NurseLinCapeWear", (0, 0.22, 1.18), (0.52, 0.02, 0.055), wear, rig, "chest")
    _ico("NurseLinHairCap", (0, -0.02, j["head_z"] + head_r * 0.5), head_r * 0.93, mats["hair"], rig, "head", (0.99, 0.92, 0.51), 2)
    _ico("NurseLinHairBun", (-0.19, -0.08, j["head_z"] + 0.10), 0.11, mats["hair"], rig, "head", (0.9, 0.8, 1.1), 2)
    _face("NurseLin", rig, j, head_r, mats, iris, "steady")
    _box("NurseLinCap", (0, 0.01, j["head_z"] + 0.22), (0.31, 0.27, 0.10), canvas, rig, "head", (0.02, 0, 0), 0.018)
    _box("NurseLinCapCrossV", (0, 0.16, j["head_z"] + 0.22), (0.035, 0.02, 0.09), red, rig, "head", edge=0.005)
    _box("NurseLinCapCrossH", (0, 0.16, j["head_z"] + 0.22), (0.10, 0.02, 0.035), red, rig, "head", edge=0.005)
    # Large structured medical bag, not a generic hip cube.
    _box("NurseLinMedicalBag", (-0.39, 0.03, 0.89), (0.43, 0.24, 0.46), canvas, rig, "pelvis", (0, 0, -0.05), 0.035)
    _torus("NurseLinBagHandle", (-0.39, 0.03, 1.14), 0.17, 0.027, steel, rig, "pelvis", (math.pi / 2, 0, 0), 12, 4)
    _box("NurseLinBagCrossV", (-0.39, 0.165, 0.90), (0.065, 0.025, 0.25), red, rig, "pelvis", edge=0.007)
    _box("NurseLinBagCrossH", (-0.39, 0.165, 0.90), (0.25, 0.025, 0.065), red, rig, "pelvis", edge=0.007)
    _beam("NurseLinBagStrap", (-0.49, 0.0, 1.17), (0.22, 0.19, 1.37), 0.026, canvas, rig, "chest", 8)
    _box("NurseLinArmband", (j["elbow_x"] * 0.92, 0.02, j["elbow_z"] + 0.14), (0.14, 0.19, 0.18), canvas, rig, "upper_arm.R", (0, 0, -0.18), 0.01)
    _box("NurseLinArmbandCross", (j["elbow_x"] * 0.92, 0.13, j["elbow_z"] + 0.14), (0.10, 0.018, 0.035), red, rig, "upper_arm.R", (0, 0, -0.18), 0.005)
    create_customer_actions(rig)
    return model


def build_kid_bao():
    reset_scene()
    mats = _common(
        ("Kid", "#D29A73", "#7D4E37"),
        _mat("R8 Kid Pine Coat", "#526F4A", 0.93, shadow="#253923"),
        _mat("R8 Kid Brown Trousers", "#3A4437", 0.91, shadow="#181E17"),
        _mat("R8 Kid Boots", "#4A3629", 0.74, shadow="#20140E"),
        _mat("R8 Kid Hair", "#3A2B25", 0.86, shadow="#160E0B"),
    )
    yellow = _mat("R8 Kid Mustard Accent", "#D4A63E", 0.91, shadow="#76551B")
    scarf = _mat("R8 Kid Red Scarf", "#A8463E", 0.9, shadow="#54201D")
    pack = _mat("R8 Kid Patchwork Pack", "#7F5A3A", 0.93, shadow="#3D2818")
    blue_patch = _mat("R8 Kid Blue Patch", "#557A82", 0.94, shadow="#29434A")
    button = _mat("R8 Kid Brass Button", "#D49B39", 0.35, 0.55, shadow="#6F4A17")
    iris = _mat("R8 Kid Dark Iris", "#604735", 0.42, shadow="#291B14")
    model, rig, j, head_r = _build_body(
        "NpcKidBaoR8", 1.22, 0.54, 0.48, mats,
        {"leg_radius": 0.085, "arm_radius": 0.073, "hand_radius": 0.09, "head_radius": 0.19, "head_scale": (1.17, 1.03, 1.03)},
    )
    _torus("KidBaoScarf", (0, 0.01, 0.98), 0.205, 0.052, scarf, rig, "chest", major_segments=12)
    _box("KidBaoScarfTail", (0.27, -0.08, 0.80), (0.12, 0.055, 0.43), scarf, rig, "chest", (0.08, -0.1, -0.2), 0.012)
    _ico("KidBaoHairCap", (0, -0.01, j["head_z"] + head_r * 0.5), head_r * 0.94, mats["hair"], rig, "head", (1.15, 1.02, 0.5), 2)
    _face("KidBao", rig, j, head_r, mats, iris, "curious")
    _ico("KidBaoKnitHat", (0, -0.015, j["head_z"] + head_r * 0.67), head_r * 1.05, yellow, rig, "head", (1.18, 1.08, 0.48), 2)
    _ico("KidBaoPomPom", (0.04, -0.01, j["head_z"] + 0.34), 0.075, scarf, rig, "head", (1, 1, 1.15), 2)
    for suffix, sign in (("L", -1), ("R", 1)):
        _cylinder(f"KidBaoEarMuff{suffix}", (sign * 0.20, 0.01, j["head_z"] + 0.015), 0.077, 0.06, yellow, rig, "head", 10, (0, math.pi / 2, 0))
    # Oversized survival backpack tells the child-refugee story.
    _box("KidBaoOversizeBackpack", (0, -0.29, 0.72), (0.58, 0.34, 0.66), pack, rig, "chest", (0.02, 0, 0), 0.035)
    _box("KidBaoPackFlap", (0, -0.48, 0.89), (0.48, 0.055, 0.25), blue_patch, rig, "chest", (0.08, 0, 0), 0.015)
    _cylinder("KidBaoBedroll", (0, -0.31, 1.13), 0.13, 0.55, yellow, rig, "chest", 11, (0, math.pi / 2, 0))
    for side in (-1, 1):
        _beam(f"KidBaoPackStrap{side}", (side * 0.18, 0.15, 0.93), (side * 0.23, 0.13, 0.51), 0.025, pack, rig, "chest", 8)
    for index, x in enumerate((-0.20, 0, 0.20)):
        _cylinder(f"KidBaoLuckyButton{index}", (x, 0.225, 0.70 + (index % 2) * 0.12), 0.03, 0.025, button, rig, "spine", 8, (math.pi / 2, 0, 0))
    _box("KidBaoCoatPatch", (-0.19, 0.22, 0.77), (0.17, 0.025, 0.17), blue_patch, rig, "spine", (0, 0, -0.12), 0.007)
    create_customer_actions(rig)
    return model


def build_scout_he():
    reset_scene()
    mats = _common(
        ("Scout", "#A67659", "#563529"),
        _mat("R8 Scout Black Green", "#334238", 0.92, shadow="#142019"),
        _mat("R8 Scout Trousers", "#252D28", 0.9, shadow="#0D1210"),
        _mat("R8 Scout Boots", "#20241F", 0.76, shadow="#0B0D0B"),
        _mat("R8 Scout Hair", "#2D2925", 0.87, shadow="#100E0C"),
    )
    cloak = _mat("R8 Scout Moss Cloak", "#465044", 0.95, shadow="#222A22")
    leather = _mat("R8 Scout Strap Leather", "#735039", 0.71, shadow="#382317")
    metal = _mat("R8 Shared Scarred Iron", "#8A999B", 0.32, 0.78, shadow="#343E40")
    lens = _mat("R8 Scout Lens Accent", "#65B7BE", 0.25, 0, "#3E909A", 0.24, "#214A50")
    wear = _mat("R8 Scout Cloak Wear", "#7C8976", 0.95, shadow="#404A3D")
    iris = _mat("R8 Scout Gold Iris", "#AA7D38", 0.42, shadow="#513516")
    model, rig, j, head_r = _build_body(
        "NpcScoutHeR8", 1.73, 0.66, 0.54, mats,
        {"leg_radius": 0.1, "arm_radius": 0.087, "head_scale": (0.97, 0.93, 1.07)},
    )
    _cone("ScoutHeCloak", (0, -0.15, 1.09), 0.52, 0.28, 1.10, cloak, rig, "chest", 12)
    _cloth_wear("ScoutHeCloakFrayedL", (-0.23, -0.28, 0.57), (0.18, 0.035, 0.08), wear, rig, "chest", (0, 0.15, -0.12))
    _cloth_wear("ScoutHeCloakFrayedR", (0.21, -0.28, 0.51), (0.17, 0.035, 0.08), wear, rig, "chest", (0, -0.12, 0.16))
    _ico("ScoutHeHairCap", (0, -0.02, j["head_z"] + head_r * 0.5), head_r * 0.91, mats["hair"], rig, "head", (0.98, 0.92, 0.51), 2)
    _face("ScoutHe", rig, j, head_r, mats, iris, "steady")
    _cone("ScoutHeHood", (0, -0.04, j["head_z"] + 0.07), 0.26, 0.17, 0.36, cloak, rig, "head", 10)
    _box("ScoutHeLowerMask", (0, head_r * 0.91, j["head_z"] - 0.10), (0.31, 0.035, 0.15), cloak, rig, "head", edge=0.01)
    _box("ScoutHeCloakClasp", (0, 0.21, 1.40), (0.14, 0.055, 0.10), metal, rig, "chest", edge=0.01)
    # Binoculars sit proud of the torso and remain readable in the in-game view.
    for suffix, sign in (("L", -1), ("R", 1)):
        _cylinder(f"ScoutHeBinocular{suffix}", (sign * 0.09, 0.31, 1.26), 0.085, 0.28, metal, rig, "chest", 12, (math.pi / 2, 0, 0))
        _cylinder(f"ScoutHeBinocularLens{suffix}", (sign * 0.09, 0.47, 1.26), 0.067, 0.035, lens, rig, "chest", 12, (math.pi / 2, 0, 0))
    _box("ScoutHeBinocularBridge", (0, 0.32, 1.26), (0.14, 0.12, 0.055), leather, rig, "chest", edge=0.01)
    _beam("ScoutHeBinocularStrapL", (-0.09, 0.23, 1.27), (-0.23, 0.16, 1.46), 0.016, leather, rig, "chest", 6)
    _beam("ScoutHeBinocularStrapR", (0.09, 0.23, 1.27), (0.23, 0.16, 1.46), 0.016, leather, rig, "chest", 6)
    _beam("ScoutHeSword", (0.37, -0.08, 1.02), (0.45, -0.08, 0.34), 0.037, metal, rig, "pelvis", 9)
    _box("ScoutHeSwordHilt", (0.36, -0.07, 1.07), (0.21, 0.09, 0.075), leather, rig, "pelvis", (0, 0, -0.1), 0.012)
    create_customer_actions(rig)
    return model
