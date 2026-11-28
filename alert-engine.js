/* Office-only evidence-grounded alert rules. Advisory priorities are not diagnoses. */
(function(root){
"use strict";
const good=r=>r&&["VERIFIED","AUTO_VALID"].includes(r.analysis_status)&&(r.valid_pct==null||Number(r.valid_pct)>=70);
const value=n=>n==null||!Number.isFinite(Number(n))?null:Number(n);
const round=n=>Math.round(n*100)/100;
const date=d=>d?d.split("-").reverse().join("/"):"—";
function build({history={},plots=[],images=[]}={}){
 const result=[];
 const byPlot=new Map(plots.map(p=>[p.plot,p]));
 const scenes=new Map();
 for(const img of images){if(!img.plot||!img.date)continue;const x=scenes.get(img.plot)||new Set();x.add(img.date);scenes.set(img.plot,x)}
 for(const [plot,raw] of Object.entries(history)){
  const rows=[...(raw||[])].filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date));
  const trusted=rows.filter(good);
  const previous=trusted.at(-2),latest=trusted.at(-1);
  const p=byPlot.get(plot);
  if(latest&&previous){
   const before=value(previous.water_rai),after=value(latest.water_rai),area=value(p?.area_rai);
   const change=before==null||after==null?null:round(after-before);
   const newWater=value(latest.new_water_rai);
   if(change!=null&&change>0&&(change>=5||(area&&change/area>=.05))){
    const priority=change>=20||(area&&change/area>=.1)?"P1":"P2";
    result.push({id:plot+"-"+latest.date+"-WATER",plot,date:latest.date,dateA:previous.date,dateB:latest.date,priority,type:"water",title:"สัญญาณพื้นที่น้ำเพิ่ม",detail:"น้ำเพิ่มสุทธิ "+change.toLocaleString("th-TH")+" ไร่ ระหว่าง "+date(previous.date)+" → "+date(latest.date)+(newWater!=null?" • พื้นที่น้ำใหม่ "+round(newWater)+" ไร่":""),
      evidence:{change_water_rai:change,new_water_rai:newWater,valid_pct:latest.valid_pct},confidence:"screening",note:"ตรวจภาพประกอบและระดับน้ำขึ้นลงก่อนสรุปน้ำท่วม"});
   }
   const dre=value(latest.ndre)-value(previous.ndre),dmi=value(latest.ndmi)-value(previous.ndmi);
   if(value(latest.ndre)!=null&&value(previous.ndre)!=null&&value(latest.ndmi)!=null&&value(previous.ndmi)!=null&&dre<=-.03&&dmi>=.05){
    result.push({id:plot+"-"+latest.date+"-STRESS",plot,date:latest.date,dateA:previous.date,dateB:latest.date,priority:"P2",type:"vegetation",title:"สัญญาณพืชอาจเครียด",detail:"NDRE ลด "+Math.abs(round(dre))+" และ NDMI เพิ่ม "+round(dmi)+" (ค่าเฉลี่ยระดับแปลง)",evidence:{delta_ndre:round(dre),delta_ndmi:round(dmi)},confidence:"screening",note:"ยังไม่ยืนยันน้ำขังหรือสภาพพืชรายตำแหน่ง"});
   }else if(value(latest.ndvi)!=null&&value(previous.ndvi)!=null&&latest.ndvi-previous.ndvi<=-.08){
    result.push({id:plot+"-"+latest.date+"-GREEN",plot,date:latest.date,dateA:previous.date,dateB:latest.date,priority:"P2",type:"vegetation",title:"ความเขียวพืชลดลง",detail:"NDVI ลด "+Math.abs(round(latest.ndvi-previous.ndvi))+" (ค่าเฉลี่ยระดับแปลง)",evidence:{delta_ndvi:round(latest.ndvi-previous.ndvi)},confidence:"screening",note:"ห้ามสรุปพืชตายจากค่าเฉลี่ยเพียงอย่างเดียว"});
   }
  }
  const lastScene=[...(scenes.get(plot)||[])].sort().at(-1);
  const lastRow=rows.find(x=>x.date===lastScene);
  if(lastScene && (!lastRow||!good(lastRow))){
    const pct=value(lastRow?.valid_pct);
    result.push({id:plot+"-"+lastScene+"-QA",plot,date:lastScene,dateA:null,dateB:lastScene,priority:"P3",type:"qa",title:lastRow?.analysis_status==="NO_DATA"?"ภาพล่าสุดมีข้อมูลไม่เพียงพอ":lastRow?.analysis_status==="PARTIAL"?"ภาพล่าสุดผ่าน QA บางส่วน":"ภาพใหม่รอการวิเคราะห์",detail:"ภาพ "+date(lastScene)+" • "+(pct==null?"ยังไม่มีผล QA":"พื้นที่ใช้ได้ "+round(pct)+"%")+" • ยังไม่แทนผลล่าสุดที่เชื่อถือได้",evidence:{valid_pct:pct},confidence:"data_quality",note:"ข้อมูล QA ไม่ใช่เหตุการณ์น้ำท่วม"});
  }
 }
 const rank={P1:0,P2:1,P3:2};
 result.sort((a,b)=>rank[a.priority]-rank[b.priority]||b.date.localeCompare(a.date)||a.plot.localeCompare(b.plot));
 return result;
}
root.MonitoringAlerts={build};
})(typeof window==="undefined"?globalThis:window);
