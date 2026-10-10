/* AtlasGo UI smoke tests — actual desktop/mobile Chromium, mock no paid APIs. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async function(){
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  const errors=[];
  const page=await browser.newPage({viewport:{width:1365,height:900},deviceScaleFactor:1,locale:'th-TH'});
  page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:8877/ai-travel-companion/';
  try{
    let res=await page.goto(base,{waitUntil:'domcontentloaded'});
    assert.equal(res.status(),200,'App homepage should return HTTP 200');
    await page.locator('#startDate').waitFor();
    assert.equal(await page.locator('#tripForm').count(),1,'Planner form is present');
    assert(await page.locator('#startDate').inputValue(),'Default date was set');

    await page.getByRole('button',{name:/สร้างแผนเที่ยวอัตโนมัติ/}).click();
    await page.locator('.day-btn').first().waitFor();
    assert.equal(await page.locator('.day-btn').count(),5,'Five-day trip generated');
    assert(await page.locator('#screen').innerText().then(x=>x.includes('เชียงใหม่ → ชะอำ')));
    assert(await page.locator('#screen').innerText().then(x=>x.includes('หัวหิน')));

    await page.locator('[data-tab="budget"]').click();
    assert(await page.locator('#screen').innerText().then(x=>x.includes('งบประมาณการเดินทาง')));
    assert(await page.locator('#screen').innerText().then(x=>x.includes('แก๊สโซฮอล์ 95')));

    await page.locator('[data-tab="plan"]').click();
    await page.locator('#quickEdit').fill('ลดงบ 500');
    await page.locator('[data-action="revise"]').click();
    assert(await page.locator('#screen').innerText().then(x=>x.includes('฿2,500')),'Revision updates budget to 2,500');

    await page.locator('[data-action="save"]').click();
    await page.locator('[data-tab="saved"]').click();
    assert.equal(await page.locator('[data-action="loadSaved"]').count(),1,'Trip persisted in localStorage');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('[data-tab="saved"]').click();
    assert.equal(await page.locator('[data-action="loadSaved"]').count(),1,'Trip remains after refresh');
    await page.locator('[data-action="loadSaved"]').click();
    assert(await page.locator('#screen').innerText().then(x=>x.includes('เชียงใหม่ → ชะอำ')));

    await page.locator('[data-tab="explore"]').click();
    assert((await page.locator('.place').count())>2,'Explore has vetted places');
    await page.locator('[data-action="add"]').first().click();
    assert(await page.locator('#screen').innerText().then(x=>x.includes('DAY 1')),'Adding a stop returns to plan');

    await page.setViewportSize({width:390,height:844});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#tripForm').waitFor();
    assert(await page.locator('.bottom-nav').isVisible(),'Mobile navigation visible');
    const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert(mobileOverflow<=2,'No horizontal overflow on 390px mobile, got '+mobileOverflow);
    await page.locator('[data-mobile="explore"]').click();
    assert(await page.locator('#screen').innerText().then(x=>x.includes('ค้นพบที่เที่ยวทั่วไทย')),'Mobile tab navigates');
    await page.locator('[data-mobile="plan"]').click();

    await page.locator('#origin').fill('นครศรีธรรมราช');
    await page.locator('#destinations').fill('สุโขทัย');
    await page.locator('#endCity').fill('พิษณุโลก');
    await page.locator('#days').selectOption('2');
    await page.getByRole('button',{name:/สร้างแผนเที่ยวอัตโนมัติ/}).click();
    assert(await page.locator('#screen').innerText().then(x=>x.includes('ฐานข้อมูลรุ่นทดลอง')),'Unknown city shows explicit data limitation');
    assert(await page.locator('#screen').innerText().then(x=>x.includes('ยังไม่มีชุดสถานที่')),'No invented POI');
    assert.equal(errors.length,0,'Unexpected page errors: '+errors.join('; '));
    console.log('AtlasGo browser smoke tests passed — desktop planner, budget, saved trips, revision, explore, mobile, unsupported places');
  } finally {
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
