/* Rayong B+ experimental water status: strict QA, <=30 day comparisons and persistence.
 * SINGLE SOURCE of trial thresholds. Status is computed at runtime from analysis_history.json,
 * never trusted from static plots.json. No tide correction or flood-damage claims.
 */
(function(root){
"use strict";
const EXPERIMENTAL_MAX_BASELINE_DAYS=30;
const TRIAL={maxDays:EXPERIMENTAL_MAX_BASELINE_DAYS,minRiseRai:5,minRiseFraction:.05};
const STATUS_META={
 HIGH:{label:"น้ำเพิ่มต่อเนื่อง—ตรวจสอบเร่งด่วน",color:"#fb5a5a",description:"พบการเพิ่มขึ้นถึงเกณฑ์ต่อเนื่อง 2 รอบภาพที่ผ่าน QA; ยังไม่ยืนยันว่าน้ำท่วม"},
 WATCH:{label:"เฝ้าระวัง",color:"#f59e0b",description:"พบการเพิ่มขึ้นในคู่ภาพล่าสุดภายในช่วงทดลอง รอภาพที่ผ่าน QA รอบใหม่"},
 NORMAL:{label:"ปกติ/ลดลง",color:"#22c55e",description:"ไม่พบสัญญาณน้ำเพิ่มถึงเกณฑ์ในข้อมูลล่าสุด; ไม่ใช่การยืนยันว่าไม่มีน้ำท่วม"},
 NO_DATA:{label:"ข้อมูลไม่เพียงพอ",color:"#64748b",description:"รอบติดตามยังไม่มีข้อมูลที่ผ่าน QA; ห้ามตีความว่าไม่มีน้ำ"},
 WAIT_BASELINE:{label:"รอภาพฐานใหม่",color:"#a78bfa",description:"วันฐานที่มีอยู่ห่างเกินช่วงทดลอง ห้ามใช้เป็นหลักฐานแจ้งเตือนน้ำเพิ่ม"}
};
function number(x){return x==null||typeof x==="boolean"||!Number.isFinite(Number(x))?null:Number(x)}
function trusted(x){
 const q=number(x?.valid_pct),water=number(x?.water_rai);
 return !!x&&["VERIFIED","AUTO_VALID"].includes(x.analysis_status)&&q!==null&&q>=70&&water!==null&&/^\d{4}-\d{2}-\d{2}$/.test(x.date||"");
}
function date8(x){return String(x||"").replace(/-/g,"")}
function gap(a,b){
 const aa=Date.parse(a+"T00:00:00Z"),bb=Date.parse(b+"T00:00:00Z");
 return Number.isFinite(aa)&&Number.isFinite(bb)?Math.round((bb-aa)/86400000):null;
}
function signal(before,after,area){
 const delta=number(after?.water_rai)-number(before?.water_rai);
 const pct=area>0?delta/area:0;
 return delta>0&&(delta>=TRIAL.minRiseRai||pct>=TRIAL.minRiseFraction);
}
function classify(plot,history){
 const all=[...(history||[])].filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r?.date||"")).sort((a,b)=>a.date.localeCompare(b.date));
 const trustedRows=all.filter(trusted);
 const latest=trustedRows.at(-1)||null,previous=trustedRows.at(-2)||null,antecedent=trustedRows.at(-3)||null;
 const targetDate=date8(plot?.current);
 const target=all.find(x=>date8(x.date)===targetDate);
 const area=number(plot?.area_rai);
 const result={
  status:"WAIT_BASELINE",reason:"รอภาพที่ผ่าน QA เพื่อกำหนดวันฐาน",status_source:"analysis_history.json",
  latest_date:latest?.date||null,previous_date:previous?.date||null,
  gap_days:latest&&previous?gap(previous.date,latest.date):null,
  latest_qa_valid_pct:latest?.valid_pct??null,experimental:true
 };
 if(target?.analysis_status==="NO_DATA"&&!trusted(target)){
  return {...result,status:"NO_DATA",reason:"ภาพวันติดตามไม่มีข้อมูลที่ผ่าน QA"};
 }
 if(target&&target.analysis_status==="PARTIAL"&&!trusted(target)){
  return {...result,reason:"รอบติดตามผ่าน QA เพียงบางส่วน—รอภาพฐานใหม่"};
 }
 if(!latest||!previous||!(area>0))return result;
 const delta=number(latest.water_rai)-number(previous.water_rai);
 if(delta<=0){
  return {...result,status:"NORMAL",reason:"พื้นที่น้ำเปิดไม่เพิ่มขึ้นเมื่อเทียบกับวันฐานล่าสุดที่ผ่าน QA"};
 }
 if(result.gap_days==null||result.gap_days<0||result.gap_days>TRIAL.maxDays){
  return {...result,status:"WAIT_BASELINE",reason:"ระยะห่างภาพ "+result.gap_days+" วัน เกินเกณฑ์ทดลอง "+TRIAL.maxDays+" วัน"};
 }
 // First water increase => WATCH; only two consecutive qualified increases => HIGH.
 if(!signal(previous,latest,area))return {...result,status:"NORMAL",reason:"น้ำเพิ่มแต่ต่ำกว่าเกณฑ์แจ้งเตือนเบื้องต้น"};
 const persistent=!!antecedent&&
  gap(antecedent.date,previous.date)<=TRIAL.maxDays&&
  gap(antecedent.date,previous.date)>0&&
  signal(antecedent,previous,area)&&signal(previous,latest,area);
 if(persistent)return {...result,status:"HIGH",reason:"ตรวจพบน้ำเพิ่มถึงเกณฑ์ต่อเนื่องสองรอบภาพที่ผ่าน QA"};
 return {...result,status:"WATCH",reason:"พบน้ำเพิ่มถึงเกณฑ์จากคู่ภาพล่าสุด รอตรวจซ้ำเพื่อยืนยัน"};
}
function apply(plots,history){
 return (plots||[]).map(raw=>{
  const p={...raw};
  const rows=(history||{})[p.plot]||[];
  const result=classify(p,rows);
  const good=rows.filter(trusted).sort((a,b)=>a.date.localeCompare(b.date));
  const latest=good.at(-1),previous=good.at(-2),area=number(p.area_rai);
  if(latest&&area>0){
   p.water_current_rai=number(latest.water_rai);
   p.water_current_pct=+(p.water_current_rai/area*100).toFixed(2);
   p.latest_valid_pct=number(latest.valid_pct);
   if(previous){
    p.water_before_rai=number(previous.water_rai);
    p.water_before_pct=+(p.water_before_rai/area*100).toFixed(2);
    p.water_change_pp=+(p.water_current_pct-p.water_before_pct).toFixed(2);
   }
  }else{p.water_current_rai=null;p.water_current_pct=null;p.water_change_pp=null;}
  // Never assign a "0%" observation to a current NO_DATA scene.
  if(result.status==="NO_DATA"){p.water_current_rai=null;p.water_current_pct=null;p.water_change_pp=null}
  // Preserve existing documented polygon-source metadata only for original dates.
  if(latest&&date8(latest.date)!==date8(raw.current)){
   p.new_water_rai=null;
  }
  return {...p,...result};
 });
}
root.MonitoringStatus={TRIAL,EXPERIMENTAL_MAX_BASELINE_DAYS,STATUS_META,trusted,classify,apply};
})(typeof window==="undefined"?globalThis:window);
