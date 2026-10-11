/* Pure live-report selectors — latest valid observations and latest satellite image are different concepts. */
(function(global){
"use strict";
function ordered(rows){return [...(rows||[])].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x.date||""))).sort((a,b)=>a.date.localeCompare(b.date))}
function trusted(x){return !!x&&["VERIFIED","AUTO_VALID"].includes(x.analysis_status)&&(x.valid_pct==null||Number(x.valid_pct)>=70)&&Number.isFinite(x.water_rai)&&Number.isFinite(x.water_pct)}
function make(records,sceneDates){
 const all=ordered(records),good=all.filter(trusted),current=good.at(-1)||null,previous=good.at(-2)||null;
 const dates=[...new Set([...(sceneDates||[]),...all.map(x=>x.date)].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x))))].sort();
 const latestDate=dates.at(-1)||null,latestRecord=all.find(x=>x.date===latestDate)||null;
 const deltaWater=current&&previous?current.water_rai-previous.water_rai:null;
 const pending=!!latestDate&&(!latestRecord||!trusted(latestRecord));
 return {rows:all,current,previous,latestDate,latestRecord,deltaWater,newWater:current&&Number.isFinite(current.new_water_rai)?current.new_water_rai:null,pending};
}
global.LiveReportModel={ordered,trusted,make};
})(window);
