/* ตั้งค่าเว็บเช็คชื่อ — แก้ไฟล์นี้ไฟล์เดียวพอ */
window.APP_CONFIG = {
  // Supabase (คีย์ publishable เปิดเผยในหน้าเว็บได้ ข้อมูลถูกป้องกันด้วย Row Level Security)
  SUPABASE_URL: 'https://ahneciasihtkicmeielx.supabase.co',
  SUPABASE_KEY: 'sb_publishable_VpiqzfFzmfZjw0uUd9u8-A_JmyTpJnn',

  // อีเมลที่แนะนำตอนกดเข้าสู่ระบบด้วย Google (สิทธิ์จริงกำหนดที่ตาราง admins ใน Supabase)
  ADMIN_LOGIN_HINT: 'production@foodlenoodle.com',

  // (ไม่บังคับ) ส่งสำเนาการเช็คชื่อไป Google Sheets ผ่าน Apps Script — เว้นว่าง = ไม่ส่ง
  GOOGLE_SCRIPT_URL: '',

  // ดึงข้อมูลใหม่ทุกกี่วินาที
  SYNC_SECONDS: 10
};
