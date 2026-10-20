const {chromium}=require("playwright");
const fs=require("node:fs");
const cp=require("node:child_process");
(async()=>{
 const browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const dest="docs/reports/Rayong_Real_Satellite_Infographic_2026";
 try{
  const page=await browser.newPage({viewport:{width:1650,height:1160},deviceScaleFactor:1,locale:"th-TH"});
  const errs=[];
  page.on("pageerror",e=>errs.push(e.stack));
  page.on("console",x=>{if(x.type()==="error")errs.push(x.text())});
  await page.goto("http://127.0.0.1:8765/reports/Rayong_Real_Satellite_Infographic_2026.html",
   {waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>document.body.dataset.ready==="yes"||document.body.dataset.error,null,{timeout:30000});
  const err=await page.evaluate(()=>document.body.dataset.error);
  if(err)throw Error("Report HTML error: "+err+" "+errs.join(";"));
  const qa=await page.evaluate(()=>window.__QA__);
  if(qa.plots!==19||qa.valid!==17||qa.missing!==2||qa.scenes!==5||qa.broken)
   throw Error("Source-data coverage issue "+JSON.stringify(qa));
  if(JSON.stringify(qa.categories)!==JSON.stringify([11,4,2,2]))
   throw Error("Unexpected actual water coverage levels "+JSON.stringify(qa));
  if(qa.gradeB!==9||qa.gradeC!==10)throw Error("Incorrect user-requested randomized grades "+JSON.stringify(qa));
  const count=await page.locator("table tbody tr").count();
  const svgs=await page.locator(".scene-photo svg").count();
  if(count!==19||svgs!==5)throw Error("Missing real GIS plot rows or polygon boundaries: "+count+" "+svgs);
  await page.evaluate(()=>document.fonts.ready);
  const rect=await page.locator("#poster").evaluate(el=>({w:el.clientWidth,h:el.clientHeight,scrollW:el.scrollWidth,scrollH:el.scrollHeight}));
  if(rect.scrollW>rect.w+2||rect.scrollH>rect.h+2)throw Error("Infographic overflow "+JSON.stringify(rect));
  await page.locator("#poster").screenshot({path:dest+".png",timeout:30000,animations:"disabled"});
  await page.emulateMedia({media:"print"});
  await page.pdf({path:dest+".pdf",format:"A3",landscape:true,preferCSSPageSize:true,printBackground:true,
    margin:{top:"0",right:"0",bottom:"0",left:"0"},displayHeaderFooter:false});
  const info=cp.execFileSync("pdfinfo",[dest+".pdf"],{encoding:"utf8"});
  const pages=Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
  if(pages!==1)throw Error("Expected one PDF page, got "+pages);
  console.log("PASS real satellite 5/5, actual PDD outlines 5/5, plots 19, categories 11/4/2/2, PDF pages 1",
   {qa,pngBytes:fs.statSync(dest+".png").size,pdfBytes:fs.statSync(dest+".pdf").size});
 }catch(e){fs.writeFileSync("docs/reports/real_satellite_infographic_build_error.txt",String(e.stack||e));throw e}
 finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
