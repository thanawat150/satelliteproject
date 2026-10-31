# AFFILIATE LAB — Master Project Context / Integration Inventory

ตรวจและรวบรวม: 11 ตุลาคม 2026 (Asia/Bangkok)  
Source of truth: **โค้ดและการเชื่อมต่อที่ตรวจได้จริง** ไม่ใช่ข้อความใน README เพียงอย่างเดียว  
Repository หลัก: https://github.com/thanawat150/satelliteproject

> เอกสารนี้เป็น handoff context สำหรับเริ่มแชตใหม่/ส่งงานต่อ Dev โดยไม่ต้องอธิบายระบบทั้งหมดอีกครั้ง  
> **ห้ามสรุปว่าสร้าง/เชื่อม/โพสต์สำเร็จจากการมีไฟล์ โค้ด ปุ่ม หรือ Deployment เพียงอย่างเดียว** ต้องตรวจผลลัพธ์จริง

## A. เป้าหมายระบบและขอบเขตที่ต้องแยกกัน

**2 สายงานที่ห้ามปนกัน**
1. **Affiliate Sales** — TikTok Affiliate (TikTok ขาย) + Shopee Video; สถานะการใช้คลิปแยก 2 แพลตฟอร์ม โดยคลิปถือว่าใช้ครบเมื่อโพสต์ทั้งคู่แล้วจริง ผู้ใช้โพสต์และติดตะกร้าด้วยตัวเองจนกว่าจะพิสูจน์ Official API flow ได้
2. **Organic Content / Ken Monitoring** — Facebook Page Reels, Instagram Reels, TikTok คอนเทนต์ และ YouTube Shorts ผ่านตาราง Metricool; ไม่ใช่ TikTok Affiliate

แหล่งวิดีโอเดียวกัน ≠ ไฟล์เผยแพร่เวอร์ชันเดียวกัน: ต้องแยก Master Drive, Media URL ที่ตั้งโพสต์แต่ละแพลตฟอร์ม, Export/Final และ Content ID

## B. โมดูลที่มีอยู่และสถานะการเชื่อมต่อ

