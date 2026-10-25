// Browser integration checks with synthetic, non-biological data only.
// No authentication, secrets, private files, or outbound uploads.
"use strict";
const {test,before,after}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {chromium}=require("playwright-core");

let browser;
before(async()=>{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
});
after(async()=>{if(browser)await browser.close()});
const site=pathToFileURL(path.resolve(__dirname,"../site/index.html")).href;
const fakePeaks={
  "Fibroblasts_markers.bed":"chr1\t10\t20\nchr1\t25\t40\nchr2\t10\t30\n",
  "Endothelial Cells_markers.bed":"chr1\t20\t25\nchr1\t28\t36\nchr2\t0\t10\n",
  "Enteroendocrine Cells_markers.bed":""
};
async function setup(viewport){
  const page=await browser.newPage({viewport,acceptDownloads:true});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("https://raw.githubusercontent.com/**",route=>{
    const name=decodeURIComponent(route.request().url().split("/").pop());
    return route.fulfill({status:200,body:fakePeaks[name]||"",
      headers:{"access-control-allow-origin":"*","content-type":"text/plain"}});
  });
  await page.goto(site);
  return {page,errors};
}
function csv(n){
  const lines=["cell_id,Sample,Clusters50,umap_1,umap_2"];
  const tissues=["Brain","Colon","Heart","Kidney","Liver","Lung","Pancreas","Small_Intestine","Spleen"];
  for(let i=0;i<n;i++)
    lines.push("cell_"+i+","+tissues[i%9]+",type_"+(i%28)+","+
       (Math.sin(i/13)*6).toFixed(5)+","+(Math.cos(i/17)*8).toFixed(5));
  return lines.join("\n");
}
test("responsive navigation and safe empty-state views",async()=>{
  for(const viewport of [{width:1350,height:880},{width:390,height:844}]){
    const {page,errors}=await setup(viewport);
    await page.locator('[data-tab="compare"]').click();
    assert.equal(await page.locator("#compare").isVisible(),true);
    const sizes=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
    assert.ok(sizes[0]<=sizes[1]+2,"unexpected horizontal page overflow");
    assert.deepEqual(errors,[]);
    await page.close();
  }
});
test("synthetic peak overlap, empty group, BED export, coordinate filter",async()=>{
  const {page,errors}=await setup({width:1350,height:880});
  await page.locator('[data-tab="compare"]').click();
  await page.locator("#compare-a").selectOption("Fibroblasts");
  await page.locator("#compare-b").selectOption("Endothelial Cells");
  await page.locator("#compare-run").click();
  await page.getByText("Comparison complete.",{exact:false}).waitFor();
  assert.match(await page.locator("#compare-summary").innerText(),/Fibroblasts peaks without overlap\s+2/);
  const exported=page.waitForEvent("download");
  await page.locator("#compare-download").click();
  assert.match((await exported).suggestedFilename(),/\.bed$/);
  await page.locator("#compare-b").selectOption("Enteroendocrine Cells");
  await page.locator("#compare-run").click();
  await page.getByText("Comparison complete.",{exact:false}).waitFor();
  assert.match(await page.locator("#compare-summary").innerText(),/Enteroendocrine Cells marker peaks\s+0/);
  await page.locator('[data-tab="regions"]').click();
  await page.locator("#load").click();
  await page.getByText("3 matching intervals",{exact:false}).waitFor();
  await page.locator("#chr").selectOption("chr1");
  await page.getByText("2 matching intervals",{exact:false}).waitFor();
  await page.locator("#interval").fill("chr1:19-26");
  await page.locator("#interval").dispatchEvent("change");
  await page.getByText("2 matching intervals",{exact:false}).waitFor();
  assert.deepEqual(errors,[]);
  await page.close();
});
test("51,248 synthetic cells: import, filter, zoom and CSV download",async()=>{
  const {page,errors}=await setup({width:1350,height:880});
  const start=Date.now();
  await page.locator("#file").setInputFiles({
    name:"synthetic.csv",mimeType:"text/csv",buffer:Buffer.from(csv(51248))
  });
  await page.getByText("51,248 / 51,248 cells").waitFor({timeout:30000});
  console.log("UMAP_IMPORT_MS="+(Date.now()-start));
  await page.locator("#color").selectOption("Cell type");
  await page.locator("#tissue").selectOption("Heart");
  await page.getByText("5,694 / 51,248 cells").waitFor();
  await page.locator("#umap").hover();
  await page.mouse.wheel(0,-120);
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>state.zoom)>1);
  await page.locator("#resetview").click();
  assert.equal(await page.evaluate(()=>state.zoom),1);
  const exported=page.waitForEvent("download");
  await page.locator("#export").click();
  assert.equal((await exported).suggestedFilename(),"mouse_atlas_selected_cells.csv");
  assert.deepEqual(errors,[]);
  await page.close();
});
test("live published BED browser fetch, chromosome interval, and empty source",async()=>{
  const page=await browser.newPage({viewport:{width:1350,height:880}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(site);
  await page.locator('[data-tab="regions"]').click();
  await page.locator("#marker").selectOption("T Cells");
  await page.locator("#load").click();
  await page.getByText("18,255 matching intervals",{exact:false}).waitFor({timeout:20000});
  await page.locator("#interval").fill("chr6:41000000-42000000");
  await page.locator("#interval").dispatchEvent("change");
  await page.getByText("42 matching intervals",{exact:false}).waitFor();
  await page.locator("#interval").fill("nonsense");
  await page.locator("#interval").dispatchEvent("change");
  assert.equal(await page.locator("#download").isDisabled(),true);
  await page.locator("#interval").fill("");
  await page.locator("#marker").selectOption("Enteroendocrine Cells");
  await page.locator("#load").click();
  await page.getByText("0 matching intervals",{exact:false}).waitFor({timeout:20000});
  assert.equal(await page.locator("#download").isDisabled(),true);
  assert.deepEqual(errors,[]);
  await page.close();
});
test("reject duplicate identifiers",async()=>{
  const {page,errors}=await setup({width:1350,height:880});
  await page.locator("#file").setInputFiles({
    name:"invalid.csv",mimeType:"text/csv",
    buffer:Buffer.from("cell_id,Sample,Clusters50,umap_1,umap_2\na,Heart,T,1,2\na,Lung,T,2,3")
  });
  await page.getByText("Duplicate cell identifiers",{exact:false}).waitFor();
  assert.deepEqual(errors,[]);
  await page.close();
});
test("reject missing numerical coordinates, not silently coerce to zero",async()=>{
  const {page,errors}=await setup({width:1350,height:880});
  await page.locator("#file").setInputFiles({
    name:"bad-coordinate.csv",mimeType:"text/csv",
    buffer:Buffer.from("cell_id,Sample,Clusters50,umap_1,umap_2\na,Brain,Fibroblasts,,2")
  });
  await page.getByText("Missing UMAP coordinates",{exact:false}).waitFor();
  assert.equal(await page.locator("#count").innerText(),"Awaiting data");
  assert.deepEqual(errors,[]);
  await page.close();
});
test("invalid replacement import clears previously loaded atlas",async()=>{
 const {page,errors}=await setup({width:1350,height:880});
 await page.locator("#file").setInputFiles({
  name:"valid.csv",mimeType:"text/csv",
  buffer:Buffer.from("cell_id,Sample,Clusters50,umap_1,umap_2\na,Heart,Fibroblasts,1,2")
 });
 await page.getByText("1 / 1 cells").waitFor();
 await page.locator("#file").setInputFiles({
  name:"invalid.csv",mimeType:"text/csv",
  buffer:Buffer.from("cell_id,Sample,Clusters50,umap_1,umap_2\na,Heart,Fibroblasts,,2")
 });
 await page.getByText("Import rejected: Missing UMAP coordinates",{exact:false}).waitFor();
 assert.equal(await page.locator("#count").innerText(),"Awaiting data");
 assert.equal(await page.locator("#filterzone").isHidden(),true);
 assert.equal(await page.locator("#color").isDisabled(),true);
 assert.deepEqual(errors,[]);
 await page.close()
});

test("Phase 3 BED union metrics, directional percentages, UCSC link",async()=>{
 const {page,errors}=await setup({width:1350,height:880});
 await page.locator('[data-tab="regions"]').click();
 await page.locator("#load").click();
 await page.getByText("3 matching intervals",{exact:false}).waitFor();
 assert.match(await page.locator("#region-stats").innerText(),/3\s+Selected peaks/);
 assert.match(await page.locator("#region-stats").innerText(),/45 bp\s+Nonredundant span/);
 assert.match(await page.locator("#region-stats").innerText(),/15 bp\s+Median peak width/);
 const url=new URL(await page.locator("#peaks tr a").first().getAttribute("href"));
 assert.equal(url.searchParams.get("db"),"mm10");
 assert.equal(url.searchParams.get("position"),"chr1:11-20");
 await page.locator('[data-tab="compare"]').click();
 await page.locator("#compare-run").click();
 await page.getByText("Comparison complete.",{exact:false}).waitFor();
 assert.match(await page.locator("#compare-summary").innerText(),/33\.3% of Fibroblasts input peaks/);
 await page.locator("#compare-b").selectOption("Enteroendocrine Cells");
 await page.locator("#compare-run").click();
 await page.getByText("Comparison complete.",{exact:false}).waitFor();
 assert.match(await page.locator("#compare-summary").innerText(),/N\/A \(empty set\)/);
 assert.deepEqual(errors,[]);
 await page.close();
});
