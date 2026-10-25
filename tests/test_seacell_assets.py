"""Phase 4C: validate source-derived 48,385-cell SEACell files against atlas metadata."""
import collections,csv,hashlib,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/"site"/"data"
class SEACellAssetTests(unittest.TestCase):
 def test_real_assignment_integrity_and_provenance(self):
  manifest=json.loads((DATA/"seacell_manifest.json").read_text())
  self.assertEqual(manifest["schema"],"atlas-seacell-assignments-v1")
  for entry in manifest["files"].values():
   fp=ROOT/"site"/entry["path"]
   raw=fp.read_bytes()
   self.assertEqual(len(raw),entry["bytes"],entry["path"])
   self.assertEqual(hashlib.sha256(raw).hexdigest(),entry["sha256"],entry["path"])
  with (DATA/"cells.csv").open(newline="",encoding="utf-8") as fh:
   cells=list(csv.DictReader(fh))
  with (DATA/"seacell_assignments.csv").open(newline="",encoding="utf-8") as fh:
   assignments=list(csv.DictReader(fh))
  with (DATA/"seacell_groups.csv").open(newline="",encoding="utf-8") as fh:
   groups=list(csv.DictReader(fh))
  self.assertEqual(len(cells),48385)
  self.assertEqual(len(assignments),48385)
  self.assertEqual(len(groups),90)
  atlas={c["cell_id"]:c for c in cells}
  self.assertEqual(len(atlas),48385)
  ids=[a["cell_id"] for a in assignments]
  self.assertEqual(len(set(ids)),48385)
  self.assertEqual(set(ids),set(atlas))
  self.assertEqual(ids,sorted(ids))
  by_group=collections.defaultdict(lambda:{"n":0,"tissues":set(),"types":set()})
  for row in assignments:
   group=row["seacell"]
   self.assertRegex(group,r"^SEACell-\d+$")
   c=atlas[row["cell_id"]]
   g=by_group[group];g["n"]+=1;g["tissues"].add(c["Sample"]);g["types"].add(c["CellType"])
  group_ids={g["seacell"] for g in groups}
  self.assertEqual(group_ids,set(by_group))
  for row in groups:
   g=by_group[row["seacell"]]
   self.assertEqual(int(row["n_cells"]),g["n"])
   self.assertEqual(int(row["n_tissues"]),len(g["tissues"]))
   self.assertEqual(int(row["n_celltypes"]),len(g["types"]))
  self.assertEqual(min(x["n"] for x in by_group.values()),166)
  self.assertEqual(max(x["n"] for x in by_group.values()),1636)
  self.assertEqual(sum(len(x["tissues"])>1 for x in by_group.values()),67)
  self.assertEqual(sum(len(x["types"])>1 for x in by_group.values()),68)
if __name__=="__main__":unittest.main()
