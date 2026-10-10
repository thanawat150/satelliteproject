const assert=require('node:assert/strict');
const water=require('../docs/mangrove-monitoring/water-intelligence.js');
const change=(plot,date_a,date_b,water_net_change_rai,pixels=60,area=12,status='AUTO_VALID')=>
  ({plot,date_a,date_b,water_net_change_rai,common_clear_pixels:pixels,
    common_clear_rai:area,status});
const rows=[
  change('16-STC','2026-07-19','2026-09-29',22.528,120,75),
  change('16-STC','2026-09-29','2026-10-07',-10.163,120,75),
  change('30-STC','2026-09-22','2026-09-30',0.255,5,1.2),
  change('24-VSD','2026-09-05','2026-09-30',0,59,8),
  change('92-STC','2026-09-29','2026-10-02',1.256,70,40),
  change('92-STC','2026-10-02','2026-10-07',-1.547,72,40),
  change('low','2026-09-29','2026-10-02',0.5,80,1),
  change('low','2026-10-02','2026-10-07',-0.5,80,1)
];
const result=water.derive(rows,{'16-STC':100,'30-STC':1.3353,'24-VSD':10,'92-STC':50,low:10});
assert.equal(result.reversals.filter(x=>x.status==='WATER_REVERSAL_REVIEW').length,2);
assert.equal(result.reversals.find(x=>x.plot==='16-STC').water_has_returned_to_normal,false);
assert.ok(result.held.some(x=>x.plot==='30-STC'),'5 pixels cannot auto-confirm signal');
assert.ok(result.held.some(x=>x.plot==='low'),'10% common coverage must be held');
assert.ok(!result.water_increases.some(x=>x.plot==='30-STC'));
assert.equal(result.context.tide,'NOT_CONNECTED');
assert.equal(result.context.rain,'NOT_CONNECTED');
assert.equal(water.quality(change('unknown','2026-01-01','2026-01-02',5),null).screenable,false);
assert.equal(water.substantive(0.07,1),true,'small plots should use proportion-based threshold');
assert.equal(water.substantive(0.03,1),false,'rounding noise should not trigger');
console.log('WATER_INTELLIGENCE_QA_PASS',result.reversals.length,result.held.length);
