// Real Phase 1E atlas smoke test. Data remain on the local CI runner;
// browser requests only the static files served from this repository.
"use strict";
const {test,before,after}=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright-core");

const root=path.resolve(__dirname,"../site");
const cells=path.join(root,"data/cells.csv");
const contentTypes={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".csv":"text/csv; charset=utf-8",".json":"application/json"};
let server,browser,base;

before(async()=>{
  assert.ok(fs.existsSync(cells),"Expected committed site/data/cells.csv");
  server=http.createServer((req,res)=>{
    const pathPart=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const resolved=path.resolve(root,"."+pathPart.replace(/\/$/,"/index.html"));
    if(!resolved.startsWith(root+path.sep)){res.writeHead(403).end();return}
    fs.readFile(resolved,(err,bytes)=>{
      if(err){res.writeHead(404).end("Missing file");return}
      res.writeHead(200,{"content-type":contentTypes[path.extname(resolved)]||"application/octet-stream","cache-control":"no-store"});
      res.end(bytes)
    })
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  base="http://127.0.0.1:"+server.address().port+"/";
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]})
});
after(async()=>{
  if(browser)await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve))
});
test("actual 48,385-cell CSV autoload, annotations, filters, zoom and export",async()=>{
  const page=await browser.newPage({viewport:{width:1350,height:880},acceptDownloads:true});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  const start=Date.now();
  await page.goto(base);
  await page.getByText("48,385 / 48,385 cells").waitFor({timeout:45000});
  console.log("REAL_UMAP_LOAD_MS="+(Date.now()-start));
  const guide=await page.locator(".notice").innerText();
  const plotNote=await page.locator("#plotnote").innerText();
  assert.match(guide,/Explore the atlas/);
  assert.doesNotMatch(guide,/\bAmin\b|difference from the full study|48,385 vs 51,248/i);
  assert.doesNotMatch(plotNote,/Amin|awaits confirmation|cell accounting/i);
  const census=await page.evaluate(()=>({
    cells:state.cells.length,
    tissues:[...new Set(state.cells.map(c=>c.tissue))].sort(),
    types:[...new Set(state.cells.map(c=>c.type))].sort(),
    clusters:[...new Set(state.cells.map(c=>c.cluster))].sort(),
    unknown:state.cells.filter(c=>c.type==="Unassigned").length
  }));
  // A Retina display gets a larger drawing buffer while logical plot units stay fixed.
  const canvasInfo=await page.evaluate(()=>({width:document.querySelector("#umap").width,height:document.querySelector("#umap").height,dpr:Math.min(3,Math.max(1,window.devicePixelRatio||1))}));
  assert.equal(canvasInfo.width,Math.round(850*canvasInfo.dpr));
  assert.equal(canvasInfo.height,Math.round(570*canvasInfo.dpr));
  assert.equal(census.cells,48385);
  assert.equal(census.tissues.length,9);
  assert.equal(census.types.length,29,"28 named cell types + Unassigned");
  assert.equal(census.clusters.length,50);
  assert.equal(census.unknown,28);
  assert.equal(await page.locator("#filterzone").isVisible(),true);
  await page.locator("#color").selectOption("Cell type");
  await page.locator("#tissue").selectOption("Brain");
  await page.getByText("6,508 / 48,385 cells").waitFor();
  await page.locator("#celltype").selectOption("Unassigned");
  await page.getByText("28 / 48,385 cells").waitFor();
  const downloadEvent=page.waitForEvent("download");
  await page.locator("#export").click();
  const d=await downloadEvent;
  assert.equal(d.suggestedFilename(),"mouse_atlas_selected_cells.csv");
  const exported=fs.readFileSync(await d.path(),"utf8").trim().split(/\r?\n/);
  assert.equal(exported[0],"cell_id,Sample,Clusters50,CellType,umap_1,umap_2");
  assert.equal(exported.length,29);
  assert.ok(exported.slice(1).every(line=>line.includes('"C11","NA"')));
  await page.locator("#umap").hover();
  await page.mouse.wheel(0,-120);
  await page.waitForTimeout(50);
  assert.ok(await page.evaluate(()=>state.zoom)>1);
  await page.locator("#resetview").click();
  assert.equal(await page.evaluate(()=>state.zoom),1);
  await page.locator("#file").setInputFiles({
    name:"manual_override.csv",mimeType:"text/csv",
    buffer:Buffer.from("cell_id,Sample,Clusters50,CellType,umap_1,umap_2\nmanual,Heart,C1,T Cells,1.5,2.5\n")
  });
  await page.getByText("1 / 1 cells").waitFor();
  assert.deepEqual(errors,[]);
  await page.close()
});

test("Retina backing store scales without changing cell counts",async()=>{
 const page=await browser.newPage({viewport:{width:1100,height:820},deviceScaleFactor:2});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base);
 await page.getByText("48,385 / 48,385 cells").waitFor({timeout:45000});
 const info=await page.evaluate(()=>({width:document.querySelector("#umap").width,height:document.querySelector("#umap").height,cells:state.cells.length}));
 assert.deepEqual(info,{width:1700,height:1140,cells:48385});
 await page.locator("#tissue").selectOption("Heart");
 await page.getByText("6,119 / 48,385 cells").waitFor();
 assert.deepEqual(errors,[]);
 await page.close()
});

