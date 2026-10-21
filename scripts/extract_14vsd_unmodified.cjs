/** Byte-for-byte extraction of the original system satellite raster previews.
 * No resampling, recoloring, recompression, cropping, overlay, or image libraries. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const data = JSON.parse(fs.readFileSync("docs/data/full_preview_part_2.json","utf8"));
const dest = "docs/reports/original_14VSD_satellite";
fs.mkdirSync(dest,{recursive:true});
const requests = [
 ["2026-08-03","true_color","S2_14-VSD_20260803_RGB432.jpg","image/jpeg"],
 ["2026-08-03","false_color","S2_14-VSD_20260803_RGB843.jpg","image/jpeg"],
 ["2026-08-03","mndwi","S2_14-VSD_20260803_MNDWI.png","image/png"],
 ["2026-09-29","mndwi","S2_14-VSD_20260929_MNDWI.png","image/png"],
 ["2026-10-07","mndwi","S2_14-VSD_20261007_MNDWI.png","image/png"],
];
const manifest = {
 title:"Unmodified satellite preview files extracted byte-for-byte from the monitoring system",
 source:"docs/data/full_preview_part_2.json",
 plot:"14-VSD",
 preservation:"Original encoded image bytes preserved; no image transformations. GIS PDD outline deliberately not burned in.",
 files:[]
};
for(const [date,mode,name,media] of requests){
 const matches=data.layers.filter(x=>x.plot==="14-VSD"&&x.date===date&&x.mode===mode);
 if(matches.length!==1)throw Error("Expected exactly one source image for "+date+" "+mode+", got "+matches.length);
 const record=matches[0];
 const [meta,base64]=record.src.split(";base64,");
 if(meta!=="data:"+media||!base64||!(/^[A-Za-z0-9+/]+={0,2}$/.test(base64)))throw Error("Invalid original data URI "+name);
 const bytes=Buffer.from(base64,"base64");
 if(bytes.toString("base64")!==base64)throw Error("Source is not canonical base64 "+name);
 if(media==="image/jpeg"&&!(bytes[0]===0xff&&bytes[1]===0xd8))throw Error("Not JPEG "+name);
 if(media==="image/png"&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error("Not PNG "+name);
 const out=path.join(dest,name);
 fs.writeFileSync(out,bytes);
 if(!fs.readFileSync(out).equals(bytes))throw Error("Byte-for-byte extraction verification failed "+name);
 manifest.files.push({
   name,path:out,date,mode,media,width_px:record.width,height_px:record.height,
   original_source_suffix:record.source_suffix,
   bytes:bytes.length,
   sha256:crypto.createHash("sha256").update(bytes).digest("hex")
 });
 console.log("EXACT",name,bytes.length+"B",manifest.files.at(-1).sha256);
}
fs.writeFileSync(path.join(dest,"manifest.json"),JSON.stringify(manifest,null,2)+"\n","utf8");
console.log("PASS: all 5 original image files extracted and hash-verified without processing.");
