"use strict";
const $=id=>document.getElementById(id), fmt=n=>n.toLocaleString("en-US");
const tissueNames=["Brain","Colon","Heart","Kidney","Liver","Lung","Pancreas","Small_Intestine","Spleen"];
// Option B: a fixed tissue-specific palette for all tissue views.
// Independent cell-type, gene-activity and SEACell palettes remain unchanged.
const tissueColors=Object.freeze({
 "Small_Intestine":"#1F78B4",
 "Brain":"#33A6CC",
 "Heart":"#4C6EF5",
 "Pancreas":"#C05A8D",
 "Kidney":"#8E6BBE",
 "Colon":"#D97732",
 "Lung":"#2A9D8F",
 "Spleen":"#6B7280",
 "Liver":"#B38F2A"
});
const tissueColor=name=>tissueColors[name]||"#64748B";
const cellTypeColors=["#387d71","#c37651","#6383ba","#936d9e","#b29a48","#3f959c","#ac6985","#737f55","#796d5a","#59886d","#788bbc","#b06a57"];
const markerNames=["Alveolar Macrophages","Astrocytes","B Cells","Cardiomyocytes","Clara Cells","Collecting Duct Cells","Dendritic Cells","Distal Convoluted Tubule Cells","Endothelial Cells","Enterocytes","Enteroendocrine Cells","Fibroblasts","Goblet Cells","Hepatocytes","Macrophages","Mesothelial Cells","Microglial Cells","Neurons","Oligodendrocyte Precursor Cells","Oligodendrocyte","Pancreatic Acinar Cells","Pancreatic Beta Cells","Paneth Cells","Proximal Tubule Cells","Pulmonary Alveolar Type I","Pulmonary alveolar type II","Sinusoidal Endothelial Cells of Liver","T Cells"];
const markerBase="https://raw.githubusercontent.com/OroujiLab/Mouse_Tissues_scATAC/main/outputs/Peaks_bed/";
const state={cells:[],visible:[],peaks:[],matched:[],page:0,marker:"",zoom:1,offsetX:0,offsetY:0,hover:null,bounds:null};
const renderCache={canvas:null,dirty:true,scheduled:false};
const opt=(parent,value,label=value)=>{const o=document.createElement("option");o.value=value;o.textContent=label;parent.appendChild(o)};
const safeCsv=x=>'"'+String(x).replaceAll('"','""')+'"';
const download=(txt,name,mime)=>{const url=URL.createObjectURL(new Blob([txt],{type:mime}));const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)};
function setupTabs(){
 const tabs=[...document.querySelectorAll('[role="tab"][data-tab]')];
 function activateTab(tab,moveFocus=false){
  for(const item of tabs){
   const active=item===tab;
   item.classList.toggle("active",active);
   item.setAttribute("aria-selected",String(active));
   item.tabIndex=active?0:-1;
   const panel=$(item.dataset.tab);
   panel.classList.toggle("active",active)
  }
  if(moveFocus)tab.focus()
 }
 for(const tab of tabs){
  tab.addEventListener("click",()=>activateTab(tab));
  tab.addEventListener("keydown",event=>{
   let next=null;
   const i=tabs.indexOf(tab);
   if(event.key==="ArrowRight")next=tabs[(i+1)%tabs.length];
   else if(event.key==="ArrowLeft")next=tabs[(i+tabs.length-1)%tabs.length];
   else if(event.key==="Home")next=tabs[0];
   else if(event.key==="End")next=tabs[tabs.length-1];
   if(next){event.preventDefault();activateTab(next,true)}
  })
 }
}
function init(){setupTabs();tissueNames.forEach(t=>{const a=document.createElement("a");a.href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE286329";a.target="_blank";a.rel="noopener";a.textContent=t.replaceAll("_"," ");const s=document.createElement("span");s.textContent="View study GEO series ↗";a.append(s);$("samples").append(a)});markerNames.forEach(t=>opt($("marker"),t));$("marker").value="Fibroblasts";$("load").addEventListener("click",loadMarker);$("chr").addEventListener("change",filterPeaks);$("interval").addEventListener("change",filterPeaks);$("prev").addEventListener("click",()=>{state.page--;drawPeaks()});$("next").addEventListener("click",()=>{state.page++;drawPeaks()});$("download").addEventListener("click",()=>download(state.matched.map(r=>r.join("\t")).join("\n")+"\n",state.marker.replaceAll(" ","_")+"_filtered.bed","text/plain"));$("file").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=parseCsv(await file.text());geneActivity.canonical=false;geneActivity.values=null;geneActivity.serial++;metacellState.canonical=false;activate(data);updateMetacellAvailability();updateGeneTissues();renderGeneUMAP();$("gene-export").disabled=true;$("gene-status").textContent="Gene scores are available only for the original bundled cell order."}catch(err){clearAtlas();$("plotnote").textContent="Import rejected: "+err.message}});$("color").addEventListener("change",onAtlasColorChange);$("tissue").addEventListener("change",applyFilters);$("celltype").addEventListener("change",applyFilters);$("export").addEventListener("click",()=>download("cell_id,Sample,Clusters50,CellType,umap_1,umap_2\n"+state.visible.map(c=>[c.id,c.tissue,c.cluster,c.type==="Unassigned"?"NA":c.type,c.x,c.y].map(safeCsv).join(",")).join("\n"),"mouse_atlas_selected_cells.csv","text/csv"))}
function csvRows(text){
 const rows=[];let line=[],field="",quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}
  else if(c==='"'){if(field!=="")throw Error("Unexpected quote in CSV");quoted=true}
  else if(c===","){line.push(field);field=""}
  else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;line.push(field);field="";if(line.some(v=>v!==""))rows.push(line);line=[]}
  else field+=c
 }
 if(quoted)throw Error("Unclosed quoted CSV field");
 line.push(field);if(line.some(v=>v!==""))rows.push(line);
 return rows
}
function parseCsv(text){
 const lines=csvRows(text);if(lines.length<2)throw Error("CSV has no cell rows");
 const head=lines.shift().map(s=>s.trim().replace(/^\uFEFF/,""));
 const field=(...names)=>{for(const name of names){const k=head.indexOf(name);if(k>=0)return k}return -1};
 const idCol=field("cell_id","CellBarcode");
 const tissueCol=field("Sample","tissue");
 const typeCol=field("CellType","cell_type","Clusters50");
 const clusterCol=field("Clusters50");
 const xCol=field("umap_1","UMAP_1"),yCol=field("umap_2","UMAP_2");
 if([idCol,tissueCol,typeCol,xCol,yCol].some(i=>i<0))
  throw Error("Required fields: cell_id/CellBarcode, Sample, CellType, umap_1/UMAP_1, umap_2/UMAP_2");
 const typeField=head[typeCol];
 const namedTypesAvailable=typeField!=="Clusters50";
 const rows=lines.map(parts=>{
  if(parts.length!==head.length)throw Error("CSV row length does not match header");
  const id=parts[idCol],tissue=parts[tissueCol],type=parts[typeCol];
  const x=parts[xCol],y=parts[yCol],cluster=clusterCol>=0?parts[clusterCol]:"";
  if(!x?.trim()||!y?.trim())throw Error("Missing UMAP coordinates");
  if(!namedTypesAvailable&&/^C[0-9]+$/.test(type))
   throw Error("Cluster codes are not cell-type names: supply the mapped CellType column");
  return{id,tissue,type:type==="NA"?"Unassigned":type,cluster,x:Number(x),y:Number(y)}
 });
 if(rows.some(x=>!x.id||!x.tissue||!x.type||!Number.isFinite(x.x)||!Number.isFinite(x.y)))
  throw Error("Invalid cell, annotation or UMAP coordinates");
 const ids=new Set(rows.map(x=>x.id));
 if(ids.size!==rows.length)throw Error("Duplicate cell identifiers");
 return rows
}
function clearAtlas(){
 metacellState.canonical=false;updateMetacellAvailability();
 state.cells=[];state.visible=[];state.bounds=null;state.zoom=1;state.offsetX=0;state.offsetY=0;
 renderCache.dirty=true;
 $("count").textContent="Awaiting data";$("filterzone").hidden=true;$("color").disabled=true;
 $("composition").textContent="Upload validated cell-level metadata to explore tissue and cell type counts.";
 invalidateRender()
}
function activate(rows){$("color").disabled=false;state.cells=rows;state.zoom=1;state.offsetX=0;state.offsetY=0;
 const xmin=Math.min(...rows.slice(0,1).map(c=>c.x)),ymin=Math.min(...rows.slice(0,1).map(c=>c.y));
 let minX=xmin,maxX=xmin,minY=ymin,maxY=ymin;
 for(const c of rows){if(c.x<minX)minX=c.x;if(c.x>maxX)maxX=c.x;if(c.y<minY)minY=c.y;if(c.y>maxY)maxY=c.y}
 state.bounds={minX,maxX,minY,maxY};
 renderCache.dirty=true;$("filterzone").hidden=false;$("tissue").replaceChildren();$("celltype").replaceChildren();opt($("tissue"),"","All tissues");opt($("celltype"),"","All cell types");[...new Set(rows.map(c=>c.tissue))].sort().forEach(t=>opt($("tissue"),t,t.replaceAll("_"," ")));[...new Set(rows.map(c=>c.type))].sort().forEach(t=>opt($("celltype"),t));applyFilters();$("plotnote").textContent="Local exploratory preview; imported cells are not published or uploaded. Confirm identity with the original paper before public use."}