test("gene activity lazy-load UI uses atlas order and preserved source score values",async()=>{
 const page=await browser.newPage({viewport:{width:1200,height:820},acceptDownloads:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const values=Array.from({length:48385},(_,i)=>i%4===0?4.5:0);
 await page.route("**/data/gene_activity/Alb.json",async route=>{
  await route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({gene:"Alb",values})})
 });
 await page.goto(base);
 await page.getByText("48,385 / 48,385 cells").waitFor({timeout:45000});
 await page.locator('[data-tab="gene"]').click();
 await page.getByText("Alb: 48,385 atlas cells").waitFor({timeout:45000});
 assert.equal(await page.locator("#gene-export").isEnabled(),true);
 assert.equal(await page.evaluate(()=>geneActivity.values.length),48385);
 await page.locator("#gene-tissue").selectOption("Heart");
 assert.equal(await page.locator("#gene-tissue").inputValue(),"Heart");
 const event=page.waitForEvent("download");
 await page.locator("#gene-export").click();
 const downloaded=await event;
 assert.equal(downloaded.suggestedFilename(),"mouse_atac_Alb_gene_scores.csv");
 const lines=fs.readFileSync(await downloaded.path(),"utf8").trim().split(/\r?\n/);
 assert.equal(lines[0],"cell_id,Sample,Clusters50,CellType,gene,archr_gene_score");
 assert.equal(lines.length,6120);
 assert.deepEqual(errors,[]);
 await page.close()
});

test("real committed ArchR scores lazy load, filter, and export unchanged",async()=>{
 const page=await browser.newPage({viewport:{width:1230,height:820},acceptDownloads:true});
 const errors=[];page.on("pageerror",error=>errors.push(error.message));
 await page.goto(base);
 await page.getByText("48,385 / 48,385 cells").waitFor({timeout:45000});
 await page.locator('[data-tab="gene"]').click();
 await page.getByText("Alb: 48,385 atlas cells").waitFor({timeout:45000});
 const alb=JSON.parse(fs.readFileSync(path.join(root,"data/gene_activity/Alb.json"),"utf8")).values;
 const sampled=await page.evaluate(()=>({
  length:geneActivity.values.length,
  nonzero:geneActivity.values.filter(v=>v>0).length,
  sample:geneActivity.values.slice(0,5),
  plotWidth:document.querySelector("#gene-umap").width,
  name:geneActivity.gene
 }));
 assert.equal(sampled.length,48385);
 assert.equal(sampled.nonzero,12460);
 assert.deepEqual(sampled.sample,alb.slice(0,5));
 assert.equal(sampled.name,"Alb");
 assert.equal(sampled.plotWidth,850);
 await page.locator("#gene-tissue").selectOption("Heart");
 assert.equal(await page.locator("#gene-tissue").inputValue(),"Heart");
 const event=page.waitForEvent("download");
 await page.locator("#gene-export").click();
 const file=await event;
 const csv=fs.readFileSync(await file.path(),"utf8").trimEnd().split(/\r?\n/);
 assert.equal(csv.length,6120);
 const first=await page.evaluate(()=>{
  const i=state.cells.findIndex(c=>c.tissue==="Heart");
  return {cell:state.cells[i],score:geneActivity.values[i]}
 });
 const fields=csv[1].split(",").map(x=>x.replace(/^"|"$/g,""));
 assert.deepEqual(fields.slice(0,2),[first.cell.id,first.cell.tissue]);
 assert.equal(Number(fields[5]),first.score);
 await page.locator("#gene-select").selectOption("Ins1");
 await page.getByText("Ins1: 48,385 atlas cells").waitFor({timeout:45000});
 assert.equal(await page.evaluate(()=>geneActivity.values.filter(v=>v>0).length),11068);
 assert.deepEqual(errors,[]);
 await page.close()
});

