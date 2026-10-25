# Data license — Mouse Chromatin Atlas Release 1

**License: Creative Commons Attribution 4.0 International (CC BY 4.0).**

The atlas's curated and processed data files **distributed within this repository's `site/data/` directory** are made available by Epigenome Lab under CC BY 4.0.

License text: https://creativecommons.org/licenses/by/4.0/legalcode  
License summary: https://creativecommons.org/licenses/by/4.0/

You may share and adapt these materials, including commercially, under the license's conditions. **Provide appropriate attribution, link the license, indicate whether changes were made, and do not imply the original authors endorse your use.** The license does not waive rights that cannot be licensed (for example, third-party rights not held by the licensor).

## Covered atlas files

The CC BY 4.0 data license applies to the curated assets that the atlas project packages in `site/data/`, including:

- `cells.csv` — validated 48,385-cell metadata and original UMAP coordinates.
- `seacell_assignments.csv`, `seacell_groups.csv` and their data/provenance manifest — precomputed SEACell memberships and summaries.
- `gene_activity/index.json` and the ten `gene_activity/*.json` files — selected **ATAC-derived ArchR gene activity** values, not RNA expression.
- `celltype_counts.csv`, `cluster_mapping.csv`, `tissue_celltype_counts.csv`, `tissue_counts.csv` and associated source-description metadata.

Source values, biological annotations, coordinates and original cell IDs have not been re-inferred by the atlas website. Refer to file manifests for provenance. This license notice does not alter the underlying scientific data.

## Attribution requested

> Epigenome Lab / Mouse Chromatin Atlas (2026), processed mouse single-cell chromatin accessibility atlas data, **CC BY 4.0**. Based on Nooranikhojasteh A, Tavallaee G, Khuu N, et al. *Chromatin accessibility landscapes define stromal cell identities across tissues*. *Communications Biology* **9**, 480 (2026). https://doi.org/10.1038/s42003-026-09720-w. Original data: GEO GSE286329. Indicate any modifications.

This suggested citation does not replace attribution to the original study's complete author list, original supplementary sources, or any source-specific requirements.

## Distinct materials, not relicensed by this notice

- **Atlas application source code** is licensed separately under the root repository `LICENSE` (MIT).
- **The original published paper** is separately CC BY 4.0 according to its publisher.
- **Original analysis repository code**, externally hosted marker BED files, GEO datasets and any third-party scientific or software assets hosted elsewhere retain their respective original rights and terms; links from the atlas do **not** relicense them.
- **Epigenome Lab name, logo and visual identity** are not licensed for trademark or endorsement use by this CC BY data notice or the MIT software license.
- No assertion is made that independently obtained third-party data without project licensing authority are covered.

**Scope note:** The browser currently serves a curated subset of the processed single-cell atlas (48,385 cells). It should not be represented as a license covering every dataset from the original paper or as evidence of RNA expression, peak-to-gene causality or TF occupancy.
