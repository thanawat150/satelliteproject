/* Geospatial QA gate for dated overlays. Verified report numbers do not imply an equally verified map polygon. */
(function(root){
"use strict";
const truth=x=>x&&x.analysis_status==="VERIFIED"&&(x.valid_pct==null||Number(x.valid_pct)>=70);
const WGS_RAI=1600;
function ringArea(r){
 if(!r||r.length<4)return 0;
 const lon0=r[0][0],lat0=r[0][1],cos=Math.cos(lat0*Math.PI/180);
 let sum=0;
 for(let i=0;i<r.length-1;i++){
  const [x,y]=r[i],[u,v]=r[i+1];
  sum+=((x-lon0)*111320*cos)*((v-lat0)*110940)-((u-lon0)*111320*cos)*((y-lat0)*110940);
 }
 return Math.abs(sum/2);
}
function polygonArea(poly){
 if(!Array.isArray(poly)||!poly.length)return 0;
 return Math.max(0,ringArea(poly[0])-poly.slice(1).reduce((v,x)=>v+ringArea(x),0));
}
function areaRai(geometry){
 if(!geometry)return NaN;
 const area=geometry.type==="Polygon"?polygonArea(geometry.coordinates):
 geometry.type==="MultiPolygon"?geometry.coordinates.reduce((v,p)=>v+polygonArea(p),0):NaN;
 return area/WGS_RAI;
}
function verifyPair(info,a,b,rows,feature,limit=.15){
 if(!info||!a||!b)return {ok:false,reason:"ไม่ได้เลือกแปลงหรือคู่วันที่ครบ"};
 if(a.replace(/-/g,"")!==String(info.baseline)||b.replace(/-/g,"")!==String(info.current))
  return {ok:false,reason:"ชั้นน้ำใหม่จากรายงานอ้างอิงใช้ได้เฉพาะคู่วันที่ Baseline → Current"};
 const aa=(rows||[]).find(x=>x.date===a),bb=(rows||[]).find(x=>x.date===b);
 if(!truth(aa)||!truth(bb))return {ok:false,reason:"ข้อมูลอย่างน้อยหนึ่งวันยังไม่ผ่านการตรวจยืนยัน"};
 if(!feature||feature.properties?.plot!==info.plot)return {ok:false,reason:"ไม่มี Polygon น้ำใหม่ที่ตรงกับแปลง"};
 const claimed=Number(info.new_water_rai),prop=Number(feature.properties?.new_water_rai);
 if(!Number.isFinite(claimed)||claimed<=0||!Number.isFinite(prop)||Math.abs(prop-claimed)>.05)
  return {ok:false,reason:"ค่าพื้นที่น้ำใหม่ในรายงานกับข้อมูล Polygon ไม่ตรงกัน"};
 const measured=areaRai(feature.geometry),discrepancy=Math.abs(measured-claimed)/claimed;
 if(!Number.isFinite(measured)||discrepancy>limit)
  return {ok:false,reason:"Polygon ยังไม่ผ่านตรวจสอบพื้นที่กับรายงาน",reported_rai:claimed,polygon_rai:measured,discrepancy};
 return {ok:true,reason:"Polygon ผ่านการตรวจสอบความสอดคล้องของพื้นที่เบื้องต้น",reported_rai:claimed,polygon_rai:measured,discrepancy};
}
root.MonitoringQA={areaRai,verifyPair};
})(typeof window==="undefined"?globalThis:window);
