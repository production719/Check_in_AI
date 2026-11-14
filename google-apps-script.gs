/**
 * เว็บเช็คชื่อคลาส Claude AI ↔ Google Sheet
 * ใช้กับชีตที่มีแท็บ: Roster, Attendance, Settings
 *
 * วิธีติดตั้ง (ทำครั้งเดียว)
 * 1) เปิด Google Sheet → ส่วนขยาย (Extensions) → Apps Script
 * 2) ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดในไฟล์นี้ → กด 💾 บันทึก
 * 3) กด "ทำให้ใช้งานได้ (Deploy)" → "การทำให้ใช้งานได้รายการใหม่ (New deployment)"
 *      - เลือกประเภท ⚙️ → เว็บแอป (Web app)
 *      - เรียกใช้ในฐานะ (Execute as): ฉัน (Me)
 *      - ผู้มีสิทธิ์เข้าถึง (Who has access): ทุกคน (Anyone)
 * 4) กด Deploy → อนุญาตสิทธิ์ (Authorize access) → คัดลอก "URL ของเว็บแอป" ที่ลงท้ายด้วย /exec
 * 5) นำ URL ไปใส่ในไฟล์ config.js ของเว็บ (หรือส่งให้ Claude ใส่ให้)
 *
 * ถ้าแก้โค้ดนี้ภายหลัง: Deploy → Manage deployments → ✏️ → Version: New version → Deploy (URL เดิมใช้ต่อได้)
 */

// ID ของ Google Sheet ที่ใช้บันทึก (จากลิงก์ docs.google.com/spreadsheets/d/<ID>/edit)
const SHEET_ID = '11UUa3J447Z0pPagcKomprUBk-vChVFTF-7ccSZbhF2g';
const TZ = 'Asia/Bangkok';
const SIGNATURE_FOLDER = 'Claude AI Class - ลายเซ็น';
const MAX_SIG_CHARS = 45000; // เซลล์ใน Google Sheets เก็บได้ไม่เกิน 50,000 ตัวอักษร

/* ---------- อ่านข้อมูล: รายชื่อ + ตั้งค่า + การเช็คชื่อของวันที่ขอ ---------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : today_();
  try {
    return json_({
      ok: true,
      date: date,
      settings: getSettings_(),
      roster: getRoster_(),
      checkins: getCheckins_(date)
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------- เขียนข้อมูล: เช็คชื่อ / ยกเลิกการเช็คชื่อ ---------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    if (d.action === 'delete') return json_(deleteCheckin_(d));
    return json_(addCheckin_(d));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function addCheckin_(d) {
  if (!d.id || !d.date) return { ok: false, error: 'missing id/date' };
  const sh = sheet_('Attendance');
  // กันเช็คชื่อซ้ำในวันเดียวกัน
  const existing = getCheckins_(d.date);
  if (existing[d.id]) return { ok: true, duplicate: true };

  const person = getRoster_().find(r => r.id === d.id) || {};
  let sigLink = '';
  let sigData = '';
  if (d.signature && String(d.signature).indexOf('data:image/png;base64,') === 0) {
    try {
      const bytes = Utilities.base64Decode(String(d.signature).split(',')[1]);
      const name = `${d.date}_${(d.time || '').replace(':', '')}_${person.name || d.name || d.id}.png`;
      sigLink = folder_().createFile(Utilities.newBlob(bytes, 'image/png', name)).getUrl();
    } catch (err) { sigLink = ''; }
    if (d.signature.length <= MAX_SIG_CHARS) sigData = d.signature;
  }

  const row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, 10).setNumberFormat('@').setValues([[
    d.date,
    d.id,
    person.name || d.name || '',
    person.org || '',
    d.time || '',
    d.status || '',
    String(d.lateMinutes || 0),
    d.timestamp || new Date().toISOString(),
    sigLink,
    sigData
  ]]);
  return { ok: true };
}

function deleteCheckin_(d) {
  const sh = sheet_('Attendance');
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, deleted: 0 };
  const vals = sh.getRange(2, 1, last - 1, 2).getValues();
  let deleted = 0;
  for (let i = vals.length - 1; i >= 0; i--) {
    if (dateStr_(vals[i][0]) === d.date && String(vals[i][1]) === String(d.id)) {
      sh.deleteRow(i + 2); deleted++;
    }
  }
  return { ok: true, deleted: deleted };
}

/* ---------- helpers ---------- */
function getRoster_() {
  const sh = sheet_('Roster');
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 4).getDisplayValues()
    .filter(r => String(r[0]).trim() && String(r[1]).trim())
    .map(r => ({ id: String(r[0]).trim(), name: String(r[1]).trim(), org: String(r[2]).trim(), nameEn: String(r[3]).trim() }));
}

function getSettings_() {
  const sh = sheet_('Settings');
  const out = {};
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 2).getDisplayValues().forEach(r => { if (r[0]) out[String(r[0]).trim()] = String(r[1]).trim(); });
  return out;
}

function getCheckins_(date) {
  const sh = sheet_('Attendance');
  const last = sh.getLastRow();
  const out = {};
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, 10).getValues().forEach(r => {
    if (dateStr_(r[0]) !== date || !r[1]) return;
    out[String(r[1])] = { time: String(r[7] || ''), hhmm: String(r[4] || ''), status: String(r[5] || ''), sig: String(r[9] || ''), sigLink: String(r[8] || '') };
  });
  return out;
}

function dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v || '').trim();
}
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบแท็บ ' + name);
  return sh;
}
let SS_;
function ss_() {
  if (!SS_) SS_ = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  return SS_;
}
function folder_() {
  const it = DriveApp.getFoldersByName(SIGNATURE_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(SIGNATURE_FOLDER);
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ทดสอบใน Apps Script: เลือกฟังก์ชันนี้แล้วกด Run เพื่อดูว่าอ่านชีตได้ */
function testRead() {
  Logger.log(JSON.stringify({ settings: getSettings_(), roster: getRoster_().length, today: getCheckins_(today_()) }));
}
