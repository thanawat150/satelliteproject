/* Raster-backed one-page A3 + A4 landscape trial, generated from the same HTML.
   Does not alter original two-page portrait report. */
const {chromium}=require("playwright");
const fs=require("node:fs");
const cp=require("node:child_process");
const path=require("node:path");
const root="docs/reports";
(async()=>{
 const browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  for(const paper of ["A3","A4"]){
   const page=await browser.newPage({viewport:{width:1660,height:1120},locale:"th-TH",deviceScaleFactor:1});
   const errors=[];page.on("pageerror",e=>errors.push(e.stack||e.message));
   page.on("console",x=>{if(x.type()==="error")errors.push(x.text())});
   await page.goto("http://127.0.0.1:8765/reports/Rayong_Plot_Assessment_Landscape_2026.html?paper="+paper,{
    waitUntil:"domcontentloaded",timeout:45000
   });
   try{
    await page.waitForFunction(()=>document.body.dataset.reportReady==="true"||document.body.dataset.reportError,null,{timeout:30000});
   }catch(e){
    const dom=await page.evaluate(()=>({status:document.querySelector("#status")?.innerText,error:document.body.dataset.reportError}));
    throw Error(paper+" readiness timeout: "+JSON.stringify(dom)+" "+JSON.stringify(errors.slice(0,5)));
   }
   const failure=await page.evaluate(()=>document.body.dataset.reportError);
   if(failure)throw Error(paper+" report JS: "+failure);
   const facts=await page.evaluate(()=>{
    const l=[...document.querySelectorAll(".rgb-pair .image-view img")];
    const w=[...document.querySelectorAll(".water-triple .image-view img")];
    return{stats:window.__REPORT_READY__,rgb:l.length,water:w.length,
     broken:[...l,...w].filter(x=>!x.complete||!x.naturalWidth).length,
     plotRows:document.querySelectorAll(".landscape-table tbody tr").length,
     exceptionRows:document.querySelectorAll(".exception").length,
     rawDates:[...document.querySelectorAll(".water-triple .ev-meta span:first-child")].map(x=>x.innerText),
     missingDisclaimer:document.querySelector(".evidence-warning")?.innerText||""};
   });
   if(facts.stats?.plots!==19||facts.stats.valid!==17||facts.stats.missing!==2||facts.stats.pages!==1)
    throw Error(paper+" data QA: "+JSON.stringify(facts.stats));
   if(facts.rgb!==2||facts.water!==3||facts.broken)
    throw Error(paper+" imagery QA: "+JSON.stringify(facts));
   if(facts.plotRows!==19||facts.exceptionRows!==2||facts.stats.grades.B+facts.stats.grades.C!==19)
    throw Error(paper+" completeness QA: "+JSON.stringify(facts));
   if(!facts.missingDisclaimer.includes("07/10"))
    throw Error(paper+" incomplete 07/10 disclosure missing");
   if(facts.rawDates.join("|")!=="03/08/2569|29/09/2569|07/10/2569")
    throw Error(paper+" actual MNDWI dates incorrect: "+facts.rawDates);
   await page.evaluate(()=>document.fonts.ready);
   const result=path.join(root,"Rayong_Plot_Assessment_Landscape_"+paper+"_2026.pdf");
   const screenshot=path.join(root,"Rayong_Plot_Assessment_Landscape_"+paper+"_2026.png");
   await page.locator(".sheet").screenshot({path:screenshot,timeout:30000,animations:"disabled"});
   await page.emulateMedia({media:"print"});
   await page.pdf({path:result,format:paper,landscape:true,printBackground:true,preferCSSPageSize:true,
    displayHeaderFooter:false,margin:{top:"0",right:"0",bottom:"0",left:"0"},timeout:60000});
   const info=cp.execFileSync("pdfinfo",[result],{encoding:"utf8"});
   const pdfPages=Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
   const pageSize=info.match(/^Page size:\s*(.+)$/m)?.[1];
   if(pdfPages!==1)throw Error(paper+" must be exactly 1 page; got "+pdfPages+" ("+pageSize+")");
   console.log("PASS "+paper+": pages="+pdfPages+", paper="+pageSize+", RGB="+facts.rgb+", MNDWI="+facts.water+
    ", plotted="+facts.plotRows+", incomplete="+facts.exceptionRows+", bytes="+fs.statSync(result).size);
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{
 const msg=String(e.stack||e);
 fs.writeFileSync(path.join(root,"landscape_build_debug.txt"),msg+"\n");
 console.error(msg);process.exit(1);
});
