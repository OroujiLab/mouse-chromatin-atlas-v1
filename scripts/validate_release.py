#!/usr/bin/env python3
"""Minimal scientific integrity gate for the static v1 bundle."""
from pathlib import Path
import csv, json

root=Path(__file__).resolve().parents[1]
data=root/"site"/"data"
with (data/"cells.csv").open(newline="",encoding="utf-8") as handle:
    rows=list(csv.DictReader(handle))
assert len(rows)==48385, f"Expected 48385 curated cells, found {len(rows)}"
required={"cell_id","Sample","Clusters50","CellType","umap_1","umap_2"}
assert required <= set(rows[0]), "Missing required UMAP/annotation fields"
ids=[row["cell_id"] for row in rows]
assert len(set(ids))==len(ids), "Duplicate cell IDs"
for row in rows:
    float(row["umap_1"]);float(row["umap_2"])
with (data/"seacell_assignments.csv").open(newline="",encoding="utf-8") as handle:
    memberships=list(csv.DictReader(handle))
assert len(memberships)==48385, f"Expected 48385 SEACell assignments, got {len(memberships)}"
idx=json.loads((data/"gene_activity"/"index.json").read_text())
assert idx, "Missing gene-activity index"
for path in ["index.html","app.js","styles.css","regions-core.js","citation.bib","citation.ris"]:
    assert (root/"site"/path).is_file(), f"Missing {path}"
print("Release integrity: PASS — 48,385 curated cells, unique barcodes, UMAP fields and SEACell rows")
