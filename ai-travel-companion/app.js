(function(){
'use strict';
var CITIES=[
{name:'หัวหิน',aliases:['hua hin','huahin'],lat:12.57,lng:99.96,places:[
['หาดหัวหิน','ทะเล','เดินเล่นริมทะเลและถ่ายรูป','🏖️'],
['สถานีรถไฟหัวหิน','วัฒนธรรม','แลนด์มาร์กสถาปัตยกรรมของหัวหิน','🚂'],
['เขาตะเกียบ','ธรรมชาติ','ชมบรรยากาศชายฝั่งและวิวเมือง','⛰️'],
['อุทยานราชภักดิ์','วัฒนธรรม','ชมอนุสาวรีย์และพื้นที่ประวัติศาสตร์','🏛️'],
['อ่างเก็บน้ำเขาเต่า','ธรรมชาติ','วิวอ่างเก็บน้ำและทิวเขา','🌿'],
['ตลาดโต้รุ่งหัวหิน','ครอบครัว','สำรวจอาหารท้องถิ่น ตรวจวันเวลาเปิด','🍜'],
['Memory House Cafe Hua Hin','คาเฟ่','คาเฟ่และมุมถ่ายรูป ตรวจเวลาบริการ','☕']]},
{name:'ปราณบุรี',aliases:['pranburi','ปากน้ำปราณ'],lat:12.39,lng:99.93,places:[
['วนอุทยานปราณบุรี','ธรรมชาติ','เส้นทางศึกษาป่าชายเลน ตรวจสภาพทางเดิน','🌳'],
['หาดเขากะโหลก','ทะเล','หาดทรายและภูเขาหินปูน','🏝️'],
['ปากน้ำปราณ','ทะเล','เดินเล่นริมชายฝั่งและชุมชนประมง','🐚'],
['Eureka Beach Cafe','คาเฟ่','คาเฟ่ริมทะเลแถวปราณบุรี ตรวจเวลาบริการ','☕'],
['อ่างเก็บน้ำปราณบุรี','ธรรมชาติ','แวะชมวิวอ่างเก็บน้ำ','💧']]},
{name:'สามร้อยยอด',aliases:['sam roi yot','เขาสามร้อยยอด'],lat:12.21,lng:99.96,places:[
['บึงบัวสามร้อยยอด','ธรรมชาติ','สะพานไม้และพื้นที่ชุ่มน้ำ ตรวจเวลาเปิด','🌿'],
['ถ้ำพระยานคร','ธรรมชาติ','เส้นทางเดินขึ้นถ้ำ ต้องเผื่อเวลาและแรง','🪨'],
['หาดสามพระยา','ทะเล','พักผ่อนริมหาด','🏖️'],
['จุดชมวิวเขาแดง','ธรรมชาติ','เดินชมวิวภูเขาหินปูน ตรวจสภาพเส้นทาง','⛰️']]},
{name:'ชะอำ',aliases:['cha am','cha-am'],lat:12.80,lng:99.97,places:[
['หาดชะอำ','ทะเล','ชายหาดและร้านอาหารริมหาด','🏖️'],
['วนอุทยานชะอำ','ธรรมชาติ','เดินชมสวนป่าชายทะเล','🌲'],
['วนอุทยานเขานางพันธุรัต','ธรรมชาติ','ภูเขาหินปูนและเส้นทางเดินป่า','⛰️'],
['วัดเนรัญชราราม','วัฒนธรรม','ชมวัดและพักผ่อนสงบ','🛕'],
['พระราชนิเวศน์มฤคทายวัน','วัฒนธรรม','สถาปัตยกรรมไม้ริมทะเล ตรวจวันเปิด','🏰']]},
{name:'เชียงใหม่',aliases:['chiang mai','chiangmai'],lat:18.79,lng:98.99,places:[
['วัดพระธาตุดอยสุเทพ','วัฒนธรรม','วัดสำคัญบนดอยสุเทพ','🛕'],
['ประตูท่าแพ','วัฒนธรรม','แลนด์มาร์กเมืองเชียงใหม่','🏯'],
['อ่างแก้ว มหาวิทยาลัยเชียงใหม่','ธรรมชาติ','ชมวิวอ่างน้ำและดอยสุเทพ','🌿'],
['วัดเจดีย์หลวง','วัฒนธรรม','วัดสำคัญในเขตคูเมือง','🏛️'],
['สวนพฤกษศาสตร์สมเด็จพระนางเจ้าสิริกิติ์','ธรรมชาติ','เดินชมพืชพรรณในอำเภอแม่ริม','🌳']]},
{name:'เชียงราย',aliases:['chiang rai'],lat:19.91,lng:99.84,places:[
['วัดร่องขุ่น','วัฒนธรรม','งานสถาปัตยกรรมวัดสีขาว','🛕'],
['วัดร่องเสือเต้น','วัฒนธรรม','วัดสีน้ำเงิน','🏛️'],
['พิพิธภัณฑ์บ้านดำ','วัฒนธรรม','พิพิธภัณฑ์ศิลปะและอาคารไม้','🎨'],
['สิงห์ปาร์ค เชียงราย','ธรรมชาติ','ภูมิทัศน์และพื้นที่ท่องเที่ยว','🌿']]},
{name:'กรุงเทพฯ',aliases:['กรุงเทพ','bangkok','กรุงเทพมหานคร','bkk'],lat:13.76,lng:100.50,places:[
['วัดอรุณราชวราราม','วัฒนธรรม','วัดริมแม่น้ำเจ้าพระยา','🛕'],
['สวนลุมพินี','ธรรมชาติ','สวนสาธารณะใจกลางเมือง','🌳'],
['วัดพระศรีรัตนศาสดาราม','วัฒนธรรม','กลุ่มอาคารในเขตพระบรมมหาราชวัง','🏛️'],
['ถนนเยาวราช','ครอบครัว','เดินชมย่านและร้านอาหาร','🍜'],
['พิพิธภัณฑสถานแห่งชาติ พระนคร','วัฒนธรรม','พิพิธภัณฑ์ประวัติศาสตร์ไทย','🏺']]},
{name:'พระนครศรีอยุธยา',aliases:['อยุธยา','ayutthaya'],lat:14.35,lng:100.57,places:[
['วัดมหาธาตุ พระนครศรีอยุธยา','วัฒนธรรม','ชมโบราณสถานสำคัญ','🏛️'],
['วัดไชยวัฒนาราม','วัฒนธรรม','ชมโบราณสถานริมน้ำ','🛕'],
['วัดพระศรีสรรเพชญ์','วัฒนธรรม','ชมเจดีย์เก่าในอุทยานประวัติศาสตร์','🏺'],
['วัดใหญ่ชัยมงคล','วัฒนธรรม','วัดและโบราณสถาน','🛕']]},
{name:'กาญจนบุรี',aliases:['kanchanaburi'],lat:14.02,lng:99.53,places:[
['สะพานข้ามแม่น้ำแคว','วัฒนธรรม','แลนด์มาร์กทางรถไฟประวัติศาสตร์','🚂'],
['น้ำตกเอราวัณ','ธรรมชาติ','น้ำตกในอุทยานแห่งชาติ ตรวจสภาพเส้นทาง','💦'],
['สุสานทหารสัมพันธมิตรดอนรัก','วัฒนธรรม','อนุสรณ์สถานประวัติศาสตร์','🏛️'],
['วัดถ้ำเสือ กาญจนบุรี','วัฒนธรรม','วัดและทิวทัศน์บริเวณโดยรอบ','🛕']]},
{name:'กระบี่',aliases:['krabi'],lat:8.07,lng:98.91,places:[
['หาดอ่าวนาง','ทะเล','ชายหาดหลักของอ่าวนาง','🏖️'],
['หาดไร่เลย์','ทะเล','ชายหาดและภูเขาหินปูน ต้องใช้เรือ','🏝️'],
['สระมรกต กระบี่','ธรรมชาติ','สระน้ำธรรมชาติ ตรวจเวลาเข้า','💦'],
['น้ำตกร้อนคลองท่อม','ธรรมชาติ','แหล่งน้ำพุร้อนธรรมชาติ','🌿']]},
{name:'ภูเก็ต',aliases:['phuket'],lat:7.89,lng:98.40,places:[
['แหลมพรหมเทพ','ทะเล','ชมวิวปลายแหลมและพระอาทิตย์ตก','🌅'],
['หาดกะตะ','ทะเล','ชายหาดฝั่งตะวันตก','🏖️'],
['ย่านเมืองเก่าภูเก็ต','วัฒนธรรม','อาคารชิโนโปรตุกีสและย่านเก่า','🏘️'],
['วัดไชยธาราราม (วัดฉลอง)','วัฒนธรรม','วัดสำคัญประจำเมืองภูเก็ต','🛕']]},
{name:'ระยอง',aliases:['rayong'],lat:12.68,lng:101.28,places:[
['หาดแม่รำพึง','ทะเล','ชายหาดฝั่งระยอง','🏖️'],
['สวนพฤกษศาสตร์ระยอง','ธรรมชาติ','ท่องเที่ยวพื้นที่ชุ่มน้ำ','🌿'],
['เขาแหลมหญ้า','ธรรมชาติ','วิวชายฝั่งในเขตอุทยาน','🌊'],
['ตลาดบ้านเพ','ครอบครัว','ร้านอาหารและของฝากใกล้ชายทะเล','🐟']]},
{name:'พัทยา',aliases:['pattaya','ชลบุรี'],lat:12.93,lng:100.88,places:[
['หาดจอมเทียน','ทะเล','ชายหาดทางใต้ของพัทยา','🏖️'],
['ปราสาทสัจธรรม','วัฒนธรรม','สถาปัตยกรรมไม้ริมทะเล','🏰'],
['สวนนงนุช พัทยา','ธรรมชาติ','สวนตกแต่งภูมิทัศน์','🌿'],
['จุดชมวิวเขาพระตำหนัก','ธรรมชาติ','ชมวิวอ่าวพัทยา','⛰️']]},
{name:'ปาย',aliases:['pai'],lat:19.36,lng:98.44,places:[
['สะพานประวัติศาสตร์ปาย','วัฒนธรรม','สถานที่สำคัญริมแม่น้ำปาย','🌉'],
['กองแลน (ปายแคนยอน)','ธรรมชาติ','ทางเดินสันเขา ควรระวังความชัน','⛰️'],
['ถนนคนเดินปาย','ครอบครัว','ถนนท่องเที่ยวกลางเมือง ตรวจวันเวลา','🍢'],
['วัดพระธาตุแม่เย็น','วัฒนธรรม','วัดบนเนินเขา','🛕']]}
];
var catalog=CITIES.map(function(c){return Object.assign({},c,{places:c.places.map(function(p){return {title:p[0],category:p[1],detail:p[2],emoji:p[3],city:c.name};})});});
var $=function(id){return document.getElementById(id);};
var state={trip:null,day:0,tab:'plan',exploreCity:'all',filter:'ทั้งหมด',fuel:null};
var fuelFallback={gasohol95:41.44,gasohol91:41.07,e20:35.69,e85:31.63,dieselB7:42.94,premiumDiesel:null};
var fuelLabels={gasohol95:'แก๊สโซฮอล์ 95',gasohol91:'แก๊สโซฮอล์ 91',e20:'E20',e85:'E85',dieselB7:'ดีเซล B7',premiumDiesel:'ดีเซลพรีเมียม'};
var currentStyles=function(){return Array.prototype.slice.call(document.querySelectorAll('.style[aria-pressed="true"]')).map(function(x){return x.getAttribute('data-style');});};
function esc(str){return String(str==null?'':str).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function num(v,def){var n=Number(v);return Number.isFinite(n)&&n>=0?n:(def||0);}
function bounded(v,min,max){return Math.max(min,Math.min(max,num(v,min)));}
function money(n){return '฿'+Math.round(n).toLocaleString('th-TH');}
function warn(txt){var node=$('toast');node.textContent=txt;node.hidden=false;clearTimeout(warn.timer);warn.timer=setTimeout(function(){node.hidden=true;},3500);}
function norm(s){return String(s||'').toLowerCase().replace(/[\s.\/-]+/g,' ').trim();}
function findCity(s){
 var q=norm(s); if(!q)return null;
 return catalog.find(function(c){return norm(c.name)===q||c.aliases.some(function(a){return norm(a)===q;});})||
 catalog.find(function(c){return norm(c.name).indexOf(q)>=0||c.aliases.some(function(a){return norm(a).indexOf(q)>=0;});})||null;
}
function labelCity(q){var c=findCity(q);return c?c.name:String(q).trim();}
function mapSearch(s){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s);}
function googleRoute(from,to){return 'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(from+', Thailand')+'&destination='+encodeURIComponent(to+', Thailand')+'&travelmode=driving';}
function geoDist(a,b){if(!a||!b)return null;var rd=Math.PI/180;var dlat=(b.lat-a.lat)*rd,dlon=(b.lng-a.lng)*rd;var t=Math.sin(dlat/2)*Math.sin(dlat/2)+Math.cos(a.lat*rd)*Math.cos(b.lat*rd)*Math.sin(dlon/2)*Math.sin(dlon/2);return 6371*2*Math.atan2(Math.sqrt(t),Math.sqrt(1-t));}
function estimateKm(input){
 var keys=[input.origin].concat(input.destinations);
 if(input.end && norm(input.destinations[input.destinations.length-1])!==norm(input.end))keys.push(input.end);
 var total=0;
 for(var i=0;i<keys.length-1;i++){var x=findCity(keys[i]),y=findCity(keys[i+1]);if(!x||!y)return null;total+=(geoDist(x,y)||0)*1.35;}
 return Math.ceil((total+input.days*20)/10)*10;
}
function startISO(){var d=new Date();d.setDate(d.getDate()+1);var y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day;}
function dateAt(iso,i){var parts=iso.split('-').map(Number);var d=new Date(parts[0],parts[1]-1,parts[2],12);d.setDate(d.getDate()+i);return d.toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short',year:'numeric'});}
function getInput(){
 var pieces=$('destinations').value.split(/[,，;\n]+/).map(function(t){return t.trim();}).filter(Boolean).slice(0,8);
 if(!pieces.length)throw Error('กรุณาระบุจุดหมายอย่างน้อยหนึ่งแห่ง');
 var dest=pieces.map(labelCity),origin=labelCity($('origin').value.trim()),end=$('endCity').value.trim()?labelCity($('endCity').value.trim()):dest[dest.length-1];
 if(!origin)throw Error('กรุณาระบุต้นทาง');
 if(!/^\d{4}-\d\d-\d\d$/.test($('startDate').value))throw Error('กรุณาเลือกวันที่เริ่มทริป');
 var text=$('request').value.slice(0,400);
 var input={origin:origin,destinations:dest,end:end,start:$('startDate').value,days:bounded($('days').value,1,10),people:bounded($('people').value,1,30),budget:bounded($('budget').value,100,1000000),vehicle:$('vehicle').value,fuelType:$('fuelType').value,economy:bounded($('economy').value,2,50),manualKm:$('km').value.trim()===''?null:bounded($('km').value,0,10000),stay:bounded($('stay').value,0,300000),food:bounded($('food').value,0,10000),styles:currentStyles(),request:text};
 // Lightweight constraints parser, not an LLM. Explicit "A ก่อน B" overrides the city order.
 catalog.forEach(function(a){catalog.forEach(function(b){
  if(a.name!==b.name && text.indexOf(a.name)>=0 && text.indexOf(b.name)>=0){
   var pos=text.indexOf(a.name),posB=text.indexOf(b.name),before=text.indexOf('ก่อน',pos+a.name.length);
   if(before>=0&&before<posB&&pos<posB){
    var ia=input.destinations.indexOf(a.name),ib=input.destinations.indexOf(b.name);
    if(ia>=0&&ib>=0&&ia>ib){input.destinations.splice(ia,1);input.destinations.splice(ib,0,a.name);}
   }
  }
 });});
 return input;
}
function priorities(place,styles){
 var p=styles.indexOf(place.category)>=0?12:0;
 if(styles.indexOf('ครอบครัว')>=0 && place.category==='วัฒนธรรม')p+=2;
 return p;
}
function cityPlaces(city,input,used){
 if(!city)return[];
 return city.places.slice().sort(function(a,b){return priorities(b,input.styles)-priorities(a,input.styles);}).filter(function(p){return !used.has(p.title);});
}
function makeTrip(input){
 var cities=input.destinations.slice();
 if(norm(input.end)!==norm(cities[cities.length-1]))cities.push(input.end);
 if(cities.length>input.days)throw Error('จำนวนวันไม่เพียงพอสำหรับ '+cities.length+' เมือง กรุณาเพิ่มจำนวนวันหรือลดเมืองที่ต้องการไป');
 var used=new Set(),days=[],unknown=[],prev=input.origin;
 cities.forEach(function(c){if(!findCity(c)&&unknown.indexOf(c)<0)unknown.push(c);});
 if(!findCity(input.origin))unknown.push(input.origin);
 for(var i=0;i<input.days;i++){
  var index=Math.min(cities.length-1,Math.floor(i*cities.length/input.days));
  var cityName=cities[index],placeCity=findCity(cityName);
  var stops=[];
  var moving=norm(prev)!==norm(cityName);
  if(moving){
   stops.push({title:'เดินทาง: '+prev+' → '+cityName,detail:'เวลาและระยะทางถนนให้ตรวจด้วย Google Maps ก่อนออกเดินทาง',category:'เดินทาง',emoji:'🚙',mapFrom:prev,mapTo:cityName,kind:'travel',time:'ตามเส้นทาง'});
  }
  var available=cityPlaces(placeCity,input,used);
  var room=moving?1:3;
  for(var n=0;n<Math.min(room,available.length);n++){
   var p=available[n];used.add(p.title);stops.push(Object.assign({},p,{kind:'poi',time:moving?'เมื่อถึงที่พัก':n===0?'09:00':n===1?'13:00':'16:00'}));
  }
  if(stops.length===0||stops.every(function(p){return p.kind==='travel';})){
   stops.push({title:'ค้นหาสถานที่เพิ่มเติมใน '+cityName,detail:'ฐานข้อมูลรุ่นทดลองยังไม่มีจุดเที่ยวเพียงพอในพื้นที่นี้ — เปิดค้นหา Google Maps แล้วเพิ่มจุดเอง',category:'แนะนำ',emoji:'🔎',city:cityName,kind:'search',time:'เลือกเวลาเอง'});
  }
  var day={date:dateAt(input.start,i),city:cityName,stops:stops};
  days.push(day);
  prev=cityName;
 }
 var kmEstimate=estimateKm(input);
 return {input:input,days:days,unknown:unknown,kmEstimate:kmEstimate,createdAt:new Date().toISOString(),version:1};
}
function fuelRate(type){
 var d=state.fuel,rate=d&&d.prices?Number(d.prices[type]):NaN;
 if(Number.isFinite(rate)&&rate>=10&&rate<=150)return {value:rate,source:'ข้อมูลบางจาก วันที่ '+esc(d.asOf),estimated:false};
 rate=fuelFallback[type];if(Number.isFinite(rate))return {value:rate,source:'ราคาสำรอง 9 ต.ค. 2569',estimated:true};
 return {value:null,source:'ไม่มีราคายืนยัน กรุณาตรวจสอบเอง',estimated:true};
}
function costs(trip){
 var x=trip.input,km=x.manualKm==null?trip.kmEstimate:x.manualKm;
 var fuel=fuelRate(x.fuelType);
 var petrol=x.vehicle!=='car'?0:(km==null||fuel.value==null?null:km/x.economy*fuel.value);
 var stay=x.stay*Math.max(0,x.days-1),food=x.food*x.days*x.people,other=140*x.days*x.people;
 var known=stay+food+other+(petrol||0);
 return {km:km,fuel:fuel,petrol:petrol,stay:stay,food:food,other:other,known:known,per:known/x.people,complete:(x.vehicle==='car'?petrol!==null:false),unknownTransport:x.vehicle!=='car'};
}
function summaryWarning(trip){
 var bits=[];
 if(trip.input.days<trip.input.destinations.length)bits.push('จำนวนวันน้อยกว่าจำนวนเมือง บางเมืองอาจยังไม่ได้จัดจุดเที่ยว');
 if(trip.unknown.length)bits.push('พื้นที่ที่ยังไม่มีชุดสถานที่อ้างอิง: '+trip.unknown.join(', ')+' — ไม่สร้างชื่อสถานที่ขึ้นเอง');
 if(trip.kmEstimate==null&&trip.input.manualKm==null)bits.push('ไม่ทราบพิกัดกลางเมืองทุกช่วง: กรุณากรอกระยะขับจริงเพื่อคำนวณค่าน้ำมัน');
 if(trip.input.days===1&&norm(trip.input.origin)!==norm(trip.days[0].city))bits.push('ทริป 1 วันมีการเดินทางข้ามเมือง: ตรวจเวลาขับรถก่อนยืนยันแผน');
 if(trip.input.request.indexOf('ผู้สูงอายุ')>=0)bits.push('มีผู้สูงอายุร่วมทริป: ตรวจบันได ทางลาด และเวลาพักของแต่ละสถานที่');
 return bits;
}
function emptyIfNoTrip(){if(state.trip)return false;$('screen').innerHTML='<div class="empty"><div class="emoji">🧭</div><h2>เริ่มสร้างทริปกันเลย</h2><p>กรอกต้นทางและสถานที่ที่อยากไป แล้วกดสร้างแผนด้านบน ระบบจะจัดแผนเบื้องต้นให้</p></div>';return true;}
function mapButton(stop){
 if(stop.kind==='travel')return '<a href="'+esc(googleRoute(stop.mapFrom,stop.mapTo))+'" target="_blank" rel="noopener noreferrer">↗ เปิดเส้นทางใน Google Maps</a>';
 return '<a href="'+esc(mapSearch((stop.kind==='search'?stop.city:stop.title)+' ประเทศไทย'))+'" target="_blank" rel="noopener noreferrer">📍 เปิดสถานที่ใน Maps ↗</a>';
}
function dayButton(i){var d=state.trip.days[i];return '<button class="day-btn" type="button" data-action="day" data-index="'+i+'" aria-pressed="'+(state.day===i)+'"><small>DAY '+(i+1)+'</small><b>'+esc(d.city)+'</b><small>'+esc(d.date.split(' ').slice(0,3).join(' '))+'</small></button>';}
function stopCard(p,i){
 return '<article class="stop"><div class="stop-top"><span class="time">'+esc(p.time)+'</span><span class="tag">'+esc(p.category)+'</span></div><h4>'+esc(p.emoji+' '+p.title)+'</h4><p>'+esc(p.detail)+'</p>'+mapButton(p)+'<div class="controlrow">'+
 '<button class="mini" type="button" data-action="up" data-stop="'+i+'" '+(i===0?'disabled':'')+'>↑ ก่อนหน้า</button>'+
 '<button class="mini" type="button" data-action="down" data-stop="'+i+'" '+(i===state.trip.days[state.day].stops.length-1?'disabled':'')+'>↓ ถัดไป</button>'+
 '<button class="mini" type="button" data-action="remove" data-stop="'+i+'">ลบจุดนี้</button></div></article>';
}
function viewPlan(){
 if(emptyIfNoTrip())return;
 var t=state.trip,c=costs(t),warnings=summaryWarning(t),d=t.days[state.day];
 var warningHtml=warnings.map(function(w){return '<div class="notice">⚠️ '+esc(w)+'</div>';}).join('');
 var knownBadge=c.complete?'':' <span class="pill" style="background:#fff4e8;color:#97562d">งบยังไม่ครบทุกหมวด</span>';
 $('screen').innerHTML=
 '<div class="heading"><div><span class="light-label">YOUR PERSONAL ITINERARY · RULE-BASED MVP</span><h2>'+esc(t.input.origin)+' → '+esc(t.input.end)+'</h2><div class="small">'+esc(t.days.length)+' วัน · '+esc(t.input.people)+' คน · เริ่ม '+esc(t.days[0].date)+'</div></div><span class="pill">✦ สร้างแผนเบื้องต้นแล้ว</span></div>'+
 '<div class="stats"><div class="stat"><small>จำนวนวัน</small><b>'+t.days.length+'</b></div><div class="stat"><small>จำนวนคน</small><b>'+t.input.people+'</b></div><div class="stat"><small>งบตั้งไว้/คน</small><b>'+money(t.input.budget)+'</b></div><div class="stat"><small>ประมาณต่อคน</small><b>'+money(c.per)+'</b></div></div>'+warningHtml+
 '<div class="section-head"><h2 style="font-size:17px">ตารางเที่ยวรายวัน</h2><span class="small">แตะวันเพื่อดูรายละเอียด</span></div>'+
 '<div class="day-select">'+t.days.map(function(x,i){return dayButton(i);}).join('')+'</div>'+
 '<div class="day-title"><div style="font-size:10px;letter-spacing:1.2px;color:#b6efdb">DAY '+(state.day+1)+' / '+t.days.length+'</div><h3>'+esc(d.city)+'</h3><p>'+esc(d.date)+' · เวลาภายในวันเป็นเพียงโครงร่างที่แก้ได้</p></div>'+
 '<div class="timeline">'+d.stops.map(stopCard).join('')+'</div>'+
 '<div class="actions"><button class="btn darkbtn" data-action="save">♡ บันทึกทริป</button><button class="btn outlinebtn" data-action="share">↗ แชร์ลิงก์</button><button class="btn muted-btn" data-action="print">🖨️ พิมพ์แผน</button></div>'+
 '<div class="hint">แผนนี้ใช้ตัวจัดแผนแบบกฎ (ไม่ใช่ AI Model) และชุดข้อมูลสถานที่ตัวอย่าง ผู้ใช้ต้องตรวจสอบเวลาเปิด ค่าเข้า จุดจอดรถ และระยะทางจริงก่อนเดินทาง'+knownBadge+'</div>'+
 '<div class="panel" style="padding:17px;margin-top:16px;box-shadow:none"><label for="quickEdit" style="font-weight:700;font-size:12px">💬 ปรับแผนด้วยคำสั่งสั้น ๆ</label><textarea id="quickEdit" style="display:block;width:100%;border:1px solid #d6e7df;border-radius:10px;padding:11px;min-height:64px;margin:9px 0;font-size:12px" placeholder="เช่น เพิ่มคาเฟ่, เน้นทะเล, ลดงบ 500 บาท"></textarea><button type="button" class="btn outlinebtn" data-action="revise">ปรับแผนเบื้องต้น ↗</button><p class="small">รุ่นนี้เข้าใจเฉพาะคำสั่งที่รองรับ ยังไม่ได้เชื่อม LLM จริง</p></div>';
}
function viewExplore(){
 var t=state.trip, cities=t?[].concat(t.input.destinations):catalog.map(function(c){return c.name;});
 if(t&&cities.indexOf(t.input.end)<0)cities.push(t.input.end);
 var available=catalog.filter(function(c){return !t||cities.indexOf(c.name)>=0;});
 var cats=['ทั้งหมด','ธรรมชาติ','ทะเล','คาเฟ่','วัฒนธรรม','ครอบครัว'];
 var controls='<div class="filter-row">'+cats.map(function(x){return '<button type="button" class="filter" data-action="filter" data-type="'+esc(x)+'" aria-pressed="'+(state.filter===x)+'">'+esc(x)+'</button>';}).join('')+'</div>';
 var placeCards=[];
 available.forEach(function(city){
  city.places.forEach(function(p){
   if(state.filter!=='ทั้งหมด'&&p.category!==state.filter)return;
   placeCards.push('<article class="place"><div class="symbol">'+esc(p.emoji)+'</div><div class="tag">'+esc(city.name)+' · '+esc(p.category)+'</div><h4>'+esc(p.title)+'</h4><p>'+esc(p.detail)+'</p><a href="'+esc(mapSearch(p.title+' ประเทศไทย'))+'" target="_blank" rel="noopener noreferrer">เปิด Google Maps ↗</a>'+(t?'<div style="margin-top:12px"><button class="mini" data-action="add" data-city="'+esc(city.name)+'" data-title="'+esc(p.title)+'">+ เพิ่มในทริป</button></div>':'')+'</article>');
  });
 });
 $('screen').innerHTML='<div class="heading"><div><span class="light-label">EXPLORE PLACES</span><h2>ค้นพบที่เที่ยวทั่วไทย</h2><p class="small">สถานที่จากชุดข้อมูลตั้งต้น ไม่ใช่ผลค้นหาสดจาก Google Places</p></div></div>'+controls+
 (placeCards.length?'<div class="place-grid">'+placeCards.join('')+'</div>':'<div class="notice">ไม่มีสถานที่ในหมวดนี้จากชุดข้อมูลที่มี ลองเลือกหมวดอื่นหรือเมืองที่รองรับ</div>')+
 '<div class="hint">↗ ลิงก์สถานที่เปิดใน Google Maps เพื่อให้ตรวจพิกัด เวลาเปิด และข้อมูลล่าสุดที่ต้นทาง</div>';
}
function viewBudget(){
 if(emptyIfNoTrip())return;
 var t=state.trip, c=costs(t),b=t.input.budget,used=Math.min(100,Math.round(c.per/b*100)),labels=[];
 if(c.km!==null)labels.push((t.input.manualKm===null?'คำนวณจากระยะเส้นตรง × 1.35 + 20 กม./วัน':'ผู้ใช้กำหนดระยะทางเอง'));
 $('screen').innerHTML='<div class="heading"><div><span class="light-label">TRIP BUDGET ENGINE</span><h2>งบประมาณการเดินทาง</h2><div class="small">'+esc(t.input.people)+' คน · '+esc(t.input.days)+' วัน</div></div><span class="pill">คำนวณใหม่ทันทีตามข้อมูล</span></div>'+
 '<div class="budget-grid" style="margin-top:19px"><div class="budget-block"><small>รวมทั้งกลุ่ม (เฉพาะรายการที่คำนวณได้)</small><div class="value">'+money(c.known)+'</div></div><div class="budget-block"><small>ต่อคน (ประมาณการขั้นต่ำ)</small><div class="value">'+money(c.per)+'</div></div></div>'+
 '<div class="meter"><div style="width:'+used+'%;background:'+(c.per>b?'#d6845c':'#1f957c')+'"></div></div><div class="small">ใช้ไป '+used+'% ของงบต่อคน '+money(b)+'</div>'+
 (c.per>b?'<div class="notice">⚠️ ค่าใช้จ่ายประมาณการสูงกว่างบ '+money(c.per-b)+' ต่อคน ลองปรับจำนวนวัน ที่พัก หรือค่าอาหาร</div>':'<div class="hint">✓ ค่าใช้จ่ายส่วนที่คำนวณได้ยังไม่เกินเป้า แต่ยังไม่รวมค่าเข้า ค่าจอดรถ ค่าห้องพักจริง และรายการอื่นที่ไม่มีข้อมูลยืนยัน</div>')+
 '<div class="budgetline"><span>🏨 ที่พัก '+Math.max(0,t.input.days-1)+' คืน × '+money(t.input.stay)+'</span><b>'+money(c.stay)+'</b></div>'+
 '<div class="budgetline"><span>🍜 อาหาร '+money(t.input.food)+'/คน/วัน</span><b>'+money(c.food)+'</b></div>'+
 '<div class="budgetline"><span>🧃 ค่าเผื่อกิจกรรมและสำรอง '+money(140)+'/คน/วัน</span><b>'+money(c.other)+'</b></div>'+
 '<div class="budgetline"><span>⛽ ค่าเชื้อเพลิง '+esc(fuelLabels[t.input.fuelType])+'</span><b>'+(c.petrol===null?'ยังคำนวณไม่ได้':money(c.petrol))+'</b></div>'+
 '<div class="hint">ราคาน้ำมัน: '+esc(c.fuel.value==null?'ไม่มีราคาอ้างอิง':c.fuel.value.toFixed(2)+' บาท/ลิตร')+' · '+esc(c.fuel.source)+'<br>ระยะทาง: '+esc(c.km===null?'ยังไม่ทราบ':c.km+' กม.')+' · '+esc(labels.join(' / '))+'<br>⚠️ เป็นระยะทางเพื่อวางงบ ไม่ใช่ระยะขับถนนจาก Routing API; เปิด Google Maps ตรวจและนำระยะจริงมากรอกในฟอร์ม</div>'+
 (c.unknownTransport?'<div class="notice">กรณีเลือกเดินทางแบบอื่น ยังไม่ได้รวมค่ารถสาธารณะ/ตั๋วเดินทาง</div>':'')+
 '<div class="actions"><button class="btn outlinebtn" data-action="form">✎ ปรับค่าในแบบฟอร์ม</button><button class="btn darkbtn" data-action="share">↗ แชร์ทริป</button></div>';
}
var STORE='atlasgo-demo-trips-v1';
function saved(){try{var v=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(v)?v:[];}catch(e){return[];}}
function saveNow(){if(!state.trip)return;try{var items=saved();var copy=JSON.parse(JSON.stringify(state.trip));copy.savedAt=new Date().toISOString();copy.id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);items.unshift(copy);localStorage.setItem(STORE,JSON.stringify(items.slice(0,15)));warn('บันทึกไว้ในเบราว์เซอร์เครื่องนี้แล้ว');}catch(e){warn('บันทึกไม่สำเร็จ กรุณาตรวจพื้นที่จัดเก็บเบราว์เซอร์');}}
function viewSaved(){
 var all=saved();
 $('screen').innerHTML='<div class="heading"><div><span class="light-label">YOUR TRIP LIBRARY</span><h2>ทริปที่บันทึก</h2><div class="small">เก็บเฉพาะในเบราว์เซอร์เครื่องนี้ ยังไม่ซิงก์กับบัญชีหรือ Cloud</div></div></div>'+
 (all.length?'<div style="margin-top:20px">'+all.map(function(t,i){return '<div class="saved-item"><div><b>'+esc(t.input.origin)+' → '+esc(t.input.end)+'</b><small>'+esc(t.input.days)+' วัน · '+esc(t.input.people)+' คน · '+esc(t.input.start)+'</small></div><div class="actions" style="margin:0"><button data-action="loadSaved" data-index="'+i+'">เปิด</button><button data-action="deleteSaved" data-index="'+i+'">ลบ</button></div></div>';}).join('')+'</div>':'<div class="empty"><div class="emoji">♡</div><h2>ยังไม่มีทริปที่บันทึก</h2><p>สร้างแผนเที่ยวแล้วกด “บันทึกทริป” เพื่อกลับมาเปิดในอุปกรณ์นี้ได้อีกครั้ง</p></div>')+
 '<div class="hint">ข้อมูลจะหายหากล้างข้อมูลเว็บไซต์ เปลี่ยนเครื่อง หรือใช้โหมดไม่ระบุตัวตน เวอร์ชันถัดไปจะรองรับบัญชีและฐานข้อมูล Cloud</div>';
}
function setTab(tab){
 if(['plan','explore','budget','saved'].indexOf(tab)<0)return;
 state.tab=tab;
 document.querySelectorAll('[data-tab]').forEach(function(el){el.setAttribute('aria-selected',String(el.dataset.tab===tab));});
 document.querySelectorAll('[data-mobile]').forEach(function(el){if(el.dataset.mobile===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
 if(tab==='plan')viewPlan();if(tab==='explore')viewExplore();if(tab==='budget')viewBudget();if(tab==='saved')viewSaved();
}
function useTrip(t){
 if(!t||!t.input||!Array.isArray(t.days))return;
 state.trip=t;state.day=0;updateForm(t.input);setTab('plan');
}
function updateForm(x){
 ['origin','end','start','people','budget','vehicle','fuelType','economy','stay','food','request'].forEach(function(k){
  var el=$(k==='end'?'endCity':k==='start'?'startDate':k);if(el&&x[k]!==undefined)el.value=x[k];
 });
 $('destinations').value=(x.destinations||[]).join(', ');
 $('days').value=x.days||5;
 $('km').value=x.manualKm==null?'':x.manualKm;
 document.querySelectorAll('.style').forEach(function(el){el.setAttribute('aria-pressed',String((x.styles||[]).indexOf(el.dataset.style)>=0));});
}
function share(){
 if(!state.trip)return;
 var payload={v:1,input:state.trip.input};
 try{
  var bytes=new TextEncoder().encode(JSON.stringify(payload));var str='';
  bytes.forEach(function(c){str+=String.fromCharCode(c);});
  var b64=btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  var url=location.origin+location.pathname+'?trip='+b64;
  if(url.length>7000)throw Error('link too long');
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){warn('คัดลอกลิงก์แชร์แล้ว');}).catch(function(){showShare(url);});}
  else showShare(url);
 }catch(e){warn('สร้างลิงก์ไม่สำเร็จ: '+e.message);}
}
function showShare(url){$('screen').insertAdjacentHTML('afterbegin','<div class="share-box">คัดลอกลิงก์นี้เพื่อแชร์ (ใครมีลิงก์จะดูข้อมูลที่คุณกรอกได้):<br><input aria-label="ลิงก์แชร์ทริป" style="width:100%" readonly value="'+esc(url)+'" onclick="this.select()"></div>');}
function findPlace(city,title){var c=findCity(city);return c&&c.places.find(function(p){return p.title===title;});}
function revise(){
 var ta=$('quickEdit');if(!ta)return;
 var request=ta.value.trim();if(!request){warn('กรุณาพิมพ์คำสั่งที่ต้องการ');return;}
 var x=JSON.parse(JSON.stringify(state.trip.input)),changed=false;
 if(/คาเฟ่/.test(request)){if(x.styles.indexOf('คาเฟ่')<0)x.styles.unshift('คาเฟ่');changed=true;}
 if(/ทะเล/.test(request)){x.styles=['ทะเล'].concat(x.styles.filter(function(s){return s!=='ทะเล';}));changed=true;}
 if(/ธรรมชาติ/.test(request)){x.styles=['ธรรมชาติ'].concat(x.styles.filter(function(s){return s!=='ธรรมชาติ';}));changed=true;}
 if(/วัด|วัฒนธรรม/.test(request)){x.styles=['วัฒนธรรม'].concat(x.styles.filter(function(s){return s!=='วัฒนธรรม';}));changed=true;}
 var less=request.match(/(?:ลดงบ|ประหยัด)(?:ลง|อีก)?\s*(\d{2,6})/);
 if(less){x.budget=Math.max(100,x.budget-Number(less[1]));changed=true;}
 var more=request.match(/เพิ่ม\s*(\d+)\s*วัน/);
 if(more){x.days=Math.min(10,x.days+Number(more[1]));changed=true;}
 if(/ชิล|พักผ่อน/.test(request)){x.styles=['ทะเล','ธรรมชาติ'];changed=true;}
 var order=request.match(/([^ ,]+)\s*ก่อน\s*([^ ,]+)/);
 if(order){var a=labelCity(order[1]),b=labelCity(order[2]);var ia=x.destinations.indexOf(a),ib=x.destinations.indexOf(b);
 if(ia>=0&&ib>=0&&ia>ib){x.destinations.splice(ia,1);x.destinations.splice(ib,0,a);changed=true;}
 }
 if(!changed){warn('ยังไม่เข้าใจคำสั่งนี้ รุ่นทดลองรองรับ เพิ่มคาเฟ่, เน้นทะเล, ลดงบ 500, เพิ่ม 1 วัน, A ก่อน B');return;}
 x.request=request;useTrip(makeTrip(x));warn('ปรับแผนตามกฎที่รองรับแล้ว กรุณาตรวจสอบอีกครั้ง');
}
function addPoi(city,title){
 var p=findPlace(city,title);if(!p||!state.trip)return;
 var day=state.trip.days[state.day];
 if(day.stops.some(function(s){return s.title===title;})){setTab('plan');warn('มีจุดนี้อยู่ในวันที่เลือกแล้ว');return;}
 var item=Object.assign({},p,{kind:'poi',time:'เลือกเวลาเอง'});
 day.stops.push(item);setTab('plan');warn('เพิ่ม '+title+' ในวันที่ '+(state.day+1)+' แล้ว');
}
function handleScreen(event){
 var btn=event.target.closest('button[data-action]');if(!btn)return;
 var action=btn.dataset.action,i=Number(btn.dataset.index),stopIndex=Number(btn.dataset.stop);
 if(action==='day'&&state.trip){state.day=i;viewPlan();}
 if(['up','down','remove'].indexOf(action)>=0&&state.trip){
  var stops=state.trip.days[state.day].stops;
  if(action==='remove'){stops.splice(stopIndex,1);}
  else{var other=stopIndex+(action==='up'?-1:1);if(other>=0&&other<stops.length){var swap=stops[other];stops[other]=stops[stopIndex];stops[stopIndex]=swap;}}
  viewPlan();warn('อัปเดตตารางแล้ว (ควรตรวจเวลาเดินทางอีกครั้ง)');
 }
 if(action==='save')saveNow();
 if(action==='share')share();
 if(action==='print')window.print();
 if(action==='revise')revise();
 if(action==='filter'){state.filter=btn.dataset.type;viewExplore();}
 if(action==='add')addPoi(btn.dataset.city,btn.dataset.title);
 if(action==='form')$('tripForm').scrollIntoView({behavior:'smooth',block:'start'});
 if(action==='loadSaved'){var o=saved()[i];if(o)useTrip(o);}
 if(action==='deleteSaved'){var all=saved();all.splice(i,1);localStorage.setItem(STORE,JSON.stringify(all));viewSaved();}
}
function readLink(){
 try{
  var b64=new URLSearchParams(location.search).get('trip');if(!b64||b64.length>5500)return;
  var decoded=atob(b64.replace(/-/g,'+').replace(/_/g,'/'));
  var bytes=Uint8Array.from(decoded,function(x){return x.charCodeAt(0);});
  var p=JSON.parse(new TextDecoder().decode(bytes));
  if(!p||p.v!==1||!p.input||!Array.isArray(p.input.destinations))return;
  var x=p.input;
  if(x.destinations.length>8||x.days<1||x.days>10||!x.origin||!x.start||!/^\d{4}-\d\d-\d\d$/.test(x.start))return;
  x.request=String(x.request||'').slice(0,400);x.destinations=x.destinations.map(function(z){return String(z).slice(0,80);});x.origin=String(x.origin).slice(0,100);x.end=String(x.end||'').slice(0,100);
  x.days=bounded(x.days,1,10);x.people=bounded(x.people,1,30);x.budget=bounded(x.budget,100,1000000);
  x.stay=bounded(x.stay,0,300000);x.food=bounded(x.food,0,10000);x.economy=bounded(x.economy,2,50);
  x.styles=Array.isArray(x.styles)?x.styles.filter(function(st){return ['ธรรมชาติ','ทะเล','คาเฟ่','วัฒนธรรม','ครอบครัว'].indexOf(st)>=0;}):[];
  useTrip(makeTrip(x));warn('เปิดข้อมูลทริปจากลิงก์แชร์แล้ว');
 }catch(err){console.warn('Cannot read shared trip',err);}
}
function init(){
 $('startDate').value=startISO();
 document.querySelectorAll('.style').forEach(function(b){b.addEventListener('click',function(){b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));});});
 $('tripForm').addEventListener('submit',function(e){e.preventDefault();try{state.trip=makeTrip(getInput());state.day=0;setTab('plan');if(window.innerWidth<751)$('workspace').scrollIntoView({block:'start',behavior:'smooth'});warn('สร้างแผนเบื้องต้นแล้ว');}catch(err){warn(err.message);}});
 document.querySelectorAll('[data-tab]').forEach(function(b){b.addEventListener('click',function(){setTab(b.dataset.tab);});});
 document.querySelectorAll('[data-mobile]').forEach(function(b){b.addEventListener('click',function(){setTab(b.dataset.mobile);$('workspace').scrollIntoView({behavior:'smooth',block:'start'});});});
 document.querySelectorAll('[data-goto]').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();setTab(b.dataset.goto);$('workspace').scrollIntoView({behavior:'smooth',block:'start'});});});
 $('screen').addEventListener('click',handleScreen);
 setTab('plan');
 fetch('../trip-huahin-2026/fuel-prices.json?ts='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('No fuel data');return r.json();}).then(function(d){if(d&&d.provider==='BCP'&&d.prices&&/^\d{4}-\d\d-\d\d$/.test(d.asOf)){state.fuel=d;if(state.trip&&state.tab==='budget')viewBudget();}}).catch(function(){console.info('Fuel data unavailable; fallback reference values used');});
 readLink();
}
document.addEventListener('DOMContentLoaded',init);
})();