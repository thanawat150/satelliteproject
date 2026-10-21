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
  if(count!==19||svgs!==5)throw Error("The poster must have 19 rows and exactly 5 georeferenced PDD vector overlays: "+count+" "+svgs);
  const provenance=await page.evaluate(async()=>{
    const imgData=await (await fetch("../data/full_preview_part_2.json",{cache:"no-store"})).json();
    const geometry=await (await fetch("../data/boundaries.geojson",{cache:"no-store"})).json();
    const sourceGeometry=geometry.features.filter(f=>f.properties?.plot==="14-VSD");
    const expectedRings=sourceGeometry.flatMap(f=>f.geometry.type==="MultiPolygon"?f.geometry.coordinates.flatMap(poly=>poly):f.geometry.coordinates);
    const images=[...document.querySelectorAll(".scene-photo img")];
    const originals=images.map(img=>{
      const record=imgData.layers.find(x=>x.plot==="14-VSD"&&x.date===img.dataset.date&&x.mode===img.dataset.mode);
      const style=getComputedStyle(img);
      return{date:img.dataset.date,mode:img.dataset.mode,
        matchesSource:img.src===record?.src,
        exactDimensions:img.naturalWidth===record?.width&&img.naturalHeight===record?.height,
        styleUnmodified:style.filter==="none"&&style.objectFit==="contain"&&style.mixBlendMode==="normal",
        overlay:{
          tag:img.parentElement.querySelector("svg.pdd-overlay")?.tagName,
          source:img.parentElement.querySelector("svg.pdd-overlay")?.dataset.source,
          pddPlot:img.parentElement.querySelector("svg.pdd-overlay")?.dataset.plot,
          preserve:img.parentElement.querySelector("svg.pdd-overlay")?.getAttribute("preserveAspectRatio"),
          w:img.parentElement.querySelector("svg.pdd-overlay")?.viewBox.baseVal.width,
          h:img.parentElement.querySelector("svg.pdd-overlay")?.viewBox.baseVal.height,
          polygonCount:img.parentElement.querySelectorAll("svg.pdd-overlay .pdd-line polygon").length,
          haloCount:img.parentElement.querySelectorAll("svg.pdd-overlay .pdd-halo polygon").length,
          canvasCount:img.parentElement.querySelectorAll("canvas").length,
          matchingCoordinates:[...img.parentElement.querySelectorAll("svg.pdd-overlay .pdd-line polygon")].every((poly,i)=>{
            const ring=expectedRings[i];
            if(!ring)return false;
            const minLat=record.bounds[0][0],maxLat=record.bounds[1][0];
            const minLon=record.bounds[0][1],maxLon=record.bounds[1][1];
            const projected=ring.map(([lon,lat])=>(((lon-minLon)/(maxLon-minLon))*record.width).toFixed(3)+","+
               (((maxLat-lat)/(maxLat-minLat))*record.height).toFixed(3)).join(" ");
            return poly.getAttribute("points")===projected;
          })
        }};
    });
    return originals;
  });
  if(provenance.length!==5||provenance.some(x=>!x.matchesSource||!x.exactDimensions||!x.styleUnmodified||
       x.overlay.source!=="boundaries.geojson"||x.overlay.pddPlot!=="14-VSD"||
       x.overlay.preserve!=="xMidYMid meet"||x.overlay.w<=0||x.overlay.h<=0||
       x.overlay.polygonCount!==3||x.overlay.haloCount!==3||x.overlay.canvasCount!==0||
       !x.overlay.matchingCoordinates))
   throw Error("Original satellite identity or GIS PDD overlay alignment failed: "+JSON.stringify(provenance));
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
  console.log("PASS original satellite bytes 5/5 with matching GIS PDD vectors 5/5, 19 plots, PDF pages 1",
   {qa,pngBytes:fs.statSync(dest+".png").size,pdfBytes:fs.statSync(dest+".pdf").size});
 }catch(e){fs.writeFileSync("docs/reports/real_satellite_infographic_build_error.txt",String(e.stack||e));throw e}
 finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
