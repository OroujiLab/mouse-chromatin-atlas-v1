"""Public static release text/privacy checks; excludes historical private development docs."""
import json,re
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/"site"
class PublicReleaseAudit(unittest.TestCase):
 def test_no_internal_status_or_personnel_in_served_copy(self):
  text=(SITE/"index.html").read_text()
  for token in ("private development preview","Development preview","Not publicly deployed",
                "Amin","ChatGPT","OpenAI","AI-generated","pending confirmation"):
   self.assertNotIn(token,text)
  self.assertIn("<b>48,385</b> atlas cells",text)
  self.assertIn("Mouse Chromatin Atlas",text)
 def test_served_manifests_exclude_handoffs(self):
  for path in ("data/manifest.json","data/seacell_manifest.json","data/gene_activity/index.json"):
   obj=json.loads((SITE/path).read_text())
   raw=json.dumps(obj)
   self.assertNotRegex(raw,r"(?i)Amin|ChatGPT|PRIVATE_RESEARCH_PREVIEW|PRIVATE_VALIDATED_SOURCE|awaiting confirmation")
   self.assertNotIn("drive.google.com/file/d/",raw)
 def test_scientific_and_license_guardrails(self):
  html=(SITE/"index.html").read_text()
  self.assertIn("not RNA expression",html)
  self.assertIn('href="LICENSE.txt"',html)
  self.assertIn('href="data/LICENSE.md"',html)
  self.assertIn("10.1038/s42003-026-09720-w",html)
if __name__=="__main__":unittest.main()