function applyFilters(){const t=$("tissue").value,c=$("celltype").value;state.visible=state.cells.filter(x=>(!t||x.tissue===t)&&(!c||x.type===c));$("count").textContent=fmt(state.visible.length)+" / "+fmt(state.cells.length)+" cells";invalidateRender();drawComposition();drawMetacellComposition()}
function invalidateRender(){renderCache.dirty=true;drawCells()}
// Logical plot units remain 850 × 570; the backing store is scaled for Retina screens.
const PLOT_WIDTH=850,PLOT_HEIGHT=570,MAX_PLOT_DPR=3;
function preparePlotCanvas(){
 const canvas=$("umap");
 const dpr=Math.min(MAX_PLOT_DPR,Math.max(1,window.devicePixelRatio||1));
 const width=Math.round(PLOT_WIDTH*dpr),height=Math.round(PLOT_HEIGHT*dpr);
 if(canvas.width!==width||canvas.height!==height){
  canvas.width=width;canvas.height=height;
  renderCache.dirty=true;
 }
 return dpr
}
function buildRenderCache(){
 const canvas=$("umap"),dpr=preparePlotCanvas(),layer=document.createElement("canvas");
 layer.width=canvas.width;layer.height=canvas.height;
 const context=layer.getContext("2d"),legend=$("legend");
 context.setTransform(dpr,0,0,dpr,0,0);
 legend.replaceChildren();
 if(!state.visible.length){renderCache.canvas=layer;renderCache.dirty=false;return}
 const {minX,maxX,minY,maxY}=state.bounds||{minX:0,maxX:1,minY:0,maxY:1};
 const dx=maxX-minX||1,dy=maxY-minY||1,col=$("color").value==="Cell type"?"type":"tissue";
 if($("color").value==="SEACell"&&metacellState.ready){renderMetacellLayer(context,legend,minX,maxX,minY,maxY);renderCache.canvas=layer;renderCache.dirty=false;return}
 const groups=new Map();
 for(const c of state.visible){
  const key=c[col];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c)
 }
 // Tissue colors are keyed by biological identity, not array or sort order.
 // Cell-type categories keep their original independent palette.
 const names=[...new Set(state.cells.map(c=>c[col]))].sort();
 const assigned=new Map(names.map((name,i)=>[
  name,col==="tissue"?tissueColor(name):cellTypeColors[i%cellTypeColors.length]
 ]));
 for(const [name,cells] of groups){
  context.fillStyle=assigned.get(name);
  for(const c of cells){
   const x=25+(c.x-minX)/dx*(PLOT_WIDTH-50),y=PLOT_HEIGHT-25-(c.y-minY)/dy*(PLOT_HEIGHT-50);
   context.fillRect(x,y,1.85,1.85)
  }
 }
 for(const [name,items] of [...groups].sort((a,b)=>b[1].length-a[1].length)){
  const item=document.createElement("span");item.className="legend-item";
  const dot=document.createElement("i");dot.style.background=assigned.get(name);
  item.append(dot,document.createTextNode(name.replaceAll("_"," ")+" ("+fmt(items.length)+")"));legend.append(item)
 }
 renderCache.canvas=layer;renderCache.dirty=false
}
function drawCells(){
 preparePlotCanvas();
 if(renderCache.dirty)buildRenderCache();
 if(renderCache.scheduled)return;
 renderCache.scheduled=true;
 requestAnimationFrame(()=>{
  renderCache.scheduled=false;
  const cv=$("umap"),dpr=preparePlotCanvas(),ctx=cv.getContext("2d");
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
  if(!renderCache.canvas)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.translate(PLOT_WIDTH/2+state.offsetX,PLOT_HEIGHT/2+state.offsetY);
  ctx.scale(state.zoom,state.zoom);
  ctx.drawImage(renderCache.canvas,0,0,renderCache.canvas.width,renderCache.canvas.height,-PLOT_WIDTH/2,-PLOT_HEIGHT/2,PLOT_WIDTH,PLOT_HEIGHT);
  ctx.setTransform(1,0,0,1,0,0)
 })
}
function addPlotInteractions(){
 const cv=$("umap");let drag=null;
 cv.addEventListener("wheel",e=>{if(!state.cells.length)return;e.preventDefault();const multiplier=e.deltaY<0?1.2:1/1.2;state.zoom=Math.max(.5,Math.min(15,state.zoom*multiplier));drawCells()},{passive:false});
 cv.addEventListener("pointerdown",e=>{if(!state.cells.length)return;drag={x:e.clientX,y:e.clientY};cv.setPointerCapture(e.pointerId)});
 cv.addEventListener("pointermove",e=>{if(!drag)return;const rect=cv.getBoundingClientRect();state.offsetX+=(e.clientX-drag.x)*PLOT_WIDTH/rect.width;state.offsetY+=(e.clientY-drag.y)*PLOT_HEIGHT/rect.height;drag={x:e.clientX,y:e.clientY};drawCells()});
 cv.addEventListener("pointerup",()=>{drag=null});cv.addEventListener("pointercancel",()=>{drag=null});
 function resetPlot(){state.zoom=1;state.offsetX=0;state.offsetY=0;drawCells()}
 function zoomPlot(multiplier){if(!state.cells.length)return;state.zoom=Math.max(.5,Math.min(15,state.zoom*multiplier));drawCells()}
 $("resetview").addEventListener("click",resetPlot);
 $("zoomin").addEventListener("click",()=>zoomPlot(1.2));
 $("zoomout").addEventListener("click",()=>zoomPlot(1/1.2));
 cv.addEventListener("keydown",event=>{
  if(!state.cells.length)return;
  const step=26;
  if(event.key==="ArrowLeft")state.offsetX+=step;
  else if(event.key==="ArrowRight")state.offsetX-=step;
  else if(event.key==="ArrowUp")state.offsetY+=step;
  else if(event.key==="ArrowDown")state.offsetY-=step;
  else if(event.key==="+"||event.key==="=")zoomPlot(1.2);
  else if(event.key==="-"||event.key==="_")zoomPlot(1/1.2);
  else if(event.key==="Home")resetPlot();
  else return;
  event.preventDefault();drawCells()
 });
 window.addEventListener("resize",()=>{renderCache.dirty=true;drawCells()})
}
function drawComposition(){const data=new Map();for(const c of state.visible)data.set(c.tissue,(data.get(c.tissue)||0)+1);const box=$("composition");box.replaceChildren();const max=Math.max(1,...data.values());for(const [name,n] of [...data].sort((a,b)=>b[1]-a[1])){const row=document.createElement("div");row.className="bar";const l=document.createElement("label");l.textContent=name.replaceAll("_"," ");const track=document.createElement("div");track.className="track";const fill=document.createElement("div");fill.className="fill";fill.style.width=100*n/max+"%";fill.style.backgroundColor=tissueColor(name);track.append(fill);const val=document.createElement("span");val.textContent=fmt(n);row.append(l,track,val);box.append(row)}}
async function loadMarker(){
 state.marker=$("marker").value;
 state.peaks=[];state.matched=[];state.page=0;drawPeaks();
 $("status").textContent="Loading public BED file…";$("download").disabled=true;
 const url=markerBase+encodeURIComponent(state.marker+"_markers.bed");
 try{
  const res=await fetch(url);if(!res.ok)throw Error("HTTP "+res.status);
  const parsed=AtlasRegions.parseBed(await res.text());
  if(parsed.rejected)throw Error(parsed.rejected+" malformed intervals in the published BED file");
  state.peaks=parsed.rows;
  $("chr").replaceChildren();opt($("chr"),"","All chromosomes");
  [...new Set(state.peaks.map(p=>p[0]))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).forEach(c=>opt($("chr"),c));
  filterPeaks()
 }catch(e){
  state.peaks=[];state.matched=[];state.page=0;drawPeaks();$("download").disabled=true;
  $("status").replaceChildren();$("status").append("Could not load BED directly ("+e.message+"). ");
  const a=document.createElement("a");a.href=url;a.target="_blank";
  a.rel="noopener noreferrer";a.textContent="Open original file ↗";$("status").append(a)
 }
}
function filterPeaks(){const chr=$("chr").value,query=$("interval").value.trim();let interval=null;if(query){const m=/^(chr[\w]+):(\d+)-(\d+)$/.exec(query.replaceAll(",",""));if(!m||+m[3]<=+m[2]){state.matched=[];state.page=0;drawPeaks();$("download").disabled=true;$("status").textContent="Enter mm10 coordinates as chr6:41000000-42000000";return}interval=[m[1],+m[2],+m[3]]}state.matched=state.peaks.filter(p=>(!chr||p[0]===chr)&&(!interval||(p[0]===interval[0]&&+p[1]<interval[2]&&+p[2]>interval[1])));state.page=0;drawPeaks();$("status").textContent=fmt(state.matched.length)+" matching intervals of "+fmt(state.peaks.length)+" published marker peaks.";$("download").disabled=!state.matched.length}
function drawPeaks(){
 const body=$("peaks");body.replaceChildren();
 const limit=15,start=state.page*limit;
 for(const p of state.matched.slice(start,start+limit)){
  const tr=document.createElement("tr");
  for(const value of [...p,p[2]-p[1]]){const td=document.createElement("td");td.textContent=value;tr.append(td)}
  const td=document.createElement("td"),link=document.createElement("a");
  link.href=AtlasRegions.ucscUrl(p);link.target="_blank";link.rel="noopener noreferrer";
  link.textContent="View ↗";link.title="Open this BED interval in UCSC mm10 (1-based display)";
  td.append(link);tr.append(td);body.append(tr)
 }
 if(!state.matched.length){const row=document.createElement("tr"),td=document.createElement("td");td.colSpan=5;td.textContent="No intervals available for this selection";row.append(td);body.append(row)}
 const stats=$("region-stats");stats.replaceChildren();
 if(state.peaks.length&&state.matched.length){
  const median=AtlasRegions.medianLength(state.matched);
  const summaries=[
   ["Selected peaks",fmt(state.matched.length)],
   ["Nonredundant span",fmt(AtlasRegions.unionCoverageBp(state.matched))+" bp"],
   ["Median peak width",fmt(median)+" bp"]
  ];
  for(const [label,value] of summaries){
   const item=document.createElement("span");item.className="region-stat";
   const bold=document.createElement("strong");bold.textContent=value;
   item.append(bold,document.createTextNode(" "+label));stats.append(item)
  }
 }
 $("prev").disabled=state.page===0;$("next").disabled=start+limit>=state.matched.length;
 $("page").textContent=state.matched.length?(start+1)+"–"+Math.min(start+limit,state.matched.length)+" of "+fmt(state.matched.length):"0 peaks"
}

