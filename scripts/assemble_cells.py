#!/usr/bin/env python3
"""Reassemble source-identical cells.csv from transport-sized parts; verify Git blob SHA."""
from pathlib import Path
import hashlib

repo = Path(__file__).resolve().parents[1]
data = repo / "site" / "data"
parts = [data / "cell_parts" / ("cells.csv.part%02d" % i) for i in range(1, 7)]
for part in parts:
    if not part.is_file():
        raise SystemExit("Missing required part: " + str(part))
raw = b"".join(part.read_bytes() for part in parts)
expected_size = 4326230
expected_sha = "829d61e9604a98b43e27bbf4d22f607c5413909c"
digest = hashlib.sha1(b"blob " + str(len(raw)).encode("ascii") + bytes([0]) + raw).hexdigest()
if len(raw) != expected_size or digest != expected_sha:
    raise SystemExit("Source-integrity check failed; refusing to write cells.csv")
out = data / "cells.csv"
out.write_bytes(raw)
print("Verified source-identical cell metadata:", out, len(raw), "bytes")
