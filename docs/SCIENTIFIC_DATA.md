# Scientific data and interpretation

**Dataset:** Mouse Chromatin Atlas, Release 1  
**Source study:** [*Chromatin accessibility landscapes define stromal cell identities across tissues*](https://doi.org/10.1038/s42003-026-09720-w), *Communications Biology* (2026)  
**GEO:** [GSE286329](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE286329)  
**Reference assembly:** mm10

## Curated cell metadata

The browser uses **48,385 original cell identifiers**, representing nine mouse tissues. The processed cell annotations include 50 original cluster codes, 28 named biological cell types and 28 unassigned cells. These are the records present in the validated interactive dataset, distinct from figures describing the full published study.

`site/data/cells.csv` uses the following columns:

| Column | Definition |
| --- | --- |
| `cell_id` | Unique source cell barcode including source prefix |
| `Sample` | Mouse tissue identifier |
| `Clusters50` | Original 50-cluster code; not interchangeable with cell-type name |
| `CellType` | Curated biological annotation; `NA` denotes an unassigned cell |
| `umap_1`, `umap_2` | Original source UMAP coordinates |

UMAP coordinates, barcodes, and annotations are carried forward without reclustering, imputation or new embedding. The browser may filter and color these observations, but does not recalculate them. See `site/data/manifest.json` for source checksum and per-file hashes.

## ArchR gene activity

Ten selected score profiles derive from the source ArchR `GeneScoreMatrix` and appear in `site/data/gene_activity/` with a versioned `index.json` manifest. They are **accessibility-derived gene activity estimates, not RNA expression**. Scores are read-only. The browser clips the display range for visualization without modifying the source values.

The default ArchR processing configuration is an **inference from the published scripts**, not an independently confirmed record of every original run parameter. Interpret absolute values accordingly. The original source column set was matched against all curated cell IDs.

## SEACell memberships

The existing processed SEACell assignments were matched to atlas cells by **exact source cell ID**, not by row position. The released `seacell_assignments.csv` contains 48,385 memberships spanning 90 labels; `seacell_groups.csv` summarizes their sizes and annotated diversity. The accompanying `seacell_manifest.json` documents source sizes, checksums and label harmonization.

SEACells are descriptive precomputed groups and are not guaranteed to be homogeneous in tissue or biological annotation. The explorer shows whole-group composition independently of active display filters, keeping its denominators stable.

## Accessible regions

The accessible-region browser accesses original cell-type marker BED files from the published [analysis repository](https://github.com/OroujiLab/Mouse_Tissues_scATAC). Coordinates use **mm10, 0-based half-open intervals**. Their intersections quantify whether an interval in set A overlaps at least one interval in set B and vice versa. Percentages use each original set's own region count as the denominator.

These coordinate overlaps do **not** establish differential accessibility, shared signal magnitude, peak-to-gene regulation or transcription-factor occupancy.

## Provenance and redistribution

- Curated per-cell metadata and UMAP: `site/data/manifest.json`
- Selected gene-activity files: `site/data/gene_activity/index.json`
- Source SEACell assignment files: `site/data/seacell_manifest.json`
- Released data license: `site/data/LICENSE.md` (CC BY 4.0)

Original publication and original analysis code have their own source licenses and citations. The dataset's bundled metadata, genes and SEACell subsets are licensed separately by the atlas project. No raw sequencing reads, large ArchR objects or unpublished experiments are served by this website.
