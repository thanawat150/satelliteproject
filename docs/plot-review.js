/* Manual plot assessment, deliberately separate from satellite QA and scientific metrics.
   Reviews live only in this browser unless explicitly exported; never sent to GitHub. */
(function(root){
"use strict";
const $=id=>document.getElementById(id);
const grades=new Set(["A","B","C","D","NA"]);
const conditions=new Set(["OK","WATCH","FIELD","MORE_DATA"]);
const gradeLabel={A:"A · ยอมรับได้ตามเกณฑ์ผู้ตรวจ",B:"B · ติดตามต่อ",C:"C · น่ากังวล",D:"D · ควรตรวจภาคสนาม",NA:"N/A · ยังตัดสินไม่ได้"};
const conditionLabel={OK:"ยอมรับผลการตรวจ",WATCH:"เฝ้าติดตาม",FIELD:"ควรลงพื้นที่",MORE_DATA:"รอข้อมูลเพิ่มเติม"};
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const emptyReview=()=>({grade:"NA",condition:"MORE_DATA",note:"",savedAt:""});
const state={plot:null,dates:[],record:null,pending:false,supported:true};
function key(plot,dates){return "ken-monitor:review:v1:"+String(plot||"")+":"+(dates||[]).map(String).join("|")}
function normalize(raw){
 if(!raw||typeof raw!=="object")return null;
 if(!grades.has(raw.grade)||!conditions.has(raw.condition))return null;
 return {grade:raw.grade,condition:raw.condition,note:String(raw.note||"").slice(0,800),savedAt:String(raw.savedAt||"")};
}
function read(plot,dates){
 try{return normalize(JSON.parse(root.localStorage.getItem(key(plot,dates))))}catch(e){return null}
}
function currentRecord(){return state.record&&state.plot?{plot:state.plot,dates:[...state.dates],...state.record}:null}
function showMessage(text,warning=false){const p=$("mc-review-feedback");if(p){p.textContent=text;p.dataset.warn=String(warning)}}
function updatePaper(){
 const target=$("mcr-review-outcome");
 if(!target)return;
 const r=currentRecord();
 if(!r){target.innerHTML='<div class="mcr-review-unset">ผลประเมินโดยผู้ตรวจ: ยังไม่บันทึกเกรด</div>';return}
 target.innerHTML='<div class="mcr-review-saved"><div class="mcr-review-grade">'+
 '<span>MANUAL GRADE</span><strong>'+esc(r.grade)+'</strong></div><div class="mcr-review-content">'+
 '<strong>ผู้ตรวจประเมิน: '+esc(gradeLabel[r.grade])+'</strong>'+
 '<span>สถานะ: '+esc(conditionLabel[r.condition])+'</span>'+
 (r.note?'<p>หมายเหตุผู้ตรวจ: '+esc(r.note)+'</p>':"")+
 '<small>บันทึก: '+esc(r.savedAt?new Date(r.savedAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}):"ไม่ระบุ")+
 ' · เป็นความเห็นผู้ตรวจ ไม่ใช่ผลคำนวณจากดาวเทียม</small></div></div>';
}
function onView(view){
 const panel=$("mc-review-panel");
 state.plot=view?.kind==="plot"?view.plot:null;
 state.dates=view?.kind==="plot"?[...view.dates]:[];
 state.record=state.plot?read(state.plot,state.dates):null;
 state.pending=false;
 if(panel)panel.hidden=!state.plot;
 if($("mc-review-grade"))$("mc-review-grade").value=state.record?.grade||"NA";
 if($("mc-review-condition"))$("mc-review-condition").value=state.record?.condition||"MORE_DATA";
 if($("mc-review-note"))$("mc-review-note").value=state.record?.note||"";
 if(state.plot){
  showMessage(state.record?
   "โหลดผลประเมินที่เคยบันทึกไว้ในเบราว์เซอร์นี้แล้ว":"ยังไม่ได้บันทึกเกรดสำหรับแปลงและชุดวันที่ที่เลือก");
 }else showMessage("เกรดประเมินใช้กับรายแปลงเท่านั้น");
 updatePaper();
}
function markDirty(){
 state.pending=true;
 root.AnalysisCenter?.invalidateFinal?.("มีการแก้เกรดหรือหมายเหตุ • บันทึกก่อนสร้าง Final ใหม่");
 const generate=$("mc-create-final");if(generate)generate.disabled=true;
 showMessage("มีการแก้ไขที่ยังไม่บันทึก • กดบันทึกก่อนสร้าง Final",true);
}
function save(){
 if(!state.plot){showMessage("กรุณาเลือกแปลงและวันที่ก่อน",true);return false}
 const grade=$("mc-review-grade")?.value,condition=$("mc-review-condition")?.value;
 if(!grades.has(grade)||!conditions.has(condition)){showMessage("กรุณาเลือกเกรดและสถานะที่กำหนด",true);return false}
 const note=String($("mc-review-note")?.value||"").trim().slice(0,800);
 const savedAt=new Date().toISOString();
 const record={grade,condition,note,savedAt};
 try{root.localStorage.setItem(key(state.plot,state.dates),JSON.stringify(record))}
 catch(e){state.supported=false;showMessage("เบราว์เซอร์ไม่อนุญาตบันทึกข้อมูล โปรดดาวน์โหลดไฟล์ JSON เพื่อเก็บข้อมูล",true);return false}
 state.record=record;state.pending=false;state.supported=true;
 updatePaper();
 root.AnalysisCenter?.onReviewSaved?.();
 showMessage("บันทึกเกรดในเบราว์เซอร์เครื่องนี้แล้ว • ไม่ได้อัปโหลดไปเซิร์ฟเวอร์");
 return true;
}
function exportRecord(){
 if(state.pending){showMessage("กรุณากดบันทึกการประเมินล่าสุดก่อนดาวน์โหลด",true);return}
 const r=currentRecord();
 if(!r){showMessage("ยังไม่มีผลประเมินสำหรับดาวน์โหลด",true);return}
 const payload={schema:"ken-monitoring-manual-grade-v1",source:"user-assessment",...r};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="PlotReview_"+r.plot+"_"+(r.dates[1]||"undated")+".json";
 a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 showMessage("ส่งออก JSON แล้ว • เก็บไฟล์ไว้สำหรับการตรวจสอบย้อนกลับ");
}
function canPrint(){
 if(!state.plot)return true;
 if(state.pending){showMessage("มีเกรดหรือหมายเหตุที่ยังไม่บันทึก • กดบันทึกก่อนพิมพ์",true);return false}
 return true;
}
function bind(){
 if($("mc-review-panel")?.dataset.bound)return;
 if($("mc-review-panel"))$("mc-review-panel").dataset.bound="1";
 for(const id of ["mc-review-grade","mc-review-condition"])$(id)?.addEventListener("change",markDirty);
 $("mc-review-note")?.addEventListener("input",markDirty);
 $("mc-review-save")?.addEventListener("click",save);
 $("mc-review-export")?.addEventListener("click",exportRecord);
}
root.PlotReview={onView,bind,save,canPrint,currentRecord,updatePaper,model:{key,normalize,grades,conditions}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})(window);