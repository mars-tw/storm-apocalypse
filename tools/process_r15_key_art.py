#!/usr/bin/env python3
"""Deterministically derive R15 menu and promotional assets from the C2PA master."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, ImageEnhance


REPO = Path(__file__).resolve().parents[1]
RESAMPLE = Image.Resampling.LANCZOS


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def centered_crop(image: Image.Image, width: int, height: int) -> Image.Image:
    source_ratio = image.width / image.height
    target_ratio = width / height
    if source_ratio > target_ratio:
        crop_width = round(image.height * target_ratio)
        left = (image.width - crop_width) // 2
        box = (left, 0, left + crop_width, image.height)
    else:
        crop_height = round(image.width / target_ratio)
        top = (image.height - crop_height) // 2
        box = (0, top, image.width, top + crop_height)
    return image.crop(box).resize((width, height), RESAMPLE)


def save_png(image: Image.Image, path: Path, colors: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    output = image.convert("RGB")
    if colors is not None:
        output = output.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    output.save(path, format="PNG", optimize=True, compress_level=9)


def save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, format="WEBP", quality=42, method=6, exact=True)


def describe(path: Path, master_sha256: str, steps: list[str]) -> dict[str, object]:
    with Image.open(path) as image:
        width, height = image.size
    return {
        "path": path.relative_to(REPO).as_posix(),
        "width": width,
        "height": height,
        "decodedRgbaBytes": width * height * 4,
        "fileBytes": path.stat().st_size,
        "sha256": sha256(path),
        "model": "gpt-image-2",
        "masterSha256": master_sha256,
        "postprocess": steps,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("master", type=Path)
    parser.add_argument("--c2pa-report", type=Path, required=True)
    parser.add_argument("--prompt", type=Path, required=True)
    args = parser.parse_args()

    c2pa_report_path = args.c2pa_report.resolve()
    prompt_path = args.prompt.resolve()
    c2pa_report = json.loads(c2pa_report_path.read_text(encoding="utf-8"))
    if c2pa_report.get("pass") is not True:
        raise SystemExit("C2PA report is not passing; runtime derivation refused")

    master = args.master.resolve()
    master_sha256 = sha256(master)
    if master_sha256 != c2pa_report.get("sha256"):
        raise SystemExit("master hash differs from the validated C2PA report")

    runtime_root = REPO / "public/images/ui/background"
    public_cover = REPO / "public/images/cover.png"
    repo_cover = REPO / "assets/cover.png"
    with Image.open(master) as source:
        source = source.convert("RGB")
        high = centered_crop(source, 1920, 1080)
        # Palette quantization lowers the two reduced variants by roughly 1%;
        # compensate deterministically so they retain the validated master tone.
        medium = ImageEnhance.Brightness(centered_crop(source, 1280, 720)).enhance(1.02)
        low = ImageEnhance.Brightness(centered_crop(source, 640, 360)).enhance(1.02)
        preview = centered_crop(source, 320, 180)
        cover = centered_crop(source, 1280, 640)

    high_path = runtime_root / "menu-background.png"
    medium_path = runtime_root / "menu-background-medium.png"
    low_path = runtime_root / "menu-background-low.png"
    preview_path = runtime_root / "menu-background-preview.webp"
    save_png(high, high_path)
    save_png(medium, medium_path, colors=256)
    save_png(low, low_path, colors=128)
    save_webp(preview, preview_path)
    save_png(cover, public_cover)
    repo_cover.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(public_cover, repo_cover)

    assets = [
        describe(high_path, master_sha256, ["center-crop 16:9", "resize 1920x1080 Lanczos", "PNG RGB optimize=1 compress=9"]),
        describe(medium_path, master_sha256, ["center-crop 16:9", "resize 1280x720 Lanczos", "brightness 1.02 quantization compensation", "deterministic 256-color FASTOCTREE", "PNG optimize=1 compress=9"]),
        describe(low_path, master_sha256, ["center-crop 16:9", "resize 640x360 Lanczos", "brightness 1.02 quantization compensation", "deterministic 128-color FASTOCTREE", "PNG optimize=1 compress=9"]),
        describe(preview_path, master_sha256, ["center-crop 16:9", "resize 320x180 Lanczos", "WebP quality=42 method=6 exact=1"]),
        describe(public_cover, master_sha256, ["center-crop 2:1", "resize 1280x640 Lanczos", "PNG RGB optimize=1 compress=9"]),
        describe(repo_cover, master_sha256, ["byte-for-byte copy from public/images/cover.png"]),
    ]
    c2pa = c2pa_report["c2pa"]
    manifest = {
        "release": "storm R15 Wave 2",
        "assetType": "gpt-image-2 key art with deterministic runtime derivatives",
        "model": "gpt-image-2",
        "master": {
            "path": master.relative_to(REPO).as_posix(),
            "sha256": master_sha256,
            "bytes": master.stat().st_size,
            "c2pa": {
                "softwareAgent": c2pa["softwareAgent"],
                "summary": c2pa["summary"],
                "verification": c2pa_report_path.relative_to(REPO).as_posix(),
            },
        },
        "prompt": {
            "path": prompt_path.relative_to(REPO).as_posix(),
            "sha256": sha256(prompt_path),
        },
        "pipeline": {
            "script": "tools/process_r15_key_art.py",
            "resampler": "Pillow Lanczos",
            "cropAnchor": "center",
            "firstScreenPreview": "320x180 WebP bytes are inlined as a data URI in index.html; file copy is retained for hash verification",
            "metadataPolicy": "master retained untouched; derivatives intentionally omit C2PA and point back by SHA-256",
        },
        "assets": assets,
        "gates": {
            "coverCopiesByteIdentical": sha256(public_cover) == sha256(repo_cover),
            "desktopDecodedBytes": 1920 * 1080 * 4 + 640 * 360 * 4 + 320 * 180 * 4,
            "mobileDecodedBytes": 640 * 360 * 4 + 320 * 180 * 4,
            "desktopLimitBytes": 64 * 1024 * 1024,
            "mobileLimitBytes": 32 * 1024 * 1024,
        },
    }
    manifest["gates"]["allPass"] = (
        manifest["gates"]["coverCopiesByteIdentical"]
        and manifest["gates"]["desktopDecodedBytes"] <= manifest["gates"]["desktopLimitBytes"]
        and manifest["gates"]["mobileDecodedBytes"] <= manifest["gates"]["mobileLimitBytes"]
    )
    serialized = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    public_manifest = REPO / "public/images/ui/key-art-manifest-r15.json"
    evidence_manifest = REPO / "docs/evidence/R15/source-manifest-r15.json"
    public_manifest.write_text(serialized, encoding="utf-8")
    evidence_manifest.write_text(serialized, encoding="utf-8")
    print(serialized, end="")
    return 0 if manifest["gates"]["allPass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
