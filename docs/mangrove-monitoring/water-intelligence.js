/* Read-only mangrove water-change screening using already published observations.
   Does NOT infer flood, tide height, rainfall, forest mortality or verified risk. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MMCWaterIntelligence=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const QA_MIN_PIXELS=30, MIN_COVERAGE_PCT=50, MAX_REVERSAL_GAP_DAYS=14;

  const num=x=>(x===null||x===undefined||x==='')?null:
    (Number.isFinite(Number(x))?Number(x):null);

  function quality(row,areaRai){
    const reasons=[],pixels=num(row.common_clear_pixels);
    const common=num(row.common_clear_rai);
    const plotArea=num(areaRai);
    const explicitCoverage=num(row.common_clear_pct_of_plot);
    const coverage=explicitCoverage!==null?explicitCoverage:
      (plotArea>0&&common!==null?100*common/plotArea:null);
    if(row.status!=='AUTO_VALID')reasons.push('ไม่ผ่าน QA ของคู่ภาพ');
    if(pixels===null||pixels<QA_MIN_PIXELS)reasons.push('พิกเซลร่วมต่ำกว่า 30');
    if(common===null||common<=0)reasons.push('ไม่มีพื้นที่ใช้เปรียบเทียบได้');
    if(coverage===null)reasons.push('ยังไม่ทราบสัดส่วนพื้นที่ร่วม');
    else if(coverage<MIN_COVERAGE_PCT)reasons.push('พื้นที่ร่วมต่ำกว่า 50% ของแปลง');
    return {reasons,sample_pixels:pixels,common_clear_rai:common,
      common_clear_pct:coverage,screenable:reasons.length===0};
  }

  function substantive(change,common){
    const n=Math.abs(num(change)||0);
    return n>=0.25||(n>=0.05&&common>0&&n/common>=0.05);
  }

  function derive(changes,areas={}){
    const screened=[],held=[],observations=[],byPlot=new Map();
    for(const x of changes||[]){
      const q=quality(x,areas[x.plot]);
      const amount=num(x.water_net_change_rai);
      const item={plot:x.plot,date_a:x.date_a,date_b:x.date_b,water_delta_rai:amount,
        quality:q,status:q.screenable?'SCREENING_ONLY':'INSUFFICIENT_EVIDENCE',
        tide_status:'NO_OBSERVATION_CONNECTED',rain_status:'NO_OBSERVATION_CONNECTED'};
      observations.push(item);
      if(!byPlot.has(x.plot))byPlot.set(x.plot,[]);
      byPlot.get(x.plot).push(item);
      if(!q.screenable)held.push(item);
      else if(amount>0&&substantive(amount,q.common_clear_rai))
        screened.push({...item,status:'WATER_INCREASE_CANDIDATE'});
    }
    const reversals=[];
    for(const [plot,items] of byPlot){
      items.sort((a,b)=>String(a.date_b).localeCompare(String(b.date_b)));
      for(let i=1;i<items.length;i++){
        const a=items[i-1],b=items[i];
        const span=(Date.parse(b.date_b+'T00:00:00Z')-Date.parse(a.date_b+'T00:00:00Z'))/86400000;
        if(a.date_b!==b.date_a||!Number.isFinite(span)||span<=0||span>MAX_REVERSAL_GAP_DAYS)continue;
        if(!(a.water_delta_rai>0&&b.water_delta_rai<0))continue;
        if(!substantive(a.water_delta_rai,a.quality.common_clear_rai)||
           !substantive(b.water_delta_rai,b.quality.common_clear_rai))continue;
        const missing=[...new Set([...a.quality.reasons,...b.quality.reasons])];
        reversals.push({plot,first_date:a.date_b,second_date:b.date_b,
          first_delta_rai:a.water_delta_rai,second_delta_rai:b.water_delta_rai,
          interval_days:span,status:missing.length?'INSUFFICIENT_EVIDENCE':'WATER_REVERSAL_REVIEW',
          qa_reasons:missing,water_has_returned_to_normal:false,
          tide_status:'NO_OBSERVATION_CONNECTED',rain_status:'NO_OBSERVATION_CONNECTED'});
      }
    }
    return {observations,water_increases:screened,reversals,held,
      context:{tide:'NOT_CONNECTED',rain:'NOT_CONNECTED',seasonal_baseline:'NOT_ESTABLISHED'},
      scientific_status:'SCREENING_ONLY_NOT_FLOOD_CONFIRMATION'};
  }

  function daySnapshot(scenes,selectedDate,rainScenes=[]){
    const ordered=[...(scenes||[])].filter(x=>/^20\d{2}-\d{2}-\d{2}$/.test(x?.date||''))
      .sort((a,b)=>a.date.localeCompare(b.date));
    const row=ordered.find(x=>x.date===selectedDate);
    if(!row)return null;
    const rain=(rainScenes||[]).find(x=>x.date===selectedDate)||null;
    const verified=row.analysis_status==='AUTO_VALID';
    const idx=k=>verified?num(row[k]):null;
    const rainOk=rain?.data_quality==='COMPLETE';
    const rainNum=k=>rainOk?num(rain[k]):null;
    return {
      date:row.date,qa_status:row.analysis_status||'UNKNOWN',
      qa_valid_pct:num(row.qa_valid_pct),analytical_values_approved_for_screening:verified,
      ndwi:idx('ndwi'),mndwi:idx('mndwi'),water_rai:idx('water_rai'),
      rainfall_prev_1_utc_day_mm:rainNum('rain_prev_1_utc_day_mm'),
      rainfall_prev_3_utc_days_mm:rainNum('rain_prev_3_utc_days_mm'),
      rainfall_source:rain?'NASA_POWER_PRECTOTCORR':null,
      rainfall_quality:rain?.data_quality||'NOT_AVAILABLE',
      tide_level_m:null,tide_status:'NOT_CONNECTED',
      note:verified?'Date-matched legacy QA-valid scene metrics, not tidal normalization'
        :'Non-QA image day: only visual maps, do not present quantitative indices as validated'
    };
  }
  return Object.freeze({derive,quality,substantive,daySnapshot,QA_MIN_PIXELS,MIN_COVERAGE_PCT});
});
