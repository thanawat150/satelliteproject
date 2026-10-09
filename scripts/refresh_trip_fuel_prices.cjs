#!/usr/bin/env node
/**
 * Refresh the coastal family trip's fuel-price cache from Bangchak's public API.
 * Keeps the last verified dataset if the provider is unreachable or changes its schema.
 * No API key needed. Node.js 20+.
 */
const fs = require("node:fs/promises");
const path = require("node:path");

const TARGET = path.join(process.cwd(), "docs/trip-huahin-2026/fuel-prices.json");
const ENDPOINT = "https://oil-price.bangchak.co.th/ApiOilPrice2/thai";
const LABELS = {
  gasohol95: ["แก๊สโซฮอล์ 95 S EVO"],
  gasohol91: ["แก๊สโซฮอล์ 91 S EVO"],
  e20: ["แก๊สโซฮอล์ E20 S EVO"],
  e85: ["แก๊สโซฮอล์ E85 S EVO"],
  dieselB7: ["ไฮดีเซล S"],
  premiumDiesel: ["ไฮพรีเมียมดีเซล S"]
};
function thaiDateToISO(input) {
  const text = String(input || "").trim();
  const parts = text.split("/");
  if (parts.length !== 3) throw Error("Invalid Thai date: " + text);
  const [day, month, year] = parts.map(Number);
  const yyyy = year > 2400 ? year - 543 : year;
  const date = new Date(Date.UTC(yyyy, month - 1, day));
  if (!Number.isFinite(date.getTime()) || date.getUTCDate() !== day ||
      date.getUTCMonth() !== month - 1 || yyyy < 2020) throw Error("Invalid price effective date");
  return date.toISOString().slice(0,10);
}
function validPrice(value) {
  const n=typeof value === "number"?value:Number(String(value).trim());
  return Number.isFinite(n) && n >= 10 && n <= 150 ? Number(n.toFixed(2)) : null;
}
async function run() {
  const existing = JSON.parse(await fs.readFile(TARGET, "utf8"));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  let response;
  try {
    response=await fetch(ENDPOINT,{
      signal:controller.signal,
      headers:{"Accept":"application/json","User-Agent":"CoastalTripFuelPrices/1.0"}
    });
  } finally {clearTimeout(timer);}
  if (!response.ok) throw Error("Fuel API HTTP " + response.status);
  const payload=await response.json();
  if (!Array.isArray(payload) || !payload[0]) throw Error("Unexpected API payload");
  const root=payload[0];
  const oils=typeof root.OilList==="string"?JSON.parse(root.OilList):root.OilList;
  if (!Array.isArray(oils) || !oils.length) throw Error("Missing oil list");
  const prices={};
  for(const [key,markers] of Object.entries(LABELS)) {
    const found=oils.find(x=>markers.some(marker=>String(x.OilName||"").includes(marker)));
    const n=found ? validPrice(found.PriceToday):null;
    if(n!==null) prices[key]=n;
  }
  if(Object.keys(prices).length<4 || !prices.gasohol95 || !prices.dieselB7) {
    throw Error("Insufficient valid fuel grades returned: " + JSON.stringify(prices));
  }
  const asOf=thaiDateToISO(root.OilPriceDate);
  const todayTH=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  // Some providers publish an effective date one day ahead. Show source date in UI, never silently claim "today".
  const daysDiff=Math.abs((new Date(asOf+"T00:00:00Z")-new Date(todayTH+"T00:00:00Z"))/86400000);
  if(daysDiff>7) throw Error("Oil prices date is stale/future by over 7 days: "+asOf);
  const updated={
    schemaVersion:1,
    provider:"BCP",
    providerName:"บางจาก",
    source:ENDPOINT,
    sourceKind:"live-provider-api",
    asOf,
    checkedAt:new Date().toISOString(),
    updateStatus:"live",
    note:"ราคาประมาณการอ้างอิงน้ำมันบางจาก; ราคาแต่ละสถานีหรือจังหวัดอาจแตกต่าง โปรดตรวจสอบก่อนเติม",
    unit:"THB/L",
    prices
  };
  if(JSON.stringify(updated.prices)!==JSON.stringify(existing.prices)||
     updated.asOf!==existing.asOf||
     existing.updateStatus!=="live"||
     existing.source!==ENDPOINT){
      await fs.writeFile(TARGET,JSON.stringify(updated,null,2)+"\n","utf8");
      console.log("Updated "+TARGET+" effective "+asOf+" "+JSON.stringify(prices));
  }else{
      console.log("No price change; last effective date "+asOf);
  }
}
run().catch(error=>{console.error("Fuel prices refresh failed; existing verified data preserved:",error.message);process.exitCode=1;});
