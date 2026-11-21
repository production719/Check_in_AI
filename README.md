# เว็บเช็คชื่อคลาส Claude AI

**เวอร์ชันปัจจุบัน: v2.1.0** · เว็บไซต์: https://production719.github.io/Check_in_AI/ · ประวัติเวอร์ชัน: [CHANGELOG.md](CHANGELOG.md)

## โครงสร้าง
- `index.html` — ตัวเว็บ: หน้าเช็คชื่อ, `#login` (เข้าสู่ระบบ/สมัครสมาชิก), `#me` (หน้าของฉัน), `#admin` (หน้าผู้สอน)
- `config.js` — ตั้งค่า Supabase URL / publishable key, อีเมลแนะนำตอนล็อกอิน, (ไม่บังคับ) Google Sheets
- `supabase/schema.sql` — โครงสร้างฐานข้อมูล, Row Level Security และฟังก์ชัน
- `google-apps-script.gs` — (ไม่บังคับ) ส่งสำเนาการเช็คชื่อไป Google Sheets

## ฐานข้อมูล (Supabase)
| ตาราง | ใช้ทำอะไร | ใครอ่าน / เขียน |
|---|---|---|
| `roster` | รายชื่อผู้เรียน (id, ชื่อ, หน่วยงาน, ชื่ออังกฤษ, ลำดับ, แสดง/ซ่อน) | ทุกคนอ่าน · ผู้สอนเขียน |
| `settings` | ชื่อคลาส, เวลาเริ่ม, นาทีที่ยอมให้สาย | ทุกคนอ่าน · ผู้สอนเขียน |
| `attendance` | การเช็คชื่อ + ลายเซ็น | ผู้สอนเท่านั้น (ผู้เรียนเขียนผ่านฟังก์ชัน `check_in`) |
| `admins` | อีเมลผู้สอน | ผู้สอนเท่านั้น |
| `profiles` | บัญชีผู้เรียน ↔ ชื่อในคลาส (หนึ่งต่อหนึ่ง) | เจ้าของบัญชี / ผู้สอน (ผูกผ่าน `claim_roster`) |

ฟังก์ชันสาธารณะ: `check_in(roster_id, signature)` (เวลาจากเซิร์ฟเวอร์, วันละครั้ง) และ `public_board(date)` (สถานะ/เวลา ไม่มีลายเซ็น)

## ตั้งค่าล็อกอินด้วย Google (ทำครั้งเดียว)
1. **Google Cloud Console** → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application
   - Authorized JavaScript origins: `https://production719.github.io`
   - Authorized redirect URIs: `https://ahneciasihtkicmeielx.supabase.co/auth/v1/callback`
2. **Supabase** → Authentication → Sign In / Providers → Google → เปิด แล้ววาง Client ID / Client Secret
3. **Supabase** → Authentication → URL Configuration
   - Site URL: `https://production719.github.io/Check_in_AI/`
   - Redirect URLs: เพิ่ม `https://production719.github.io/Check_in_AI/`

## ระบบสมาชิกผู้เรียน (อีเมล + รหัสผ่าน)
- Supabase → Authentication → Sign In / Providers → **Email** ต้องเปิดอยู่
- ถ้าเปิด “Confirm email” ผู้เรียนต้องกดลิงก์ยืนยันในอีเมลก่อนเข้าสู่ระบบ — อีเมลของ Supabase แบบฟรีส่งได้จำกัดต่อชั่วโมง
  แนะนำ: ปิด Confirm email หรือ ตั้งค่า SMTP ของตัวเองที่ Authentication → Emails → SMTP Settings
- ลืมรหัสผ่าน: ระบบส่งลิงก์ไปที่อีเมล (ต้องใส่ URL เว็บใน Redirect URLs ตามด้านบน)

## เพิ่มผู้สอน
Supabase → Table Editor → `admins` → Insert row → ใส่อีเมล Google

## อัปเดตเวอร์ชัน
แก้ `index.html` → เพิ่มรายการบนสุดของ `CHANGELOG` ในไฟล์ และใน `CHANGELOG.md` → commit (GitHub Pages อัปเดตเองใน 1–2 นาที)
