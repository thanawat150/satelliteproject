/* Real browser smoke-test for the public Rayong plot review workflow.
   Uses a fresh ephemeral browser profile; it does not edit a user's reviews. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async()=>{
 const base='https://thanawat150.github.io/satelliteproject/?tab=center&scope=plot&plot=13-STC&analysis=manual';
 let browser;const logs=[];
 try {
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'th-TH'});
  const page=await context.newPage();
  page.on('pageerror',e=>{logs.push('PAGE ERROR: '+e.message)});
  page.on('console',m=>{if(m.type()==='error')logs.push('CONSOLE ERROR: '+m.text().slice(0,180))});
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:70000});
  await page.locator('#mc-plot').waitFor({state:'attached',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('#mc-date-b')?.options?.length>1,{timeout:60000});
  const plot=await page.locator('#mc-plot').inputValue();
  assert.equal(plot,'13-STC');
  console.log('1/7 Site loaded, plot:',plot);
  await page.locator('#mc-preview-analysis').click();
  await page.locator('#mc-results').waitFor({state:'visible',timeout:60000});
  await page.locator('#mc-review-panel').waitFor({state:'visible',timeout:15000});
  console.log('2/7 Analysis preview visible');
  await page.locator('#mc-review-grade').selectOption('B');
  await page.locator('#mc-review-condition').selectOption('WATCH');
  await page.locator('#mc-review-note').fill('E2E smoke-test on a fresh browser; no effect on user account');
  await page.locator('#mc-review-save').click();
  await page.waitForFunction(()=>!document.querySelector('#mc-create-final')?.disabled,{timeout:10000});
  console.log('3/7 Manual review saved locally, Final enabled');
  await page.locator('#mc-create-final').click();
  await page.locator('#mc-final-stage').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.locator('.mcf-page').count(),2);
  assert.match(await page.locator('#mc-page-count').innerText(),/1\s*\/\s*2/);
  console.log('4/7 Two Final pages created');
  await page.waitForFunction(()=>{
    const a=document.querySelector('#mcr-true-scenes'),b=document.querySelector('#mcr-mndwi-scenes');
    return !!a&&!!b&&!a.querySelector('.mcr-images-loading')&&!b.querySelector('.mcr-images-loading');
  },{timeout:65000});
  const images=await page.locator('#mcr-true-scenes img, #mcr-mndwi-scenes img').count();
  const cover=await page.locator('.mcf-sat-backdrop').count();
  console.log('5/7 Satellite imagery: image count='+images+', satellite cover='+cover);
  assert(images>=2,'Real true-color and MNDWI previews expected');
  assert(cover>=1,'Satellite cover should exist');
  await page.locator('#mc-page-next').click();
  assert.match(await page.locator('#mc-page-count').innerText(),/2\s*\/\s*2/);
  assert.equal(await page.locator('.mcf-page[data-report-page="2"]').isVisible(),true);
  assert.equal(await page.locator('.mcf-page[data-report-page="1"]').isVisible(),false);
  assert.equal(await page.locator('#mc-page-prev').isEnabled(),true);
  assert.equal(await page.locator('#mc-page-next').isDisabled(),true);
  console.log('6/7 Next / previous navigation behaves correctly');
  const falseImages=await page.locator('#mcr-false-scenes img').count();
  const missing=await page.locator('.mcf-missing-layer').innerText();
  assert(falseImages>=1,'Real 8-4-3 preview expected');
  assert(missing.includes('11-8-4'),'Unavailable SWIR should be disclosed');
  await page.locator('#mc-page-prev').click();
  assert.match(await page.locator('#mc-page-count').innerText(),/1\s*\/\s*2/);
  console.log('7/7 Appendix image and return navigation passed');
  // Simulate the two print modes without triggering the OS print dialog.
  const printCss=await page.evaluate(()=>{
   const ss=[...document.styleSheets].flatMap(x=>{try{return [...x.cssRules]}catch{return[]}});
   return ss.filter(x=>x.cssText?.includes('mc-print-all')||x.cssText?.includes('mc-print-current')).length;
  });
  console.log('Print mode CSS blocks:',printCss);
  fs.mkdirSync('artifacts',{recursive:true});
  await page.locator('#mc-final-stage').screenshot({path:'artifacts/plot-final-e2e.png',animations:'disabled',timeout:25000});
  const critical=logs.filter(x=>/analysis-center|monitoring-report|plot-review|ReferenceError|TypeError/i.test(x));
  if(critical.length)console.log('Console diagnostic:',critical.slice(0,10));
  console.log('PASS: end-to-end plot preview → reviewer grade → create Final → next page → previous page');
 } catch(e){
  console.error('FAIL:',e.stack||String(e));
  console.error('Browser console:',logs.slice(-15).join('\n'));
  process.exitCode=1;
 } finally {await browser?.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
