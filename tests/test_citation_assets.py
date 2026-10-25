"""Check citation downloads, full author metadata, and release README badges."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
DOI="10.1038/s42003-026-09720-w"
NAMES=("Nooranikhojasteh","Tavallaee","Khuu","Shen","Ouladan","Raman","Orouji")
class CitationAssets(unittest.TestCase):
 def test_citations(self):
  html=(ROOT/"site/index.html").read_text()
  for f in ("citation.bib","citation.ris"):
   data=(ROOT/"site"/f).read_text()
   self.assertIn(DOI,data)
   self.assertIn(f'href="{f}"',html)
   for name in NAMES:self.assertIn(name,data)
  self.assertIn('download="mouse-chromatin-atlas.bib"',html)
  self.assertIn('download="mouse-chromatin-atlas.ris"',html)
  self.assertIn("https://pubmed.ncbi.nlm.nih.gov/41735542/",html)
 def test_public_repo_badges_and_git_citation(self):
  readme=(ROOT/"README.md").read_text()
  cff=(ROOT/"CITATION.cff").read_text()
  self.assertIn("img.shields.io/badge/release-v1",readme)
  self.assertIn("preferred-citation:",cff)
  self.assertIn(DOI,cff)
  for name in NAMES:self.assertIn(name,cff)
if __name__=="__main__":unittest.main()