const markerCache=new Map();
let comparison=null;
async function fetchMarker(name){
 if(markerCache.has(name))return markerCache.get(name);
 const response=await fetch(markerBase+encodeURIComponent(name+"_markers.bed"));
 if(!response.ok)throw new Error("Published BED unavailable: HTTP "+response.status);
 const parsed=AtlasRegions.parseBed(await response.text());
 if(parsed.rejected>0)throw new Error(name+": "+parsed.rejected+" malformed BED rows; refusing comparison");
 markerCache.set(name,parsed.rows);
 return parsed.rows
}
function initComparisons(){
 for(const name of markerNames){opt($("compare-a"),name);opt($("compare-b"),name)}
 $("compare-a").value="Fibroblasts";$("compare-b").value="Endothelial Cells";
 $("compare-run").addEventListener("click",async()=>{
  const a=$("compare-a").value,b=$("compare-b").value,btn=$("compare-run");
  $("compare-exports").hidden=true;$("compare-summary").replaceChildren();comparison=null;
  if(a===b){$("compare-status").textContent="Please choose two different cell types.";return}
  btn.disabled=true;$("compare-status").textContent="Loading published BED intervals…";
  try{
   const [aRows,bRows]=await Promise.all([fetchMarker(a),fetchMarker(b)]);
   comparison=AtlasRegions.compare(aRows,bRows);
   const c=comparison;
   $("compare-status").textContent="Comparison complete. Exact coordinates from published mm10 marker BED files.";
   const table=document.createElement("table");
   const head=document.createElement("tr");
   for(const label of ["Region category","Count"]){const th=document.createElement("th");th.textContent=label;head.append(th)}
   table.append(head);
   for(const [label,n] of [
     [a+" marker peaks",c.aTotal],[b+" marker peaks",c.bTotal],
     [a+" peaks overlapping ≥1 "+b+" peak",c.aOverlap.length],
     [a+" peaks without overlap",c.aOnly.length],
     [b+" peaks overlapping ≥1 "+a+" peak",c.bOverlap.length],
     [b+" peaks without overlap",c.bOnly.length]
   ]){const tr=document.createElement("tr");for(const v of [label,n]){const td=document.createElement("td");td.textContent=typeof v==="number"?fmt(v):v;tr.append(td)}table.append(tr)}
   $("compare-summary").append(table);
   const ratios=document.createElement("p");ratios.className="hint";
   const fraction=(n,total)=>total?(100*n/total).toFixed(1)+"%":"N/A (empty set)";
   ratios.textContent="Directional overlap: "+fraction(c.aOverlap.length,c.aTotal)+" of "+a+" input peaks overlap at least one "+b+" peak; "+
     fraction(c.bOverlap.length,c.bTotal)+" of "+b+" input peaks overlap at least one "+a+" peak. Percentages use each population's own peak count as denominator.";
   $("compare-summary").append(ratios);
   const note=document.createElement("p");note.className="hint";note.textContent="Because each peak set has its own interval boundaries, A-overlap and B-overlap counts need not match. A zero-byte file means no published markers are present in that file, not proof of biological absence.";$("compare-summary").append(note);
   $("compare-exports").hidden=false;
  }catch(error){$("compare-status").textContent="Comparison unavailable: "+error.message}
  finally{btn.disabled=false}
 });
 $("compare-download").addEventListener("click",()=>{
  if(!comparison)return;
  const group=$("compare-set").value;
  if(!["aOverlap","aOnly","bOverlap","bOnly"].includes(group))return;
  const filename="mouse_marker_"+group+".bed";
  download(AtlasRegions.bedText(comparison[group]),filename,"text/plain")
 })
}
// Phase 1E: progressive local atlas loading; does not contact an external server.
async function loadBundledAtlas(){
 const note=$("plotnote");
 try{
  const response=await fetch("data/cells.csv",{cache:"no-store"});
  if(!response.ok)throw Error("HTTP "+response.status);
  const rows=parseCsv(await response.text());
  // A manually selected file takes precedence if the fetch resolves later.
  if($("file").files && $("file").files.length)return;
  activate(rows);
  geneActivity.canonical=true;updateGeneTissues();if(geneActivity.index)loadGene($("gene-select").value);metacellState.canonical=true;updateMetacellAvailability();
  note.textContent="Validated mouse scATAC dataset: "+fmt(rows.length)+" cells with source-derived UMAP coordinates and cell-type annotations. Gene activity is ATAC-derived, not RNA expression.";
 }catch(err){
  note.textContent="Bundled cell data unavailable ("+err.message+"). Select a local validated CSV above to explore cells.";
 }
}

