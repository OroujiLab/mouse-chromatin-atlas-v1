const {test}=require("node:test");
const assert=require("node:assert/strict");
const {parseBed,compare,bedText}=require("../site/regions-core.js");
test("parse BED and reject malformed rows",()=>{const p=parseBed("#comment\nchr1\t0\t10\nchr1\t10\t10\nchr2\t2\t8\n");assert.equal(p.rows.length,2);assert.equal(p.rejected,1)});
test("half-open boundaries do not overlap",()=>{const v=compare([["chr1",100,150]],[["chr1",150,180]]);assert.equal(v.aOverlap.length,0);assert.equal(v.bOverlap.length,0)});
test("nested and partly overlapping regions",()=>{const a=[["chr1",100,200],["chr1",300,350]],b=[["chr1",195,210],["chr1",0,1000]];const c=compare(a,b);assert.equal(c.aOverlap.length,2);assert.equal(c.bOverlap.length,2)});
test("empty published BED returns no overlaps",()=>{const c=compare([],[["chr1",1,2]]);assert.equal(c.aTotal,0);assert.equal(c.bOnly.length,1)});
test("BED output uses 0-based half-open coordinates",()=>assert.equal(bedText([["chr1",0,10]]),"chr1\t0\t10\n"));

test("merged coverage avoids counting overlaps twice, separately by chromosome",()=>{
 const {unionCoverageBp,medianLength}=require("../site/regions-core.js");
 const rows=[["chr1",0,10],["chr1",5,15],["chr1",15,20],["chr2",0,5],["chr2",1,3]];
 assert.equal(unionCoverageBp(rows),25);
 assert.equal(medianLength(rows),5);
 assert.equal(unionCoverageBp([]),0);
 assert.equal(medianLength([]),null);
 assert.equal(medianLength([["chr1",0,10],["chr1",10,15]]),7.5);
});
test("UCSC link uses mm10 and 1-based display without changing BED source",()=>{
 const {ucscUrl,bedText}=require("../site/regions-core.js");
 const row=["chr6",41000000,42000000];
 const url=new URL(ucscUrl(row));
 assert.equal(url.hostname,"genome.ucsc.edu");
 assert.equal(url.searchParams.get("db"),"mm10");
 assert.equal(url.searchParams.get("position"),"chr6:41000001-42000000");
 assert.equal(bedText([row]),"chr6\t41000000\t42000000\n");
 assert.throws(()=>ucscUrl(["chr6",-1,10]));
 assert.throws(()=>ucscUrl(["chr6",10,10]));
});
