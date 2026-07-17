#!/usr/bin/env python3
"""Validate the embedded C2PA softwareAgent in an R15 PNG master."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import zlib
from pathlib import Path


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def png_chunks(data: bytes) -> list[tuple[str, bytes, bool]]:
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("not a PNG")
    chunks: list[tuple[str, bytes, bool]] = []
    offset = len(PNG_SIGNATURE)
    while offset + 12 <= len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        kind_bytes = data[offset + 4 : offset + 8]
        payload = data[offset + 8 : offset + 8 + length]
        expected_crc = struct.unpack(">I", data[offset + 8 + length : offset + 12 + length])[0]
        actual_crc = zlib.crc32(kind_bytes + payload) & 0xFFFFFFFF
        kind = kind_bytes.decode("latin1")
        chunks.append((kind, payload, expected_crc == actual_crc))
        offset += length + 12
        if kind == "IEND":
            break
    return chunks


def read_cbor_length(data: bytes, offset: int, expected_major: int) -> tuple[int, int]:
    initial = data[offset]
    major = initial >> 5
    additional = initial & 0x1F
    if major != expected_major:
        raise ValueError(f"unexpected CBOR major type {major} at {offset}")
    if additional < 24:
        return additional, offset + 1
    byte_count = {24: 1, 25: 2, 26: 4, 27: 8}.get(additional)
    if byte_count is None:
        raise ValueError("indefinite or reserved CBOR length")
    start = offset + 1
    return int.from_bytes(data[start : start + byte_count], "big"), start + byte_count


def read_cbor_text(data: bytes, offset: int) -> tuple[str, int]:
    length, payload_offset = read_cbor_length(data, offset, 3)
    end = payload_offset + length
    return data[payload_offset:end].decode("utf-8"), end


def software_agent(c2pa_payload: bytes) -> dict[str, str]:
    marker = b"\x6dsoftwareAgent"
    marker_offset = c2pa_payload.find(marker)
    if marker_offset < 0:
        raise ValueError("softwareAgent assertion not found")
    offset = marker_offset + len(marker)
    pair_count, offset = read_cbor_length(c2pa_payload, offset, 5)
    result: dict[str, str] = {}
    for _ in range(pair_count):
        key, offset = read_cbor_text(c2pa_payload, offset)
        value, offset = read_cbor_text(c2pa_payload, offset)
        result[key] = value
    return result


def validate(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    chunks = png_chunks(data)
    c2pa_chunks = [payload for kind, payload, crc_valid in chunks if kind == "caBX" and crc_valid]
    if len(c2pa_chunks) != 1:
        raise ValueError(f"expected exactly one valid caBX chunk, found {len(c2pa_chunks)}")
    agent = software_agent(c2pa_chunks[0])
    name = agent.get("name", "")
    version = agent.get("version", "")
    valid = name == "gpt-image" and re.fullmatch(r"2\.\d+(?:\.\d+)?", version) is not None
    return {
        "path": path.as_posix(),
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
        "c2pa": {
            "pngChunk": "caBX",
            "chunkCount": len(c2pa_chunks),
            "allPngChunkCrcsValid": all(crc_valid for _, _, crc_valid in chunks),
            "softwareAgent": agent,
            "summary": f"{name} {version}".strip(),
        },
        "expected": "softwareAgent = gpt-image 2.x",
        "pass": valid,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("master", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        report = validate(args.master)
    except Exception as error:  # noqa: BLE001 - evidence must capture the exact failure
        report = {"path": args.master.as_posix(), "pass": False, "error": str(error)}
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized, encoding="utf-8")
    print(serialized, end="")
    return 0 if report.get("pass") is True else 1


if __name__ == "__main__":
    raise SystemExit(main())
