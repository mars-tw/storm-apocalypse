"""Distinct low-poly humanoids for the Storm Apocalypse character pack."""

import math
from blender_utils import *


def _rgb(value):
    value = value.lstrip("#")
    srgb = tuple(int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))
    return tuple(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in srgb)


def _mat(name, value, roughness=0.88, metallic=0.0, emission=None):
    return material(name, _rgb(value), roughness, metallic, _rgb(emission) if emission else None, 0.35 if emission else 0.0)


def _limbs(prefix, height, shoulder_width, coat, trousers, boots, skin, arm_pose=0.0, child=False):
    boot_depth = 0.25 if child else 0.31
    boot_z = boot_depth * 0.5
    hip_z = height * 0.55
    leg_bottom = boot_depth
    leg_top = height * 0.91
    leg_depth = max(0.42, hip_z - leg_bottom)
    leg_center = leg_bottom + leg_depth * 0.5
    leg_x = shoulder_width * 0.24
    for side in (-1, 1):
        add_cylinder(f"{prefix}Boot{side}", (side * leg_x, 0.035, boot_z), 0.105 if child else 0.12, boot_depth, boots, 7)
        add_cylinder(f"{prefix}Leg{side}", (side * leg_x, 0, leg_center), 0.085 if child else 0.105, leg_depth, trousers, 7)
        shoulder = (side * shoulder_width * 0.48, 0, height * 0.72)
        hand = (side * (shoulder_width * 0.58 + arm_pose), 0.02, height * 0.42)
        add_beam(f"{prefix}Arm{side}", shoulder, hand, 0.075 if child else 0.095, coat, 7)
        add_ico(f"{prefix}Hand{side}", hand, 0.088 if child else 0.105, skin, 1, (0.85, 0.75, 1.05))


def _face(prefix, height, skin, hair, head_scale=(1.0, 0.92, 1.04), child=False):
    radius = 0.18 if child else 0.19
    center_z = height - radius * 1.02
    add_ico(f"{prefix}Head", (0, 0, center_z), radius, skin, 1, head_scale)
    add_ico(f"{prefix}Hair", (0, -0.008, center_z + radius * 0.56), radius * 0.88, hair, 1, (1.04, 0.91, 0.53))
    return center_z, radius


def build_butcher_matron():
    reset_scene()
    model = root("ProtagonistButcherMatron")
    skin = _mat("Matron Skin", "#C4A484")
    coat = _mat("Matron Slate Coat", "#3E4A52")
    apron = _mat("Matron Blood Apron", "#8B2E2E")
    fur = _mat("Matron Fur", "#C9B8A0")
    boots = _mat("Matron Boots", "#2A2420")
    hair = _mat("Matron Hair", "#352A24")
    iron = _mat("Matron Scale Iron", "#4B5050", 0.5, 0.55)
    _limbs("Matron", 1.68, 0.75, coat, coat, boots, skin)
    add_box("MatronTorso", (0, 0, 1.08), (0.76, 0.38, 0.68), coat)
    add_box("MatronApron", (0, 0.218, 1.02), (0.66, 0.055, 0.82), apron)
    add_box("MatronApronStain", (-0.18, 0.252, 1.15), (0.22, 0.025, 0.16), _mat("Matron Apron Stain", "#5D171B"), (0, 0, -0.18))
    add_torus("MatronFurCollar", (0, 0, 1.35), 0.25, 0.07, fur, 10, 4)
    head_z, radius = _face("Matron", 1.68, skin, hair, (1.08, 0.94, 1.03))
    add_box("MatronHeadScarf", (0, -0.02, head_z + radius * 0.74), (0.35, 0.31, 0.09), apron, (0.04, 0, 0.05))
    add_box("MatronBrow", (0, radius * 0.88, head_z + 0.025), (0.24, 0.025, 0.026), hair)
    add_beam("MatronScaleCord", (0.31, 0.08, 1.0), (0.36, 0.08, 0.71), 0.018, iron, 5)
    add_cone("MatronScaleWeight", (0.36, 0.08, 0.65), 0.065, 0.045, 0.13, iron, 6)
    return model


