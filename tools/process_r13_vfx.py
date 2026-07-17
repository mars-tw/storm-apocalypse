"""Build R13 runtime VFX, alpha masks, contact sheet and audited manifest."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs" / "evidence" / "R13_art"
OPAQUE = EVIDENCE / "opaque"
RGBA_MASTER = EVIDENCE / "rgba-master"
MASKS = EVIDENCE / "masks"
RUNTIME = ROOT / "public" / "images" / "vfx" / "r13"

SPECS = {
    "snow-burst-a": {
        "category": "snow_burst",
        "subject": "compact radial burst of chunky wind-carved snow shards and powder clumps",
        "alpha_qa_minutes": 1,
    },
    "snow-burst-b": {
        "category": "snow_burst",
        "subject": "low sweeping crescent of wind-driven snow chunks and ice splinters",
        "alpha_qa_minutes": 1,
    },
    "wood-splinter-a": {
        "category": "wood_splinter",
        "subject": "explosive fan of broken timber splinters, chips and cracked plank fragments",
        "alpha_qa_minutes": 1,
    },
    "wood-splinter-b": {
        "category": "wood_splinter",
        "subject": "compact sideways burst of wood chips, bark and one snapped rail fragment",
        "alpha_qa_minutes": 1,
    },
    "health-warning-a": {
        "category": "health_warning",
        "subject": "screen-edge danger vignette of separated angular crimson shards",
        "alpha_qa_minutes": 1,
    },
    "health-warning-b": {
        "category": "health_warning",
        "subject": "fractured circular low-health frame with separated frost-cracked crimson plates",
        "alpha_qa_minutes": 1,
    },
    "impact-decal-a": {
        "category": "decal",
        "subject": "irregular cracked dark-red impact stain pressed into snow",
        "alpha_qa_minutes": 2,
    },
    "impact-decal-b": {
        "category": "decal",
        "subject": "scuffed-snow impact with charcoal center, oxblood arcs and compressed ridges",
        "alpha_qa_minutes": 2,
    },
}

COMMON_PROMPT = (
    "Storm Apocalypse stylized low-poly painted combat VFX; perpetual blizzard; chunky readable "
    "forms; restrained texture density; perfectly flat solid #00ff00 chroma-key background; "
    "centered pivot; generous padding; no text, logo, watermark, character, weapon or scenery"
)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def visible_bbox(alpha):
    bbox = alpha.getbbox()
    return list(bbox) if bbox else [0, 0, 0, 0]


def green_fringe_pixels(image):
    count = 0
    pixels = image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()
    for red, green, blue, alpha in pixels:
        if alpha > 8 and green > 72 and green > red * 1.22 and green > blue * 1.22:
            count += 1
    return count


def build():
    RGBA_MASTER.mkdir(parents=True, exist_ok=True)
    MASKS.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    assets = []
    contact_tiles = []
    failures = []

    for slug, spec in SPECS.items():
        opaque_path = OPAQUE / f"{slug}-opaque.png"
        keyed_path = RUNTIME / f"{slug}.png"
        master_path = RGBA_MASTER / f"{slug}-rgba.png"
        mask_path = MASKS / f"{slug}-mask.png"
        if not opaque_path.exists() or not master_path.exists():
            raise FileNotFoundError(slug)
        with Image.open(master_path) as source:
            rgba_master = source.convert("RGBA")
        runtime = rgba_master.resize((1024, 1024), Image.Resampling.LANCZOS)
        runtime.save(keyed_path, format="PNG", optimize=True)
        alpha = runtime.getchannel("A")
        alpha.save(mask_path, format="PNG", optimize=True)
        pixels = runtime.width * runtime.height
        alpha_values = list(alpha.get_flattened_data() if hasattr(alpha, "get_flattened_data") else alpha.getdata())
        visible = sum(value > 0 for value in alpha_values)
        partial = sum(0 < value < 255 for value in alpha_values)
        occupancy = visible / pixels
        bbox = visible_bbox(alpha)
        corners = [alpha.getpixel(point) for point in ((0, 0), (1023, 0), (0, 1023), (1023, 1023))]
        fringe = green_fringe_pixels(runtime)
        valid = (
            runtime.mode == "RGBA"
            and runtime.size == (1024, 1024)
            and corners == [0, 0, 0, 0]
            and 0.05 <= occupancy <= 0.72
            and bbox[0] > 4 and bbox[1] > 4 and bbox[2] < 1020 and bbox[3] < 1020
            and fringe / max(1, visible) < 0.0005
        )
        if not valid:
            failures.append(slug)
        opaque_image = Image.open(opaque_path)
        item = {
            "id": slug,
            "category": spec["category"],
            "model": "gpt-image-2",
            "use_case": "stylized-concept",
            "prompt": f"{spec['subject']}; {COMMON_PROMPT}",
            "background_removal": "remove_chroma_key.py auto-key border, soft matte, despill, edge-contract 1; Lanczos runtime resize",
            "manual_cleanup_minutes": 0,
            "alpha_qa_minutes": spec["alpha_qa_minutes"],
            "opaque_master": {
                "path": opaque_path.relative_to(ROOT).as_posix(),
                "width": opaque_image.width,
                "height": opaque_image.height,
                "sha256": sha256(opaque_path),
            },
            "rgba_master": {
                "path": master_path.relative_to(ROOT).as_posix(),
                "width": rgba_master.width,
                "height": rgba_master.height,
                "sha256": sha256(master_path),
            },
            "alpha_mask": {
                "path": mask_path.relative_to(ROOT).as_posix(),
                "width": 1024,
                "height": 1024,
                "sha256": sha256(mask_path),
            },
            "runtime": {
                "path": keyed_path.relative_to(ROOT).as_posix(),
                "width": 1024,
                "height": 1024,
                "bytes": keyed_path.stat().st_size,
                "sha256": sha256(keyed_path),
            },
            "alpha_gate": {
                "pass": valid,
                "four_corners": corners,
                "occupancy": round(occupancy, 6),
                "partial_pixels": partial,
                "visible_bbox": bbox,
                "green_fringe_pixels": fringe,
                "magic_bytes": keyed_path.read_bytes()[:8].hex(),
            },
        }
        opaque_image.close()
        assets.append(item)
        contact_tiles.append((slug, runtime.copy()))

    manifest = {
        "release": "storm R13",
        "generator": "gpt-image-2 + local chroma-key removal",
        "runtime_contract": "RGBA PNG 1024x1024, transparent corners, consistent centered pivot and padding",
        "manual_cleanup_minutes_total": sum(item["manual_cleanup_minutes"] for item in assets),
        "alpha_qa_minutes_total": sum(item["alpha_qa_minutes"] for item in assets),
        "all_alpha_gates_pass": not failures,
        "assets": assets,
    }
    (RUNTIME / "manifest-r13.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    sheet = Image.new("RGB", (1600, 900), (12, 24, 32))
    draw = ImageDraw.Draw(sheet)
    for index, (slug, tile) in enumerate(contact_tiles):
        col = index % 4
        row = index // 4
        preview = tile.copy()
        preview.thumbnail((350, 350), Image.Resampling.LANCZOS)
        x = 25 + col * 395 + (350 - preview.width) // 2
        y = 35 + row * 430 + (350 - preview.height) // 2
        panel = Image.new("RGBA", preview.size, (66, 85, 92, 255))
        panel.alpha_composite(preview)
        sheet.paste(panel.convert("RGB"), (x, y))
        draw.text((25 + col * 395, 390 + row * 430), slug, fill=(220, 232, 232))
    sheet.save(EVIDENCE / "vfx-alpha-contact-sheet.png", format="PNG", optimize=True)
    if failures:
        raise RuntimeError(f"Alpha gate failed: {', '.join(failures)}")
    print(json.dumps({"assets": len(assets), "alpha_pass": True, "manifest": str(RUNTIME / 'manifest-r13.json')}, ensure_ascii=False))


if __name__ == "__main__":
    build()