const geneActivity={index:null,values:null,gene:null,tissue:"",cache:new Map(),serial:0,canonical:false};
function initGeneActivity(){
 const select=$("gene-select"),tissue=$("gene-tissue");
 select.addEventListener("change",()=>loadGene(select.value));
 tissue.addEventListener("change",()=>{geneActivity.tissue=tissue.value;renderGeneUMAP()});
 $("gene-reset").addEventListener("click",()=>{tissue.value="";geneActivity.tissue="";renderGeneUMAP()});
 $("gene-export").addEventListener("click",()=>{
  if(!geneActivity.values||!geneActivity.canonical||!geneActivity.gene)return;
  const indices=state.cells.map((c,i)=>i).filter(i=>!geneActivity.tissue||state.cells[i].tissue===geneActivity.tissue);
  const text="cell_id,Sample,Clusters50,CellType,gene,archr_gene_score\n"+
   indices.map(i=>[state.cells[i].id,state.cells[i].tissue,state.cells[i].cluster,
    state.cells[i].type==="Unassigned"?"NA":state.cells[i].type,geneActivity.gene,
    geneActivity.values[i]===null?"":geneActivity.values[i]].map(safeCsv).join(",")).join("\n");
  download(text,"mouse_atac_"+geneActivity.gene+"_gene_scores.csv","text/csv")
 });
 fetch("data/gene_activity/index.json",{cache:"no-store"}).then(r=>{
  if(!r.ok)throw Error("Gene activity index unavailable (HTTP "+r.status+")");
  return r.json()
 }).then(index=>{
  if(index.schema!=="atlas-gene-activity-index-v1"||index.cells!==48385||!index.genes||
     !Object.keys(index.genes).length)throw Error("Invalid gene-score index");
  geneActivity.index=index;select.replaceChildren();
  for(const gene of Object.keys(index.genes).sort())opt(select,gene);
  select.disabled=false;
  updateGeneTissues();
  if(geneActivity.canonical)loadGene(select.value);
  else $("gene-status").textContent="Gene metadata ready; waiting for validated bundled cell UMAP.";
 }).catch(error=>{$("gene-status").textContent="Gene activity unavailable: "+error.message})
}
function updateGeneTissues(){
 const el=$("gene-tissue");const previous=el.value;
 el.replaceChildren();opt(el,"","All tissues");
 if(geneActivity.canonical){
  for(const tissue of [...new Set(state.cells.map(c=>c.tissue))].sort())
   opt(el,tissue,tissue.replaceAll("_"," "))
 }
 el.value=[...el.options].some(o=>o.value===previous)?previous:"";
 geneActivity.tissue=el.value
}
async function loadGene(gene){
 const id=++geneActivity.serial;
 geneActivity.values=null;geneActivity.gene=null;
 $("gene-export").disabled=true;renderGeneUMAP();
 if(!geneActivity.canonical||!geneActivity.index){
  $("gene-status").textContent="Load the bundled 48,385-cell atlas to view its aligned gene activity.";
  return
 }
 if(!Object.prototype.hasOwnProperty.call(geneActivity.index.genes,gene))return;
 $("gene-status").textContent="Loading "+gene+" gene activity…";
 try{
  let values=geneActivity.cache.get(gene);
  if(!values){
   const response=await fetch("data/gene_activity/"+encodeURIComponent(gene)+".json");
   if(!response.ok)throw Error("Source gene-activity file unavailable (HTTP "+response.status+").");
   const data=await response.json();
   if(data.gene!==gene||!Array.isArray(data.values)||data.values.length!==state.cells.length)
    throw Error("Gene payload is inconsistent with the atlas cell count");
   if(data.values.some(v=>v!==null&&(!Number.isFinite(v)||v<0)))
    throw Error("Invalid gene activity values");
   values=data.values;geneActivity.cache.set(gene,values)
  }
  if(id!==geneActivity.serial||!geneActivity.canonical)return;
  geneActivity.values=values;geneActivity.gene=gene;
  $("gene-export").disabled=false;
  const nonzero=values.filter(v=>v!==null&&v>0).length;
  $("gene-status").textContent=gene+": "+fmt(values.length)+" atlas cells; "+fmt(nonzero)+" with a positive score. Source values unchanged.";
  renderGeneUMAP()
 }catch(error){
  if(id!==geneActivity.serial)return;
  $("gene-status").textContent="Gene activity unavailable: "+error.message
 }
}
function renderGeneUMAP(){
 const cv=$("gene-umap");
 const dpr=Math.min(3,Math.max(1,window.devicePixelRatio||1));
 if(cv.width!==Math.round(850*dpr)||cv.height!==Math.round(570*dpr)){
  cv.width=Math.round(850*dpr);cv.height=Math.round(570*dpr)
 }
 const ctx=cv.getContext("2d");ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
 if(!geneActivity.values||!state.bounds||!geneActivity.canonical){$("gene-scale-max").textContent="High score";return}
 const values=geneActivity.values;
 const positive=values.filter(v=>v!==null&&v>0).sort((a,b)=>a-b);
 const cutoff=positive.length?Math.max(0.001,positive[Math.min(positive.length-1,Math.floor(positive.length*.99))]):1;
 $("gene-scale-max").textContent="≥"+cutoff.toFixed(2);
 $("gene-description").textContent="Color range: 0 to "+cutoff.toFixed(3)+" (99th percentile of positive "+geneActivity.gene+" scores); values above the cap share the darkest color. This visual cap does not change downloaded data.";
 const {minX,maxX,minY,maxY}=state.bounds,dx=maxX-minX||1,dy=maxY-minY||1;
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const visible=state.cells.map((c,i)=>i).filter(i=>!geneActivity.tissue||state.cells[i].tissue===geneActivity.tissue);
 // Paint zero/missing cells first so nonzero activity remains visually detectable.
 for(let pass=0;pass<2;pass++){
  for(const i of visible){
   const v=values[i],positivePoint=v!==null&&v>0;
   if(pass===0?positivePoint:!positivePoint)continue;
   const cell=state.cells[i];
   const x=25+(cell.x-minX)/dx*800,y=545-(cell.y-minY)/dy*520;
   if(!positivePoint)ctx.fillStyle="#e6ebf0";
   else {
    const t=Math.sqrt(Math.min(1,v/cutoff));
    const r=Math.round(185+(4-185)*t),g=Math.round(222+(75-222)*t),b=Math.round(252+(157-252)*t);
    ctx.fillStyle="rgb("+r+","+g+","+b+")"
   }
   ctx.fillRect(x,y,positivePoint?2.1:1.5,positivePoint?2.1:1.5)
  }
 }
 ctx.setTransform(1,0,0,1,0,0)
}


