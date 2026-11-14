/* ตั้งค่าเว็บเช็คชื่อ — แก้ไฟล์นี้ไฟล์เดียวพอ */
window.APP_CONFIG = {
  // URL ของ Apps Script Web app (ลงท้ายด้วย /exec) — เว้นว่าง = โหมดเครื่องเดียว
  GOOGLE_SCRIPT_URL: 'https://script.google.com/a/macros/foodlenoodle.com/s/AKfycbyggfNQb__PKbdIhT8lwFKL5tbt6WANXUn5inhOIkFCa5vh_ldjxWUdd2WTZM2oHpx9Qg/exec',
  // ลิงก์ Google Sheet (แสดงในหน้าผู้สอน)
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/11UUa3J447Z0pPagcKomprUBk-vChVFTF-7ccSZbhF2g/edit',
  // รหัสเข้าโหมดผู้สอน (เปิดเว็บแล้วต่อท้าย URL ด้วย #admin)
  ADMIN_PIN: '1234',
  // ดึงข้อมูลใหม่จาก Google Sheets ทุกกี่วินาที
  SYNC_SECONDS: 15
};
