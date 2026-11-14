# เปิดใช้งาน Email Login — Ken Affiliate Studio v6.1

เว็บไซต์นี้แสดงหน้าล็อกอินอีเมลเมื่อมี **Supabase Project ที่แยกจากระบบป่าไม้** เชื่อมอยู่เท่านั้น ระหว่างที่ยังไม่มีโปรเจกต์ ระบบทำงานแบบ Local-only และแสดงสถานะจริง ไม่มีการส่งเมลจำลอง

1. เลือก Organization/อนุมัติการสร้าง Supabase Project ใหม่และตรวจค่าใช้จ่ายกับเจ้าของบัญชี
2. ตั้งค่าฐานข้อมูลและ RLS ด้วย `supabase/schema.sql` โดยยืนยันว่าคำสั่งรันบนโปรเจกต์ Affiliate เท่านั้น
3. Supabase Auth → Providers → Email: เปิดใช้งาน Email sign-in/Magic Link; Auth → URL Configuration ตั้ง Site URL และ Redirect URL ให้ตรงกับ `https://thanawat150.github.io/satelliteproject/affiliate-studio/` (ทั้งลิงก์ลงท้าย `/`)
4. เปิด SMTP ภายนอกที่เชื่อถือได้เพื่อใช้ส่งเมลจริง เพราะ Built-in SMTP จำกัดผู้รับและปริมาณการส่ง ไม่เหมาะใช้งานจริง
5. ใส่ URL และ Publishable Key (ไม่ใช่ Secret/Service role) ใน `config.js` จากนั้น deploy ขึ้น GitHub Pages
6. เข้าเว็บ กรอกอีเมล → คลิกส่ง → กดลิงก์ในกล่องจดหมาย → ระบบเข้าสู่หน้าสร้างคลิปและ Sync Workspace ผ่าน RLS
7. ทดลองบน Chrome และมือถือ และตรวจสอบว่าบัญชีคนละอีเมลอ่านข้อมูลกันไม่ได้

**สำคัญ**: การเข้าผ่านอีเมลไม่ได้เชื่อม TikTok Shop/Shopee ให้อัตโนมัติ ต้องอนุญาตแยกตาม API ของแต่ละแพลตฟอร์ม

References: https://supabase.com/docs/guides/auth/auth-email-passwordless ; https://supabase.com/docs/guides/auth/auth-smtp