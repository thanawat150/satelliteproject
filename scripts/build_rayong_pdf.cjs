const {chromium}=require("playwright");
const fs=require("node:fs");
const cp=require("node:child_process");
(async function(){
 const address="http://127.0.0.1:8765/reports/Rayong_Plot_Assessment_2026.html";
 const out="docs/reports/Rayong_Plot_Assessment_2026.pdf";
 const browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:950},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push("PAGE ERROR: "+e.stack));
  page.on("console",msg=>{if(msg.type()==="error")errors.push("CONSOLE ERROR: "+msg.text())});
  page.on("response",res=>{if(res.status()>=400)errors.push("HTTP "+res.status()+" "+res.url())});
  await page.goto(address,{waitUntil:"domcontentloaded",timeout:40000});
  try{
   await page.waitForFunction(()=>document.body.dataset.reportReady==="true"||!!document.body.dataset.reportError,null,{timeout:20000});
  }catch(e){
   const state=await page.evaluate(()=>({status:document.querySelector("#status")?.innerText,bodyError:document.body.dataset.reportError,ready:document.body.dataset.reportReady,html:document.querySelector("#pages")?.innerText.slice(0,500),sources:[...document.querySelectorAll("script")].map(x=>x.src||"inline")}));
   throw Error("Page readiness timeout: "+JSON.stringify(state)+"; errors: "+JSON.stringify(errors.slice(0,15))+"; exception: "+e.message);
  }
  const error=await page.evaluate(()=>document.body.dataset.reportError);
  if(error)throw Error("Report render error: "+error);
  const stats=await page.evaluate(()=>window.__REPORT_READY__);
  if(stats?.plots!==19||stats.valid!==17||stats.missing!==2||stats.pages!==4)throw Error("Report consistency check failed: "+JSON.stringify(stats));
  if(stats.grades.B+stats.grades.C!==19)throw Error("Random draft grade counts do not sum to 19");
  const count=await page.locator(".sheet").count();if(count!==4)throw Error("Wrong report sheet count: "+count);
  const imageCounts=await page.evaluate(()=>{
   const layerBlocks=[...document.querySelectorAll(".image-matrix .image-cell")];
   return{cards:layerBlocks.length,real:layerBlocks.filter(x=>x.querySelector(".image-view img")).length,failed:layerBlocks.filter(x=>x.querySelector(".image-view img")&&!x.querySelector(".image-view img").naturalWidth).length};
  });
  if(imageCounts.cards!==9||imageCounts.real!==9||imageCounts.failed)throw Error("Main plot imagery is missing: "+JSON.stringify(imageCounts));
  const flag=await page.locator(".image-cell").last().locator(".flag").innerText();
  if(!flag.includes("INDEX_PENDING"))throw Error("07/10 is not flagged INDEX_PENDING");
  await page.evaluate(()=>document.fonts.ready);
  await page.emulateMedia({media:"print"});
  await page.pdf({path:out,format:"A4",printBackground:true,preferCSSPageSize:true,margin:{top:"0",bottom:"0",left:"0",right:"0"},displayHeaderFooter:false});
  const pdfInfo=cp.execFileSync("pdfinfo",[out],{encoding:"utf8"});
  const pages=Number(pdfInfo.match(/^Pages:\s*(\d+)/m)?.[1]);
  console.log("Report data checks:",stats);
  console.log("Main 14-VSD image checks:",imageCounts);
  console.log("Generated:",out,"bytes:",fs.statSync(out).size,"PDF pages:",pages);
  if(pages!==4)throw Error("A4 pagination overflow: expected 4 got "+pages);
  console.log("PASS: four-page full Rayong report has all 19 plots, 17 verified pairs, two exceptions and 14-VSD real 3-date imagery");
 }finally{await browser.close()}
})().catch(e=>{
 const failure=String(e.stack||e);
 console.error(failure);
 fs.writeFileSync("docs/reports/pdf_build_debug.txt",failure+"\n");
 process.exit(1);
});
