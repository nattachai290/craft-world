import ProfitMatrix from "@/components/ProfitMatrix";
import SummaryTiles from "@/components/SummaryTiles";
import { DATA } from "@/lib/data";
import { BASE_ITEM_NAMES } from "@/lib/items";

export default function Home() {
  return (
    <div className="wrap">
      <header>
        <h1>Craft World — ตารางกำไรการผลิต</h1>
        <p className="sub">
          ซื้อวัตถุดิบจากตลาด → ผลิต → ขายผลผลิต · คุ้มไหม เลเวลไหนดีสุด (ทุกโรงงาน Lv.1→max)
        </p>
        <p className="stamp">
          ราคา snapshot: <b>{DATA.tsLocal}</b> · เรทจาก craft-world.gg swap
        </p>
      </header>

      <SummaryTiles />
      <ProfitMatrix />

      <div className="note">
        <b>วิธีคิด:</b> กำไร/รอบ = (ผลผลิต × ราคาขาย) − (วัตถุดิบ × ราคาซื้อ)
        โดยราคาซื้อ/ขายเป็นเรท swap ต่อ 1 หน่วย (marginal, ยิงที่ 1 หน่วย) กำไร/วัน = กำไร/รอบ ×
        (86400 ÷ วินาทีต่อรอบ) · % = กำไร/รอบ ÷ ต้นทุน
        <br />
        <br />
        <b>ของพื้นฐาน:</b> {BASE_ITEM_NAMES.join(" · ")} ไม่มีโรงงานผลิต
        หามาได้ทางเดียวคือใช้ coin ซื้อจากตลาด (ในตารางขีดเส้นประไว้ใต้ชื่อ) ส่วน Earth
        เป็นเหมือง ขุดได้เองโดยไม่มีต้นทุนวัตถุดิบ
        <br />
        <br />
        <b>ข้อจำกัด:</b> ยังไม่รวม price impact เวลาซื้อ/ขายจำนวนมาก (pool ตื้น ราคาจริงจะแย่กว่านี้),
        ค่า power, และค่าอัปเกรดโรงงาน (ลงทุนครั้งเดียว) · ราคาเป็น snapshot อาจเปลี่ยนแล้ว · ทรัพยากรที่ pool แทบไม่มีสภาพคล่อง (เช่น
        Screws) ราคาซื้อจะสูงผิดปกติ ทำให้โรงงานที่ใช้มันติดลบมหาศาล
      </div>

      <p className="foot">ข้อมูลโรงงานจาก rawrtools.com · ราคาจาก craft-world.gg</p>
    </div>
  );
}
