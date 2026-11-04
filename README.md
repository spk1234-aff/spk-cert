# ใบรับรองความประพฤตินักเรียน

ระบบขอ/ออกใบรับรองความประพฤติ งานกิจการนักเรียน โรงเรียนโซ่พิสัยพิทยาคม — ใช้ Firebase `spk-score-system` ร่วมกับ SMART SPK

- นักเรียน: `student.html` (จำการล็อกอินจาก SMART SPK ให้อัตโนมัติ)
- ครู: `admin.html` (บัญชีแอดมิน / แอดมินงานกิจการนักเรียน SMART SPK)
- เปิดลิงก์พร้อม `?demo` เพื่อดูโหมดทดลอง

## ติดตั้ง
1. Firestore → Rules: วางเนื้อหา `firestore-rules-cert.txt` ในบล็อก documents (ก่อนส่วน spk-score-app) แล้ว Publish
2. GitHub Pages: Settings → Pages → Deploy from branch `main` / root
3. เพิ่มลิงก์เมนูใน SMART SPK
   - นักเรียน: https://spk1234-aff.github.io/spk-cert/student.html
   - ครู (งานกิจการนักเรียน): https://spk1234-aff.github.io/spk-cert/admin.html

## ฟอนต์
`fonts/THSarabunIT9*.ttf` ตอนนี้เป็น TH Sarabun New ชั่วคราว ถ้าเปลี่ยนเป็น TH SarabunIT๙ ของแท้ ให้แก้ `--cert-fs` ใน `cert.css` เป็น `16pt`
