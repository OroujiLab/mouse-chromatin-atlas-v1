# Release notes

## Release 1 — October 2026

**Official website:** https://atlas.epigenomelab.com/  
**Genome assembly:** mm10  
**Application:** fully static HTML/CSS/JavaScript

### Included

- Browser-rendered UMAP of **48,385 curated mouse scATAC cells** from nine tissues, 50 source cluster identifiers and 28 named cell types plus unassigned cells.
- Tissue and cell-type coloring, filters, cell composition, CSV export and high-resolution canvas rendering.
- The nine-color **Option B** tissue palette, consistently applied across the tissue UMAP, its legend, and tissue composition displays.
- Highlighting for **90 source-derived SEACell groups**, with group membership and per-tissue/per-type summaries.
- Ten original ArchR ATAC-derived gene-activity profiles on the same UMAP.
- Published mm10 marker BED region browser, UCSC links, source downloads, and descriptive pairwise coordinate-overlap comparisons.
- Responsive blue-and-white Epigenome Lab styling, keyboard-navigation controls, scientific provenance and MIT/CC BY 4.0 license notices.

### Scientific limitations

- Gene scores measure ATAC-derived gene activity, not RNA expression.
- BED coordinate overlap is descriptive; no differential-accessibility test or causality is inferred.
- SEACell labels may describe heterogeneous tissue or cell-type groups.
- Motif-enrichment and peak-to-gene explorer panels are not part of Release 1.
- Cell counts shown in the browser correspond to its 48,385 validated curated cells, not an inferred reconstruction of the entire published study.

### Validation and availability

- Scientific/data integrity and browser interaction checks run through GitHub Actions on the maintained source.
- The owner visually reviewed the original atlas, approved the selected tissue colors and confirmed that the custom-domain page renders the expected UMAP and tissue composition.
- The Cloudflare Pages dashboard reported `atlas.epigenomelab.com` **Active** with **SSL enabled**.
- This release overview does not claim that every browser download and external source link was manually checked on the custom hostname; regression tests exercise key functions.

See [Scientific data](SCIENTIFIC_DATA.md) and [Maintenance](MAINTENANCE.md).