const metacellState={canonical:false,groups:[],byId:null,pending:null,ready:false};
function updateMetacellAvailability(){
 const option=[...$("color").options].find(x=>x.value==="SEACell");
 option.disabled=!(metacellState.canonical&&metacellState.groups.length===90);
 if(!metacellState.canonical){
  if($("color").value==="SEACell"){$("color").value="Tissue";invalidateRender()}
  $("metacell-panel").hidden=true;$("metacell-filter").hidden=true;
  $("metacell-export").disabled=true
 }
}
function initMetacells(){
 const sel=$("seacell-select");
 sel.addEventListener("change",async()=>{
  if(!metacellState.canonical)return;
  $("color").value="SEACell";
  await onAtlasColorChange()
 });
 $("metacell-export").addEventListener("click",()=>{
  if(!metacellState.ready||!metacellState.canonical)return;
  const group=sel.value;
  const rows=state.cells.filter(c=>metacellState.byId.get(c.id)===group);
  const csv="cell_id,Sample,Clusters50,CellType,umap_1,umap_2,SEACell\n"+
   rows.map(c=>[c.id,c.tissue,c.cluster,c.type==="Unassigned"?"NA":c.type,c.x,c.y,group].map(safeCsv).join(",")).join("\n");
  download(csv,"mouse_atac_"+group+"_cells.csv","text/csv")
 });
 fetch("data/seacell_groups.csv",{cache:"no-store"}).then(async r=>{
  if(!r.ok)throw Error("Missing SEACell group summary (HTTP "+r.status+")");
  const rows=csvRows(await r.text());const header=rows.shift();
  if(header.join(",")!=="seacell,n_cells,n_tissues,n_celltypes"||rows.length!==90)
   throw Error("SEACell group summary schema unexpected");
  const groups=rows.map(x=>({id:x[0],n:+x[1],t:+x[2],types:+x[3]}));
  if(groups.some(x=>!/^SEACell-\d+$/.test(x.id)||!Number.isSafeInteger(x.n)||x.n<=0))
   throw Error("SEACell group summary contains invalid counts");
  metacellState.groups=groups;sel.replaceChildren();
  for(const g of groups)opt(sel,g.id,g.id+" ("+fmt(g.n)+" cells)");
  sel.disabled=false;updateMetacellAvailability()
 }).catch(e=>{sel.replaceChildren();opt(sel,"","SEACell data unavailable");
  $("metacell-status").textContent="Metacell data unavailable: "+e.message})
}
async function loadMetacellAssignments(){
 if(metacellState.ready)return;
 if(metacellState.pending)return metacellState.pending;
 metacellState.pending=(async()=>{
  const response=await fetch("data/seacell_assignments.csv",{cache:"no-store"});
  if(!response.ok)throw Error("SEACell mapping unavailable (HTTP "+response.status+")");
  const rows=csvRows(await response.text()),header=rows.shift();
  if(header.join(",")!=="cell_id,seacell"||rows.length!==48385)
   throw Error("SEACell mapping schema or number of records invalid");
  const map=new Map();
  for(const [id,sc] of rows){
   if(!id||map.has(id)||!/^SEACell-\d+$/.test(sc))throw Error("Invalid or duplicate SEACell cell identifier");
   map.set(id,sc)
  }
  if(!metacellState.canonical||state.cells.length!==48385||
    state.cells.some(c=>!map.has(c.id)))throw Error("SEACell mapping is not aligned with bundled atlas IDs");
  metacellState.byId=map;metacellState.ready=true
 })().finally(()=>{metacellState.pending=null});
 return metacellState.pending
}
async function onAtlasColorChange(){
 if($("color").value==="SEACell"){
  $("metacell-panel").hidden=false;$("metacell-filter").hidden=false;
  $("metacell-status").textContent="Loading the precomputed SEACell assignments…";
  try{await loadMetacellAssignments();drawMetacellComposition()}
  catch(error){$("metacell-status").textContent="SEACell unavailable: "+error.message;
   $("color").value="Tissue";$("metacell-export").disabled=true;invalidateRender();return}
 }else{$("metacell-panel").hidden=true;$("metacell-filter").hidden=true}
 invalidateRender()
}
function renderMetacellLayer(ctx,legend,minX,maxX,minY,maxY){
 legend.replaceChildren();
 const group=$("seacell-select").value,dx=maxX-minX||1,dy=maxY-minY||1;
 const visible=state.visible;
 for(let pass=0;pass<2;pass++){
  ctx.fillStyle=pass===0?"#dce5ee":"#0471ce";
  for(const c of visible){
   const chosen=metacellState.byId.get(c.id)===group;
   if(pass===0?chosen:!chosen)continue;
   ctx.fillRect(25+(c.x-minX)/dx*800,545-(c.y-minY)/dy*520,chosen?2.6:1.5,chosen?2.6:1.5)
  }
 }
 for(const [name,color] of [[group,"#0471ce"],["Other cells","#dce5ee"]]){
  const item=document.createElement("span");item.className="legend-item";
  const dot=document.createElement("i");dot.style.background=color;
  item.append(dot,document.createTextNode(name));legend.append(item)
 }
}
function renderMetacellBars(id,counts,total){
 const container=$(id);container.replaceChildren();
 const sorted=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 for(const [name,n] of sorted){
  const row=document.createElement("div");row.className="bar";
  const l=document.createElement("label");l.textContent=name;
  const track=document.createElement("div");track.className="track";
  const fill=document.createElement("div");fill.className="fill";fill.style.width=(100*n/total)+"%";
  if(id==="metacell-tissues")fill.style.backgroundColor=tissueColor(name);
  track.append(fill);
  const val=document.createElement("span");val.textContent=fmt(n)+" ("+(100*n/total).toFixed(1)+"%)";
  row.append(l,track,val);container.append(row)
 }
}
function drawMetacellComposition(){
 if(!metacellState.ready||!metacellState.canonical||$("color").value!=="SEACell")return;
 const id=$("seacell-select").value;
 const tissues=new Map(),types=new Map();let count=0;
 for(const c of state.cells){
  if(metacellState.byId.get(c.id)!==id)continue;
  count++;tissues.set(c.tissue,(tissues.get(c.tissue)||0)+1);
  types.set(c.type,(types.get(c.type)||0)+1)
 }
 const reference=metacellState.groups.find(g=>g.id===id);
 if(!reference||reference.n!==count){
  $("metacell-status").textContent="SEACell composition count does not match validated source";
  $("metacell-export").disabled=true;return
 }
 $("metacell-status").textContent=id+": "+fmt(count)+" cells across "+
  tissues.size+" tissues and "+types.size+
  " annotated cell types. Descriptive group membership, not proof of cell-type purity; composition includes all group cells, independent of the atlas filters.";
 renderMetacellBars("metacell-tissues",tissues,count);
 renderMetacellBars("metacell-types",types,count);
 $("metacell-export").disabled=false
}

init();addPlotInteractions();initComparisons();initGeneActivity();initMetacells();loadBundledAtlas();