test("real 90-group SEACell composition and highlighted UMAP",async()=>{
 const page=await browser.newPage({viewport:{width:1250,height:850},acceptDownloads:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base);
 await page.getByText("48,385 / 48,385 cells").waitFor({timeout:45000});
 await page.waitForFunction(()=>{const o=document.querySelector('#color option[value="SEACell"]');return o&&!o.disabled},{timeout:15000});
 await page.locator("#color").selectOption("SEACell");
 await page.getByText("SEACell-0: 501 cells across 3 tissues and 2 annotated cell types.",{exact:false}).waitFor({timeout:45000});
 assert.equal(await page.locator("#metacell-panel").isVisible(),true);
 assert.equal(await page.locator("#metacell-export").isEnabled(),true);
 const r=await page.evaluate(()=>({
  groups:metacellState.groups.length,
  mapped:metacellState.byId.size,
  first:metacellState.groups.find(g=>g.id==="SEACell-0"),
  matching:state.cells.filter(c=>metacellState.byId.get(c.id)==="SEACell-0").length,
  visible:state.visible.length,
  option:$("color").value
 }));
 assert.equal(r.groups,90);
 assert.equal(r.mapped,48385);
 assert.deepEqual(r.first,{id:"SEACell-0",n:501,t:3,types:2});
 assert.equal(r.matching,501);assert.equal(r.visible,48385);
 assert.equal(r.option,"SEACell");
 const event=page.waitForEvent("download");
 await page.locator("#metacell-export").click();
 const download=await event;
 assert.equal(download.suggestedFilename(),"mouse_atac_SEACell-0_cells.csv");
 const csv=fs.readFileSync(await download.path(),"utf8").trimEnd().split(/\r?\n/);
 assert.equal(csv[0],"cell_id,Sample,Clusters50,CellType,umap_1,umap_2,SEACell");
 assert.equal(csv.length,502);
 await page.locator("#seacell-select").selectOption("SEACell-69");
 await page.getByText("SEACell-69: 1,636 cells across 9 tissues and 26 annotated cell types.",{exact:false}).waitFor();
 await page.locator("#color").selectOption("Tissue");
 assert.equal(await page.locator("#metacell-panel").isHidden(),true);
 await page.locator("#file").setInputFiles({name:"other.csv",mimeType:"text/csv",
  buffer:Buffer.from("cell_id,Sample,Clusters50,CellType,umap_1,umap_2\nmanual,Brain,C1,T Cells,1,2\n")});
 await page.getByText("1 / 1 cells").waitFor();
 assert.equal(await page.locator('#color option[value="SEACell"]').isDisabled(),true);
 assert.deepEqual(errors,[]);
 await page.close()
});

test("Phase 5 keyboard tabs and canvas pan/zoom preserve real UMAP",async()=>{
 const page=await browser.newPage({viewport:{width:1200,height:820}});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base);
 await page.getByText("48,385 / 48,385 cells").waitFor({timeout:45000});
 const tabs=page.getByRole("tab");
 assert.equal(await tabs.count(),6);
 assert.equal(await tabs.nth(0).getAttribute("aria-selected"),"true");
 await tabs.nth(0).focus();
 await page.keyboard.press("ArrowRight");
 assert.equal(await tabs.nth(1).getAttribute("aria-selected"),"true");
 assert.equal(await tabs.nth(0).getAttribute("aria-selected"),"false");
 assert.equal(await page.getByRole("tabpanel",{name:"Accessible regions"}).isVisible(),true);
 await page.keyboard.press("End");
 assert.equal(await tabs.nth(5).getAttribute("aria-selected"),"true");
 await page.keyboard.press("Home");
 assert.equal(await tabs.nth(0).getAttribute("aria-selected"),"true");
 assert.equal(await page.getByRole("tabpanel",{name:"Cell atlas"}).isVisible(),true);
 await page.locator("#umap").focus();
 await page.keyboard.press("ArrowLeft");
 assert.equal(await page.evaluate(()=>state.offsetX),26);
 await page.keyboard.press("Equal");
 assert.ok(await page.evaluate(()=>state.zoom)>1);
 await page.locator("#zoomout").click();
 assert.ok(Math.abs((await page.evaluate(()=>state.zoom))-1)<1e-10);
 await page.locator("#zoomin").click();
 assert.ok(await page.evaluate(()=>state.zoom)>1);
 await page.locator("#resetview").click();
 assert.deepEqual(await page.evaluate(()=>({zoom:state.zoom,x:state.offsetX,y:state.offsetY})),{zoom:1,x:0,y:0});
 assert.deepEqual(errors,[]);
 await page.close()
});

test("Option B colors match tissue legend and composition bars on real atlas",async()=>{
 const page=await browser.newPage({viewport:{width:1240,height:850}});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base);
 await page.getByText("48,385 / 48,385 cells").waitFor({timeout:45000});
 const colors=await page.evaluate(()=>{
  const out={};
  for(const item of document.querySelectorAll("#legend .legend-item")){
   const name=item.textContent.replace(/ \([0-9,]+\)$/,"").replaceAll(" ","_");
   out[name]=item.querySelector("i").style.backgroundColor
  }
  return out
 });
 assert.equal(Object.keys(colors).length,9);
 const expected={"Small_Intestine":"rgb(31, 120, 180)","Brain":"rgb(51, 166, 204)",
  "Heart":"rgb(76, 110, 245)","Pancreas":"rgb(192, 90, 141)",
  "Kidney":"rgb(142, 107, 190)","Colon":"rgb(217, 119, 50)",
  "Lung":"rgb(42, 157, 143)","Spleen":"rgb(107, 114, 128)",
  "Liver":"rgb(179, 143, 42)"};
 assert.deepEqual(colors,expected);
 const tissueBars=await page.locator("#composition .bar").evaluateAll(rows=>rows.map(row=>({
  label:row.querySelector("label").textContent.replaceAll(" ","_"),
  color:row.querySelector(".fill").style.backgroundColor
 })));
 for(const b of tissueBars)assert.equal(b.color,expected[b.label]);
 assert.deepEqual(errors,[]);
 await page.close()
});
