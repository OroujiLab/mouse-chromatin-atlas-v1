/* Published mouse scATAC marker BED interval helpers.
 * Coordinate overlap in mm10; NOT statistical differential accessibility.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 else root.AtlasRegions=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const validChr=/^chr(?:[0-9]+|X|Y|M|MT)$/i;
 function parseBed(text){
  if(typeof text!=="string")throw new TypeError("BED input must be text");
  const rows=[];let rejected=0;
  for(const line of text.split(/\r?\n/)){
   const clean=line.trim();
   if(!clean||/^(#|track\b|browser\b)/i.test(clean))continue;
   const fields=clean.split(/\s+/);
   const start=Number(fields[1]),end=Number(fields[2]);
   if(fields.length<3||!validChr.test(fields[0])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start){rejected++;continue}
   rows.push([fields[0],start,end])
  }
  return {rows,rejected}
 }
 function makeIndex(rows){
  const groups=new Map();
  for(const row of rows){
   if(!groups.has(row[0]))groups.set(row[0],[]);
   groups.get(row[0]).push(row)
  }
  const out=new Map();
  for(const [chrom,list] of groups){
   list.sort((a,b)=>a[1]-b[1]||a[2]-b[2]);
   const starts=[],maxEnd=[];let max=-1;
   for(const [,start,end] of list){starts.push(start);max=Math.max(max,end);maxEnd.push(max)}
   out.set(chrom,{starts,maxEnd})
  }
  return out
 }
 function overlapsAny(row,index){
  const list=index.get(row[0]);if(!list)return false;
  const {starts,maxEnd}=list;let low=0,high=starts.length;
  while(low<high){const mid=Math.floor((low+high)/2);if(starts[mid]<row[2])low=mid+1;else high=mid}
  return low>0&&maxEnd[low-1]>row[1]
 }
 function compare(a,b){
  if(!Array.isArray(a)||!Array.isArray(b))throw new TypeError("Expected two arrays of BED rows");
  const ai=makeIndex(a),bi=makeIndex(b);
  const aOverlap=[],aOnly=[],bOverlap=[],bOnly=[];
  for(const row of a)(overlapsAny(row,bi)?aOverlap:aOnly).push(row);
  for(const row of b)(overlapsAny(row,ai)?bOverlap:bOnly).push(row);
  return {aOverlap,aOnly,bOverlap,bOnly,aTotal:a.length,bTotal:b.length}
 }
 function unionCoverageBp(rows){
  const groups=new Map();
  for(const [chrom,start,end] of rows){
   if(!groups.has(chrom))groups.set(chrom,[]);
   groups.get(chrom).push([start,end])
  }
  let covered=0;
  for(const intervals of groups.values()){
   intervals.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
   let start=null,end=null;
   for(const [a,b] of intervals){
    if(start===null){start=a;end=b}
    else if(a<=end){end=Math.max(end,b)}
    else {covered+=end-start;start=a;end=b}
   }
   if(start!==null)covered+=end-start
  }
  return covered
 }
 function medianLength(rows){
  if(!rows.length)return null;
  const lengths=rows.map(row=>row[2]-row[1]).sort((a,b)=>a-b);
  const middle=Math.floor(lengths.length/2);
  return lengths.length%2?lengths[middle]:(lengths[middle-1]+lengths[middle])/2
 }
 function ucscUrl(row){
  const [chrom,start,end]=row;
  if(!validChr.test(chrom)||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start)
   throw new Error("Invalid 0-based BED coordinates for UCSC link");
  return "https://genome.ucsc.edu/cgi-bin/hgTracks?db=mm10&position="+encodeURIComponent(chrom+":"+(start+1)+"-"+end)
 }
 function bedText(rows){return rows.map(r=>r.slice(0,3).join("\t")).join("\n")+(rows.length?"\n":"")}
 return {parseBed,compare,bedText,overlapsAny,makeIndex,unionCoverageBp,medianLength,ucscUrl}
});