| โมดูล / งานที่เคยทำ | ที่อยู่ / หลักฐาน | ที่ทำได้ / มีอยู่ | ช่องว่างในการเชื่อม |
|---|---|---|---|
| Affiliate Posting Dashboard | [GitHub Pages](https://thanawat150.github.io/satelliteproject/affiliate-posting/), \`docs/affiliate-posting/index.html\` | ตาราง/เวลา/คลิป, ลิงก์แยก, แคปชั่น/Title แพลตฟอร์ม, ปุ่มยืนยันโพสต์ | สถานะ Affiliate และ manual content อยู่ใน **localStorage เครื่องนั้น** ไม่ซิงก์ LINE/Database/อุปกรณ์อื่น |
| Affiliate Schedule / Inventory | \`docs/affiliate-posting/{schedule.json,metricool-schedule.json,content-ready.json,history.json,queue.json}\` | Snapshot ตารางและไฟล์อ้างอิง | เป็นไฟล์ใน GitHub ไม่ใช่การซิงก์สด; \`queue.json\` เคยค้างวันที่ 10 ต.ค.; อย่าใช้แทนคิววันนี้ |
| LINE Affiliate Bot | \`line-affiliate-bot/\` + Vercel Project \`satelliteproject-line-affiliate-bot\` | LINE webhook, คำสั่ง วันนี้/พรุ่งนี้/ตาราง/ส่ง/สถานะ/แยก IG FB TikTok YouTube, morning cron | ยังไม่มีการยืนยันตอบกลับ LINE E2E ล่าสุด; status Checklist Vercel Blob แยกจากสถานะ Dashboard; ต้องตรวจ cron/LINE push จริง |
| Vercel backend | https://satelliteproject-line-affiliate-bot.vercel.app | Production deploy จาก \`main\`, REST handlers | deployment จาก \`gh-pages\` บางครั้ง ERROR; READY ไม่พิสูจน์ว่า LINE ส่งจริง |
| Google Drive / Media library | โฟลเดอร์ \`ขายของ\`, \`พร้อม\`, \`Video Cut\`, Ken Monitoring และ character assets | มีวิดีโอ master, วิดีโอพร้อม, scene/storyboard/thumbnail, character refs | **ยังไม่ใช่ระบบ inventory กลางที่ตรวจเนื้อหาทุกคลิป**; File ID/name ตรงไม่ได้พิสูจน์ว่าสินค้าตรง |
| Metricool | Brand ID **7218456**, timezone **Asia/Bangkok** | มีการเชื่อม Facebook, Instagram, TikTok คอนเทนต์, YouTube; อ่านตารางจาก connector ได้ | GitHub ใช้ \`metricool-schedule.json\` เป็น snapshot ไม่ใช่ API สด; ERROR/PENDING != โพสต์สำเร็จ |
| Ken Lab — Character Studio | \`docs/ken-lab/affiliate-studios.js\` | เครื่องมือหน้าตัวละครและ character profiles; ใช้ Production Wizard ร่วมกันภายในเว็บ | ไม่มีการซิงก์ character master/approval/asset revision แบบส่วนกลางไป Drive/Studio/VideoCut |
| Ken Lab — Script Studio | \`docs/ken-lab/affiliate-studios.js\` | สคริปต์เสียงไทย โทน/Hook/CTA หลายแบบ, เลือกบทใช้ใน Storyboard | ไม่ส่งข้อมูลโดยตรงไปผู้ผลิตวิดีโอหรือ LINE/Publishing queue |
| Ken Lab — Storyboard Studio | \`docs/ken-lab/affiliate-studios.js\` | คิด Storyboard แบบรายช็อตและรับบทจาก Script Studio | ไม่มี Image Generation job/การตรวจ Approved Shot เชื่อมกลับคลังไฟล์ |
| Ken Lab — Video Prompt Studio | \`docs/ken-lab/affiliate-studios.js\`, \`affiliate-prompt-pack.js\` | Prompt รายช็อต, Export/Copy, ชุด Prompt **6 ขั้นตอน**: Character → FullBody Master → Plan → Storyboard → Scene-only → Video | **สร้าง Prompt ไม่ใช่เรียก Flow/Meta API จริง**; ต้องนำไฟล์ที่ผลิตได้กลับเข้าคลังเอง |
| Ken Lab — Production Wizard | \`docs/ken-lab/production-wizard.js\` | เก็บโปรเจกต์/ตัวละครหลัก-รอง/ช็อต/Prompt (local-first) | เชื่อมกับ Studios ภายใน browser แล้ว แต่ **ยังไม่รวมฐานข้อมูลกับ Affiliate Studio, Publisher, LINE** |
| Ken Lab — Product Script Factory | \`docs/ken-lab/product-factory.js\` | เตรียมข้อมูลสินค้า/สคริปต์/Prompt | มีทางนำข้อมูลบางส่วนไป Shopee Publisher ผ่าน localStorage บน origin เดียวกัน; ยังไม่ใช่ Product Registry/verified source กลาง |
| Ken Lab — Shopee Publisher | \`docs/ken-lab/shopee-publisher.js\` | เตรียม MP4/Caption/สินค้า, manual posting queue, ICS reminder, ตรวจลิงก์โพสต์, metrics กรอกเอง | **Assisted Publishing เท่านั้น**; ไม่อัปโหลด/ติดตะกร้า Shopee ผ่าน API และไม่ซิงก์แดชบอร์ดกลาง |
| Standalone Shopee Publisher | \`docs/shopee-publisher/\` | UI dashboard/library/compose/calendar/performance, บันทึก MP4 ใน IndexedDB เฉพาะเครื่อง | อีกแอปหนึ่ง ไม่ใช่บัญชี Shopee API จริง; ต้องตัดสินใจควบรวม/เลิกซ้ำก่อนพัฒนาเพิ่ม |
| Affiliate AI Studio | https://thanawat150.github.io/satelliteproject/affiliate-studio/ และ \`docs/affiliate-studio/\` | Product import/verification gate, Ranking, Characters, Campaign drafts, AI Director, Metrics CSV, Audit, Auth UI | **แยกจาก Ken Lab และ Posting Dashboard**; ห้ามสมมติว่าข้อมูลแชร์กันหมด |
| Supabase — Affiliate | Project ref **pdgnkcbhbryawyekeckt** | Project ACTIVE_HEALTHY, ตาราง \`source_clips\`, \`creatives\`, \`publish_jobs\`, \`workspace_data\`, \`products\`, \`platform_accounts\`, \`line_checklists\` ฯลฯ; Edge Functions \`ai-director\`, \`ken-product-ai\` ACTIVE | มีตาราง/ฟังก์ชันจริงแต่ไม่ได้หมายความว่าทุก workflow ใช้งานแล้ว; \`platform_accounts\` และ \`line_checklists\` ไม่มีแถว ณ เวลาตรวจ; ต้องทดสอบ Auth/RLS/Function/งานคิวรายเส้นทาง |
| Google Login / Gmail / Gemini | \`docs/affiliate-studio/config.js\`, setup docs และ Supabase Edge Functions | มี Supabase URL/publishable key, AI functions; แนวทาง Google OAuth/Gmail | \`googleClientId\` ฝั่งหน้าเว็บยังว่างขณะตรวจ; Google OAuth/Gmail ไม่ถือว่าเชื่อมพร้อมใช้ แม้ AI Function deploy แล้ว |
| Google Flow / Veo 3.x | Workflow ที่ผู้ใช้ใช้สร้างคลิป พร้อม Script, Storyboard, Character Reference | ใช้ผลิตวิดีโอ/ช็อตภายนอกด้วยตนเอง | ไม่มี backend orchestration สำหรับ Flow/การเก็บ job/result กลับ Drive, ไม่มี end-to-end render sync |
| Meta AI | ทำคลิป/ทดลองฉากจากพรอมต์ | เป็นช่องทาง manual production อีกทาง | ไม่มีการดึง output เข้า Asset Registry หรือ Publisher อัตโนมัติ |
| AutoCut Studio / VideoCut | https://github.com/thanawat150/VideoCut | แอป Windows .NET/WPF, FFmpeg/Whisper, highlights/captions/silence removal, workflow node, Script-to-Video/Export ตามซอร์สและ README | **คนละ Repository และยังไม่เชื่อม**กับ Affiliate Lab, Supabase, Google Drive inventory, LINE, Metricool; Windows build/packaging/CI/ทดสอบโปรแกรมจริงต้องยืนยันอีกครั้ง |
| Ken Monitoring Motion pipeline | งาน React/Remotion/SVG + เสียงพากย์ที่เคยทำสำหรับ EP/Teaser | แบรนด์คอนเทนต์แยกจากสินค้า เช่น EP01/EP02 และคู่หูสาย GIS | Render Asset, Script, Thumbnail, VO, Publish Status ยังไม่มี Content Registry/ระบบตรวจ QC กลาง |
| Analytics / Commission | Metricool analytics บางส่วน; ฟอร์ม metrics Shopee Publisher; Metrics CSV ใน Affiliate Studio | สามารถเก็บ/นำเข้าข้อมูลบางแหล่งหรือกรอกด้วยตัวเอง | ยังไม่มี Verified Analytics/Order/Commission Sync รายโพสต์เชื่อม TikTok/Shopee และฐานข้อมูลกลาง |

## C. Asset / Character / Product ที่ผู้ใช้เคยทำ แต่ยังไม่อยู่ใน Media/Content Registry เดียวกัน

- **ตัวละคร AI:** ป๋าเคน (ชายไทย 25 ใส่แว่น ผิวแทน ลุคออฟฟิศ), น้องสำลี (หญิงไทย 23 ออฟฟิศ), น้องเมย์ (หญิงไทยวัยต้น 20/แนวขายของ) มีมาสเตอร์/Prompt/ฉากที่เคยใช้งาน; อ้างอิงรูปจาก Drive แล้วตรวจสิทธิ์และเวอร์ชันก่อน generation
- **คอนเทนต์ขาย:** เก้าอี้มหัศจรรย์คุณตาแสวง, ครีมกันแดดศิริราช, ลู่วิ่ง D5-Pro (มีชุดคลิป/ช็อตตัดแยกหลายแบบที่เคยหารือ); ห้ามตีความสินค้าในวิดีโอจากชื่อไฟล์ เช่น \`ป๋าเคน5.mp4\` เท่านั้น
- **คอนเทนต์ตัดคลิป:** วิดีโอ \`โต๊ะขาว\` และงาน Highlight/9:16/การปรับ narrative ที่เคยลอง; อาจยังต้อง QA เรื่องเนื้อหาค้างคา
- **Ken Monitoring:** INTRO/PROMO, EP01 ทำไมต้นไม้แดงในภาพดาวเทียม, EP02 ดาวเทียมรู้ได้ไงว่าตรงไหนเป็นน้ำ, Teaser/Reveal คู่หู GIS และ motion graphics ร่วมกับ Thai voiceover; แยกคิวจาก Affiliate
- **Creative deliverables:** Character Master, Shot Storyboard, Scene-only asset, Video clip, VO, Thumbnail, Caption/Hashtag, Product link, Download link, ตะกร้าสินค้า, Scheduled Slot, Actual Post URL, QC/Approval, Analytics ยังไม่อยู่ในชุด record เดียวกัน
- **คอนเทนต์/คลิปบางรายการมีอยู่ใน Drive แต่ยังไม่ตั้งเวลา, บางรายการตั้งเวลาแล้วแต่ Metricool โพสต์ ERROR, บางรายการอยู่ใน ready folder โดยยังไม่ได้ยืนยันเนื้อหา** ต้องตรวจทีละ asset ก่อนจัดใหม่

## D. Data ownership และความจริงของสถานะ

- GitHub Pages = Static Web; browser localStorage ≠ Supabase ≠ Vercel Blob
- \`schedule.json\` = Affiliate plan; \`metricool-schedule.json\` = Metricool snapshot
- \`queue.json\` เก่า ไม่ใช้เป็นแหล่งที่มาว่า “คลิปวันนี้” โดยไม่ตรวจวันที่
- Metricool \`PENDING\`, \`ERROR\` หรือการมี scheduled task ไม่ใช่หลักฐานการเผยแพร่จริง
- LINE Checklist = ผู้ใช้ยืนยันจาก LINE, เก็บที่ Vercel Blob; แยกจาก TikTok/Shopee checkboxes ในเว็บ
- รูป/คลิปใน Drive = มีไฟล์ แต่ยังไม่ยืนยัน platform-ready/approved/product match
- Shopee/TikTok Affiliate ติดตะกร้า/โพสต์จริง = ต้องยืนยันเองหรือผ่าน Official API ที่ได้รับสิทธิ์จริง
- Supabase Affiliate project มีอยู่จริง แต่ไม่ได้หมายความว่าหน้าทุกเว็บใช้ DB นี้
- Credential / secret อยู่บน backend เท่านั้น ห้ามใส่ LINE Token, service_role, GEMINI_API_KEY, Social OAuth Secret ใน public static site

## E. Integration Roadmap — งานที่ยังไม่เชื่อม

1. **Asset & Product Registry กลาง (Supabase):** File ID/Drive folder, source vs final vs platform media, content type, product/character/scene, verified claims, reviewer, approved version, checksum/hash และลิงก์โพสต์
2. **เชื่อม Production:** Product Factory → Character/Script/Storyboard/Video Prompt → Flow/Meta manual job → VideoCut/Remotion output → QC → Approved Asset. อย่าอ้างว่าสั่ง Flow render ด้วย API จนกว่าจะมี integration จริง
3. **Single Source of Truth สำหรับ Schedule/Posting:** แยก TikTok ขาย / Shopee / IG / Facebook / TikTok Content / YouTube; title และ caption ต่อแพลตฟอร์ม; ในแต่ละ record มี source link, published URL, time, manual vs platform status, error reason
4. **LINE ↔ Dashboard ↔ Supabase:** ซิงก์ Checklist/การกดยืนยันโพสต์ ด้วย Authentication, idempotency, concurrency/undo และ audit log; ระวัง migrate จาก localStorage/Vercel Blob ไม่ให้สูญข้อมูล
5. **Metricool Sync:** อ่าน planned/published/error ปัจจุบันผ่าน connector/API ที่ได้รับสิทธิ์จริง; archive snapshot ที่มี timestamp; อย่าแทนที่ Manual Confirmed
6. **VideoCut Integration:** เริ่มจาก Import/Export manifest, asset folder watcher หรือ authenticated queue; ไม่ต้องแก้ตัดต่อเป็นระบบใหม่ทั้งหมด
7. **Affiliate Publishing:** Shopee/TikTok ให้เป็น assisted publishing ก่อน; Official posting + basket attachment ต้องยืนยัน API permissions, policy และทดสอบคำสั่งจริงจึงค่อยเปลี่ยนเป็น automation
8. **Analytics:** รวบรวม views, likes, clicks, orders, commission จากข้อมูลที่ผู้ใช้กรอกหรือแหล่งยืนยัน พร้อม observed_at / source / status. ไม่สร้างผลลัพธ์หรือประสิทธิภาพปลอม
9. **Usability & Quality:** Responsive mobile, สถานะที่อ่านออก, ปุ่ม Copy per platform, ชื่อคลิป YouTube/Facebook, evidence preview, duplicate check, Thai VO/เสียงสำเนียงไทย, AI labeling, การแยกของเก่าออกจาก ready inventory

## F. คำสั่ง Handoff สำหรับผู้ช่วย/Dev ทุกครั้ง

คุณคือ Senior Full-stack Developer + Content Automation Architect + Technical Product Owner ของ **Affiliate Lab**. ตรวจซอร์สจริงใน GitHub \`thanawat150/satelliteproject\` และ \`thanawat150/VideoCut\` ก่อนทุกครั้ง รวมถึง Vercel Project และ Supabase Affiliate project ที่ระบุไว้ข้างต้น. 

**ต้องทำงานต่อจากของเดิม ไม่สร้างโปรเจกต์ซ้ำโดยไม่มีเหตุผล** และต้องไม่ถามชื่อโฟลเดอร์, Repo, แพลตฟอร์ม หรือ workflow ที่มีข้อมูลอยู่ในเอกสารนี้ซ้ำ. ตรวจชื่อ/เวอร์ชัน/สิทธิ์ล่าสุดก่อนใช้จริง; หากสิ่งใดยังไม่ทราบให้ระบุความไม่แน่นอน.

วิธีตอบงานพัฒนา:
1. ตรวจว่าโมดูลที่ร้องขอมีอยู่ที่ไหน เชื่อมกับอะไร ใช้ storage ใด และอะไรยังใช้ไม่ได้
2. ระบุจุดต่างระหว่าง implementation ที่มีจริง vs feature ที่เป็น UI/template/ต้นแบบ
3. ออกแบบการเชื่อมแบบ incremental, ไม่กระทบเวิร์กโฟลว์เดิมและไม่ย้ายสถานะโดยพลการ
4. ลงมือแก้เมื่อผู้ใช้สั่ง พร้อมตรวจข้อมูล/สิทธิ์/การรักษาความปลอดภัย, ทดสอบจริง, deploy และแสดงผลผ่าน/ไม่ผ่าน
5. เมื่อรายงานสถานะ “โพสต์แล้ว”, “พร้อมขาย”, “เชื่อมแล้ว”, “ส่ง LINE สำเร็จ” ต้องมีหลักฐานจาก backend/provider/ผลลัพธ์ ไม่ใช่จากรหัส/ปุ่ม/การเดา
6. ห้ามเอา TikTok Affiliate ไปปนกับ TikTok Ken Monitoring และห้ามใช้คำบรรยายเดียวกันทุกช่องโดยไม่ตรวจเนื้อหาของคลิป

แหล่งเข้าถึง:
- GitHub: https://github.com/thanawat150/satelliteproject
- Posting: https://thanawat150.github.io/satelliteproject/affiliate-posting/
- Ken Lab: https://thanawat150.github.io/satelliteproject/ken-lab/
- Affiliate Studio: https://thanawat150.github.io/satelliteproject/affiliate-studio/
- LINE backend: https://satelliteproject-line-affiliate-bot.vercel.app
- VideoCut: https://github.com/thanawat150/VideoCut
- Drive Ready folder: https://drive.google.com/drive/folders/1kY02WlyrCcv9q13HKn2LcArrpLGGckM4

**เป้าหมายปลายทาง:** Source/Asset → Verified Product/Character → Script → Storyboard → Production → QC → Ready → Schedule → Publish per platform → Confirmed → Analytics → Optimize โดยไม่มีสถานะหรือเนื้อหาที่สร้างจากการคาดเดา