def build_vet_sniper():
    reset_scene()
    model = root("ProtagonistVetSniper")
    skin = _mat("Sniper Skin", "#B79272")
    coat = _mat("Sniper Military Smock", "#3F4F3A")
    inner = _mat("Sniper Inner", "#2C3034")
    wrap = _mat("Sniper Leg Wrap", "#5C4A32")
    boot = _mat("Sniper Boot", "#202326")
    lens = _mat("Sniper Cold Lens", "#6A8A8A", 0.38, 0.12, "#6A8A8A")
    hair = _mat("Sniper Hair", "#30302A")
    _limbs("Sniper", 1.78, 0.62, coat, inner, boot, skin, 0.035)
    add_box("SniperTorso", (0, 0, 1.17), (0.62, 0.34, 0.78), coat)
    add_box("SniperInnerV", (0, 0.19, 1.34), (0.22, 0.035, 0.28), inner, (0.05, 0, 0))
    for side in (-1, 1):
        for index in range(2):
            add_torus(f"SniperCalfWrap{side}{index}", (side * 0.15, 0, 0.37 + index * 0.12), 0.108, 0.025, wrap, 8, 3)
    head_z, radius = _face("Sniper", 1.78, skin, hair, (0.94, 0.92, 1.1))
    add_cone("SniperHood", (0, -0.055, head_z + 0.055), 0.255, 0.18, 0.35, coat, 8)
    add_box("SniperEyePatch", (-0.072, radius * 0.9, head_z + 0.025), (0.105, 0.028, 0.085), lens, (0, 0, -0.12))
    add_beam("SniperPatchBand", (-0.17, 0.16, head_z + 0.08), (0.13, 0.16, head_z - 0.005), 0.014, wrap, 5)
    for side in (-1, 1):
        add_box(f"SniperEmptyPouch{side}", (side * 0.205, 0.205, 0.91), (0.16, 0.08, 0.22), wrap, (0.05, 0, side * 0.06))
    return model


def build_mech_youth():
    reset_scene()
    model = root("ProtagonistMechYouth")
    skin = _mat("Mech Skin", "#C49A75")
    coat = _mat("Mech Jacket", "#4A5560")
    trousers = _mat("Mech Trousers", "#2F3540")
    orange = _mat("Mech Tool Orange", "#C45C26", 0.65, 0.12)
    belt = _mat("Mech Belt", "#6B5B3E")
    patch = _mat("Mech Patches", "#7A3E3E")
    boot = _mat("Mech Boots", "#25282D")
    hair = _mat("Mech Hair", "#2E2924")
    _limbs("Mech", 1.55, 0.68, coat, trousers, boot, skin, child=True)
    add_box("MechTorso", (0, 0, 0.99), (0.68, 0.4, 0.64), coat)
    add_box("MechToolBelt", (0, 0.02, 0.76), (0.72, 0.43, 0.115), belt)
    for x in (-0.23, 0, 0.23):
        add_box(f"MechToolPouch{x}", (x, 0.255, 0.72), (0.15, 0.08, 0.2), belt)
    head_z, radius = _face("Mech", 1.55, skin, hair, (1.13, 1.0, 1.05), child=True)
    for side in (-1, 1):
        add_cylinder(f"MechGoggle{side}", (side * 0.092, 0.15, head_z + 0.16), 0.073, 0.065, orange, 8, (math.pi / 2, 0, 0))
    add_beam("MechGoggleBridge", (-0.032, 0.182, head_z + 0.16), (0.032, 0.182, head_z + 0.16), 0.018, orange, 5)
    add_box("MechElbowPatch", (-0.41, 0.045, 0.94), (0.14, 0.075, 0.19), patch, (0, 0, -0.25))
    add_beam("MechWrenchHandle", (0.33, 0.18, 0.76), (0.42, 0.18, 0.48), 0.025, orange, 6)
    add_torus("MechWrenchRing", (0.43, 0.18, 0.43), 0.07, 0.022, orange, 8, 3, (math.pi / 2, 0, 0))
    add_box("MechGlove", (0.405, 0.01, 0.72), (0.18, 0.15, 0.19), orange, (0, 0, 0.1))
    return model


def build_lao_zhou():
    reset_scene()
    model = root("NpcLaoZhou")
    skin = _mat("Lao Zhou Skin", "#A98262")
    coat = _mat("Lao Zhou Brown Grey", "#5A5348")
    trousers = _mat("Lao Zhou Trousers", "#353633")
    sack = _mat("Lao Zhou Scrap Sack", "#8A6A3E")
    boot = _mat("Lao Zhou Boots", "#292622")
    hair = _mat("Lao Zhou Grey Hair", "#77756B")
    iron = _mat("Lao Zhou Scrap", "#50565A", 0.55, 0.45)
    _limbs("LaoZhou", 1.62, 0.64, coat, trousers, boot, skin)
    add_box("LaoZhouTorso", (0.03, 0, 1.05), (0.65, 0.38, 0.68), coat, (0, 0.12, -0.08))
    head_z, _ = _face("LaoZhou", 1.62, skin, hair, (1.02, 0.94, 1.0))
    add_box("LaoZhouSack", (-0.28, -0.27, 1.05), (0.48, 0.28, 0.58), sack, (0.08, 0, -0.18))
    add_beam("LaoZhouSackStrap", (-0.24, -0.08, 1.39), (0.17, 0.19, 0.82), 0.03, sack, 6)
    add_beam("LaoZhouCane", (0.42, 0.12, 0.82), (0.5, 0.13, 0.04), 0.028, iron, 6)
    add_box("LaoZhouShoulderPatch", (-0.25, 0.2, 1.27), (0.23, 0.05, 0.18), sack, (0, 0, -0.12))
    return model


