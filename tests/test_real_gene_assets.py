"""Validate all Phase 2 browser gene files when they are installed.

Before owner's one-time upload, skip data assertions if *no* gene JSON is present.
A partial upload is an error. Original matrix is never needed for CI.
"""
import hashlib,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
DIR=ROOT/"site"/"data"/"gene_activity"
class GeneAssetsTests(unittest.TestCase):
 def test_gene_files_after_upload(self):
  index=json.loads((DIR/"index.json").read_text())
  self.assertEqual(index["schema"],"atlas-gene-activity-index-v1")
  expected=index["genes"]
  self.assertEqual(len(expected),10)
  current=list(DIR.glob("*.json"))
  installed=[p for p in current if p.name!="index.json"]
  if not installed:self.skipTest("Awaiting verified ten-gene JSON upload")
  self.assertEqual(len(installed),10,"Partial gene-data upload")
  for gene,metadata in expected.items():
   p=DIR/(gene+".json")
   self.assertTrue(p.is_file(),p.name)
   raw=p.read_bytes()
   self.assertEqual(len(raw),metadata["bytes"],gene)
   self.assertEqual(hashlib.sha256(raw).hexdigest(),metadata["sha256"],gene)
   data=json.loads(raw)
   self.assertEqual(data["gene"],gene)
   vals=data["values"]
   self.assertEqual(len(vals),index["cells"])
   self.assertEqual(sum(v is not None and v!=0 for v in vals),metadata["nonzero"])
   self.assertEqual(min(v for v in vals if v is not None),metadata["min"])
   self.assertEqual(max(v for v in vals if v is not None),metadata["max"])
if __name__=="__main__":unittest.main()
