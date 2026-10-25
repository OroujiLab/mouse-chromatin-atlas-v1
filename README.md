<img src="site/epi-logo.svg" alt="Epigenome Lab" width="76" align="right">

# Mouse Chromatin Atlas

**An interactive, open-data resource for single-cell chromatin accessibility across nine mouse tissues.**

[![Release v1](https://img.shields.io/badge/release-v1-0471CE)](https://atlas.epigenomelab.com/) [![scATAC-seq](https://img.shields.io/badge/assay-scATAC--seq-1487AF)](https://doi.org/10.1038/s42003-026-09720-w) [![Mouse mm10](https://img.shields.io/badge/genome-mouse%20mm10-4361B8)](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE286329) [![48,385 cells](https://img.shields.io/badge/cells-48%2C385-128B92)](https://atlas.epigenomelab.com/) [![Static site](https://img.shields.io/badge/stack-HTML%20%7C%20JavaScript-596C86)](#how-it-works) [![Software: MIT](https://img.shields.io/badge/software-MIT-1763AA)](LICENSE) [![Data: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-167D9A)](site/data/LICENSE.md)

Explore the source-derived scATAC-seq landscape, inspect marker-accessible genomic regions, view selected ArchR gene-activity scores, and examine precomputed SEACell groups in your browser.

**[Explore the atlas](https://atlas.epigenomelab.com/)** · [Publication](https://doi.org/10.1038/s42003-026-09720-w) · [GEO GSE286329](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE286329) · [Original analysis](https://github.com/OroujiLab/Mouse_Tissues_scATAC)

| Cells in this atlas | Mouse tissues | Annotated cell types | SEACell groups | Gene-activity profiles |
| :--: | :--: | :--: | :--: | :--: |
| **48,385** | **9** | **28** | **90** | **10** |

The interactive atlas contains a validated processed subset of the study data, with original UMAP positions and cell identities preserved. The original publication reports study-wide totals separately.

## Overview

Mouse Chromatin Atlas presents selected processed results from the mouse-tissue single-cell ATAC-seq study in *Communications Biology* (2026). It is a read-only research browser: no account, analysis server, database, or recurring computation is required.

### Explore the data

| Explorer | Features |
| --- | --- |
| **Cell atlas** | Interactive UMAP; tissue and cell-type coloring, filtering and CSV exports; composition summaries |
| **Accessible regions** | Published cell-type marker BED intervals in **mm10**; chromosome and region filtering; UCSC links; BED downloads |
| **Compare peaks** | Descriptive genomic interval overlap between two published marker peak sets; directional counts and exports |
| **Gene activity** | Ten selected ATAC-derived **ArchR GeneScoreMatrix** profiles on the original UMAP; loaded on demand |
| **SEACell groups** | Highlight 90 existing SEACell groups and explore their tissue/cell-type composition and membership |
| **Data & downloads** | Curated data resources, manifests, GEO accession, and source links |

**Scientific interpretation:** Gene-activity scores are accessibility-derived estimates, **not RNA expression**. Marker BED overlaps are coordinate relationships, **not statistical tests of differential accessibility**. SEACell groups may mix tissues or annotated cell types; their membership does not prove lineage or cellular purity. Motif enrichment and peak-to-gene association explorers are not included in Release 1.

## How it works

The published processed outputs are validated and packaged into small, versioned files:

~~~text
Published mouse-tissue scATAC-seq study
         |
         +-- Cell metadata + original UMAP ------> cells.csv
         +-- Selected ArchR GeneScoreMatrix -----> per-gene JSON files
         +-- Precomputed SEACell assignments ----> assignment + group CSVs
         +-- Published marker BED files ---------> read on demand
                                                        |
                                             Static HTML / CSS / JavaScript
                                                        |
                                             Interactive browser views
~~~

All cell selection, plotting, composition summaries, and exports run in the browser. The deployed atlas serves only the files under **`site/`**. This repository is a clean Release 1 source snapshot without private development history.

## Quick start

Open **[atlas.epigenomelab.com](https://atlas.epigenomelab.com/)** to explore the resource without installation.

To run a local copy of this repository:

~~~bash
cd site
python3 -m http.server 8000 --bind 127.0.0.1
~~~

Then open **http://127.0.0.1:8000/**. A local server is needed for browser data loading; opening `index.html` directly via `file://` may block file requests. You can stop the server with Control-C.

## Repository structure

~~~text
mouse-chromatin-atlas/
├── site/                     # Complete static website
│   ├── index.html            # Browser interface and attribution
│   ├── app.js                # UMAP, filtering, gene scores, SEACells
│   ├── regions-core.js       # Genomic interval handling
│   ├── styles.css            # Accessible site styling
│   ├── data/                 # Curated CSV / JSON / manifests / data license
│   └── LICENSE.txt           # Hosted MIT software license
├── pipeline/                 # Reproducible data validation/export utilities
├── tests/                    # Scientific data, UI, interval and license tests
├── docs/                     # Data guide, maintenance, release information
├── .github/workflows/        # Automated validation
└── LICENSE                   # MIT software license
~~~

## Data and reproducibility

Original cell barcodes, tissue labels, 50 source cluster identifiers, biological cell-type annotations and UMAP coordinates are preserved. The browser uses **48,385** records, including 28 with unassigned cell-type annotation. All genomic intervals use mouse genome assembly **mm10**, with BED 0-based, half-open coordinates.

The `site/data/` manifests record scientific source descriptions, file dimensions and checksums. Original gene scores are not re-normalized by the website; the original ArchR processing settings should be checked against the source analysis when interpreting absolute score scales.

See the [data guide](docs/SCIENTIFIC_DATA.md) for the file contract, scientific caveats and provenance.

## Validation

The repository includes automated tests for the curated 48,385-cell data, SEACell membership integrity, selected gene profiles, marker BED processing, coordinate-overlap behavior, browser interactions and license links.

~~~bash
# Scientific / data consistency tests
python3 -m unittest discover -s tests -v

# Interval calculations
node --test tests/regions.test.cjs

# Browser interaction tests (requires Playwright and Chromium)
npm install --no-save playwright@1.56.1
npx playwright install chromium
node --test --test-timeout=90000 tests/browser-smoke.cjs tests/atlas-real-smoke.cjs
~~~

The published site is generated without a build framework. The production website is maintained separately; running this release locally requires only a static file server. See [Maintenance](docs/MAINTENANCE.md).

## Cite the study and atlas

Use the publication citation for the underlying scientific study. The repository also includes a machine-readable `CITATION.cff` for GitHub's **Cite this repository** menu.

[![BibTeX](https://img.shields.io/badge/Cite-BibTeX-0471CE)](https://atlas.epigenomelab.com/citation.bib) [![RIS](https://img.shields.io/badge/Cite-RIS%20%2F%20EndNote-1487AF)](https://atlas.epigenomelab.com/citation.ris) [![PubMed](https://img.shields.io/badge/Cite-PubMed-4361B8)](https://pubmed.ncbi.nlm.nih.gov/41735542/)

[Download BibTeX](https://atlas.epigenomelab.com/citation.bib) · [Download RIS](https://atlas.epigenomelab.com/citation.ris) · [PubMed](https://pubmed.ncbi.nlm.nih.gov/41735542/) · [DOI](https://doi.org/10.1038/s42003-026-09720-w)


When using this resource, cite the original scientific study:

> Nooranikhojasteh A, Tavallaee G, Khuu N, et al. **Chromatin accessibility landscapes define stromal cell identities across tissues.** *Communications Biology* **9**, 480 (2026). https://doi.org/10.1038/s42003-026-09720-w

Original data: [GEO GSE286329](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE286329). The study's analysis code is available separately at [OroujiLab/Mouse_Tissues_scATAC](https://github.com/OroujiLab/Mouse_Tissues_scATAC).

## Licenses

- **Atlas software:** [MIT](LICENSE), including the copy [served with the site](site/LICENSE.txt).
- **Curated atlas data under `site/data/`:** [Creative Commons Attribution 4.0 (CC BY 4.0)](site/data/LICENSE.md). Credit and change disclosure are required.
- **Original article:** independently licensed CC BY 4.0 by its publisher.
- **Third-party sources, external marker BED files and laboratory branding:** governed by their own applicable rights; not relicensed by the atlas.

For the current version and maintenance information, see [Release notes](docs/RELEASE_NOTES.md).
