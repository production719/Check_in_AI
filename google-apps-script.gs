/**
 * Google Apps Script สำหรับรับข้อมูลเช็คชื่อจากเว็บ แล้วบันทึกลง Google Sheet
 *
 * วิธีติดตั้ง
 * 1) สร้าง Google Sheet ใหม่ → เมนู ส่วนขยาย (Extensions) → Apps Script
 * 2) ลบโค้ดเดิมทิ้ง แล้ววางโค้ดในไฟล์นี้ทั้งหมด → กดบันทึก
 * 3) กด "การทำให้ใช้งานได้ (Deploy)" → "การทำให้ใช้งานได้รายการใหม่ (New deployment)"
 *    - ประเภท: เว็บแอป (Web app)
 *    - เรียกใช้ในฐานะ (Execute as): ฉัน (Me)
 *    - ผู้มีสิทธิ์เข้าถึง (Who has access): ทุกคน (Anyone)
 * 4) กดอนุญาตสิทธิ์ แล้วคัดลอก URL ที่ลงท้ายด้วย /exec
 * 5) นำ URL ไปวางในไฟล์ index.html ที่บรรทัด  const GOOGLE_SCRIPT_URL = '...';
 *
 * ลายเซ็นจะถูกบันทึกเป็นไฟล์ PNG ในโฟลเดอร์ Google Drive ชื่อ SIGNATURE_FOLDER
 * และในชีตจะมีลิงก์ไปที่รูปลายเซ็น
 */

const SHEET_NAME = 'Attendance';
const SIGNATURE_FOLDER = 'Claude AI Class - ลายเซ็น';
const HEADERS = ['วันที่', 'เวลาเข้า', 'ชื่อ-นามสกุล', 'รหัส', 'ชื่อเล่น', 'สถานะ', 'สายกี่นาที', 'คลาส', 'ลายเซ็น', 'บันทึกเมื่อ'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const sheet = getSheet_();

    let sigLink = '';
    if (d.signature && String(d.signature).indexOf('data:image/png;base64,') === 0) {
      const bytes = Utilities.base64Decode(String(d.signature).split(',')[1]);
      const blob = Utilities.newBlob(bytes, 'image/png', `${d.date}_${d.time.replace(':', '')}_${d.name}.png`);
      const file = getFolder_().createFile(blob);
      sigLink = file.getUrl();
    }

    sheet.appendRow([
      d.date || '', d.time || '', d.name || '', d.code || '', d.nick || '',
      d.status || '', d.lateMinutes || 0, d.className || '',
      sigLink, new Date()
    ]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('Claude AI attendance endpoint is running ✓');
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#D4EEFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(SIGNATURE_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(SIGNATURE_FOLDER);
}