def build_nurse_lin():
    reset_scene()
    model = root("NpcNurseLin")
    skin = _mat("Nurse Lin Skin", "#C09B7E")
    coat = _mat("Nurse Lin Blue Grey", "#3A4A5A")
    inner = _mat("Nurse Lin Inner", "#D0C7B6")
    trousers = _mat("Nurse Lin Trousers", "#303944")
    boot = _mat("Nurse Lin Boots", "#262A2F")
    hair = _mat("Nurse Lin Hair", "#332B29")
    red = _mat("Nurse Lin Armband Red", "#8B2E2E")
    _limbs("NurseLin", 1.66, 0.63, coat, trousers, boot, skin)
    add_box("NurseLinTorso", (0, 0, 1.08), (0.62, 0.36, 0.7), coat)
    add_cone("NurseLinShoulderCape", (0, -0.01, 1.35), 0.45, 0.22, 0.42, coat, 8)
    head_z, _ = _face("NurseLin", 1.66, skin, hair, (0.98, 0.94, 1.04))
    add_box("NurseLinCollar", (0, 0.195, 1.36), (0.3, 0.045, 0.16), inner)
    add_box("NurseLinArmband", (0.36, 0.025, 1.17), (0.13, 0.17, 0.18), inner, (0, 0, -0.2))
    add_box("NurseLinCrossVertical", (0.36, 0.122, 1.17), (0.035, 0.018, 0.105), red, (0, 0, -0.2))
    add_box("NurseLinCrossHorizontal", (0.36, 0.122, 1.17), (0.105, 0.018, 0.035), red, (0, 0, -0.2))
    add_box("NurseLinMedicalPouch", (-0.25, 0.22, 0.82), (0.22, 0.09, 0.24), inner)
    return model


def build_kid_bao():
    reset_scene()
    model = root("NpcKidBao")
    skin = _mat("Kid Bao Skin", "#D0A17C")
    coat = _mat("Kid Bao Green Coat", "#4A6741")
    hat = _mat("Kid Bao Yellow Hat", "#C4A035")
    trousers = _mat("Kid Bao Trousers", "#374238")
    boot = _mat("Kid Bao Boots", "#44362C")
    hair = _mat("Kid Bao Hair", "#382D27")
    scarf = _mat("Kid Bao Scarf", "#8B3F36")
    _limbs("KidBao", 1.20, 0.52, coat, trousers, boot, skin, child=True)
    add_box("KidBaoTorso", (0, 0, 0.72), (0.53, 0.38, 0.52), coat)
    head_z, radius = _face("KidBao", 1.20, skin, hair, (1.16, 1.02, 1.02), child=True)
    add_ico("KidBaoHat", (0, -0.01, head_z + radius * 0.66), radius * 1.05, hat, 1, (1.18, 1.08, 0.48))
    for side in (-1, 1):
        add_cylinder(f"KidBaoEarMuff{side}", (side * 0.19, 0.01, head_z + 0.015), 0.075, 0.055, hat, 7, (0, math.pi / 2, 0))
    add_torus("KidBaoScarf", (0, 0, 0.92), 0.205, 0.055, scarf, 9, 3)
    add_box("KidBaoButtonPouch", (0.19, 0.22, 0.62), (0.16, 0.075, 0.18), hat, (0, 0, -0.08))
    return model


def build_scout_he():
    reset_scene()
    model = root("NpcScoutHe")
    skin = _mat("Scout He Skin", "#A77E60")
    coat = _mat("Scout He Black Green", "#2E3830")
    cloak = _mat("Scout He Cloak", "#3A4038")
    trousers = _mat("Scout He Trousers", "#252B27")
    boot = _mat("Scout He Boots", "#1D211E")
    mask = _mat("Scout He Mask", "#202723")
    metal = _mat("Scout He Blade", "#737A78", 0.42, 0.5)
    _limbs("ScoutHe", 1.72, 0.66, coat, trousers, boot, skin)
    add_box("ScoutHeTorso", (0, 0, 1.12), (0.64, 0.35, 0.72), coat)
    add_cone("ScoutHeCloak", (0, -0.14, 1.08), 0.5, 0.29, 1.04, cloak, 8)
    head_z, radius = _face("ScoutHe", 1.72, skin, mask, (0.98, 0.93, 1.06))
    add_box("ScoutHeFaceMask", (0, radius * 0.87, head_z - 0.055), (0.29, 0.035, 0.16), mask)
    add_cone("ScoutHeHood", (0, -0.04, head_z + 0.06), 0.25, 0.17, 0.34, cloak, 8)
    add_beam("ScoutHeSword", (0.34, -0.06, 0.98), (0.4, -0.06, 0.39), 0.035, metal, 6)
    add_box("ScoutHeSwordHilt", (0.33, -0.05, 1.03), (0.19, 0.08, 0.07), metal, (0, 0, -0.1))
    add_box("ScoutHeCloakClasp", (0, 0.2, 1.38), (0.13, 0.05, 0.09), metal)
    return model
