import { DATA } from "./data";

/**
 * ชื่อที่ใช้แสดงของทรัพยากรแต่ละตัว
 *
 * `disp` ครอบคลุมเฉพาะตัวที่ชื่อสองพยางค์ (CERAMICKEY → Ceramic Key) ส่วนที่เหลือ
 * อ่านจากคู่ inputs/inputNames ของโรงงานที่ใช้มัน ซึ่งครอบคลุมของพื้นฐานอย่าง
 * DUST/FIRE/WATER ที่ไม่มีโรงงานของตัวเองและไม่ได้อยู่ใน disp
 */
const NAMES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const f of Object.values(DATA.factories)) {
    map[f.output] = f.name;
    f.inputs.forEach((sym, i) => {
      const name = f.inputNames[i];
      if (name) map[sym] = name;
    });
  }
  return { ...map, ...DATA.disp };
})();

/**
 * ของพื้นฐาน: เป็นวัตถุดิบของโรงงานอื่นแต่ไม่มีโรงงานผลิตเอง
 * จึงหามาได้ทางเดียวคือใช้ coin ซื้อจากตลาด
 */
export const BASE_ITEMS: ReadonlySet<string> = new Set(
  Object.values(DATA.factories)
    .flatMap((f) => f.inputs)
    .filter((sym) => !DATA.factories[sym]),
);

export function itemName(sym: string): string {
  return NAMES[sym] ?? sym;
}

export function isBaseItem(sym: string): boolean {
  return BASE_ITEMS.has(sym);
}

/** ชื่อของพื้นฐานทั้งหมด เรียงตามตัวอักษร ใช้ในคำอธิบายท้ายหน้า */
export const BASE_ITEM_NAMES: string[] = [...BASE_ITEMS].map(itemName).sort();
