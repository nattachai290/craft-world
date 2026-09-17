# Craft World — ตารางกำไรการผลิต (Profit Matrix)

เว็บแอป Next.js ที่ตอบคำถามเดียว: **ซื้อวัตถุดิบจากตลาด → ผลิต → ขายผลผลิต คุ้มไหม และเลเวลไหนดีที่สุด**
ครอบคลุมโรงงานทั้ง 43 ตัวใน Craft World ตั้งแต่ Lv.1 ถึงเลเวลสูงสุดของแต่ละโรงงาน

## วิธีคิด

- `กำไร/รอบ = (ผลผลิต × ราคาขาย) − (วัตถุดิบ × ราคาซื้อ)`
- `กำไร/วัน = กำไร/รอบ × (86400 ÷ วินาทีต่อรอบ)`
- `% = กำไร/รอบ ÷ ต้นทุน`

ราคาซื้อ/ขายเป็นเรท swap ต่อ 1 หน่วย (marginal — ยิงที่ 1 หน่วย)

### ข้อจำกัดของตัวเลข

- ยังไม่รวม price impact เวลาซื้อ/ขายจำนวนมาก — pool ตื้น ราคาจริงจะแย่กว่าที่แสดง
- ยังไม่รวมค่า power และค่าอัปเกรดโรงงาน (ลงทุนครั้งเดียว)
- ราคาเป็น snapshot ณ เวลาที่ระบุบนหน้าเว็บ อาจเปลี่ยนไปแล้ว
- ทรัพยากรที่ pool แทบไม่มีสภาพคล่อง (เช่น `SCREWS`) จะมีราคาซื้อสูงผิดปกติ
  ทำให้โรงงานที่ใช้มันเป็นวัตถุดิบ (Acid, Bolts) แสดงกำไรติดลบมหาศาล

## รันในเครื่อง

```bash
npm install
npm run dev     # http://localhost:3000
```

คำสั่งอื่น: `npm run lint` · `npm run typecheck` · `npm run build`

## โครงสร้าง

```
app/                 App Router — layout, หน้าเดียว, global CSS
components/          SummaryTiles (server) + ProfitMatrix (client, ลิสต์/ตาราง/ฟิลเตอร์)
lib/                 types, ตัวช่วยฟอร์แมตตัวเลข, ตัวโหลดข้อมูล
data/prices.json     ราคา snapshot + ตารางโรงงานทุกเลเวล
```

อัปเดตราคา = แทนที่ `data/prices.json` ด้วย snapshot ใหม่ (โครงสร้างตาม `lib/types.ts`)

## CI

`.github/workflows/ci.yml` รันบน push เข้า `main`, ทุก pull request และตามกำหนดทุกสัปดาห์

- **build** — `npm run lint`, `npm run typecheck`, `npm run build`
- **audit** — `npm audit --audit-level=high` (ล้มงานเมื่อเจอช่องโหว่ระดับ high ขึ้นไป)
  พร้อมแนบผลเต็มไว้ใน job summary

## Deploy

Deploy บน Vercel — ค่า default ของ Next.js ใช้ได้เลย ไม่ต้องตั้ง env var ใดๆ

## แหล่งข้อมูล

ข้อมูลโรงงานจาก rawrtools.com · ราคาจาก craft-world.gg
