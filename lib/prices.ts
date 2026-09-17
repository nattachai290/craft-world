import { DATA } from "./data";

/** ราคาซื้อ/ขายต่อ 1 หน่วยของทุกไอเทม (เรท swap) */
export type PriceTable = {
  /** เวลาที่ราคาชุดนี้ถูกดึงมา (UTC) */
  ts: string;
  /** เวลาเดียวกันในรูปแบบไทย ใช้แสดงบนหน้าเว็บ */
  tsLocal: string;
  buy: Record<string, number>;
  sell: Record<string, number>;
  /** live = ดึงสดจากต้นทาง · snapshot = ไฟล์ที่ติดมากับ build */
  source: "live" | "snapshot";
  /** เหตุผลที่ตกกลับไปใช้ snapshot ถ้ามี */
  note?: string;
};

/** ราคาที่ติดมากับ build ใช้ตอน SSR และตอนที่ดึงสดไม่ได้ */
export const SNAPSHOT: PriceTable = {
  ts: DATA.ts,
  tsLocal: DATA.tsLocal,
  buy: DATA.buy,
  sell: DATA.sell,
  source: "snapshot",
};

const BANGKOK = "Asia/Bangkok";

/** จัดรูปเวลาให้เหมือน snapshot เดิม เช่น "2026-09-17 02:04 น. (เวลาไทย)" */
export function formatThaiTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} น. (เวลาไทย)`;
}

/** ตัวเลขบวกที่ใช้เป็นราคาได้ */
function isPrice(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * แปลงข้อมูลจากต้นทางให้เป็น PriceTable
 *
 * รับรูปแบบ `{ buy: { SYM: number }, sell: { SYM: number } }` ถ้าต้นทางใช้รูปแบบอื่น
 * แก้ที่ฟังก์ชันนี้จุดเดียว ส่วนที่เหลือของแอปไม่ต้องแตะ
 */
export function parsePriceFeed(raw: unknown): PriceTable {
  if (!raw || typeof raw !== "object") throw new Error("payload ไม่ใช่ object");
  const { buy, sell } = raw as { buy?: unknown; sell?: unknown };
  if (!buy || typeof buy !== "object") throw new Error("ไม่มีฟิลด์ buy");
  if (!sell || typeof sell !== "object") throw new Error("ไม่มีฟิลด์ sell");

  const pick = (src: object): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(src)) if (isPrice(v)) out[k.toUpperCase()] = v;
    return out;
  };

  const parsed = { buy: pick(buy), sell: pick(sell) };

  // ต้องครอบคลุมไอเทมที่สูตรใช้จริง ไม่งั้นต้นทุนจะกลายเป็น Infinity ทั้งกระดาน
  const needed = new Set<string>();
  for (const f of Object.values(DATA.factories)) {
    needed.add(f.output);
    for (const s of f.inputs) needed.add(s);
  }
  const missing = [...needed].filter((s) => !(s in parsed.buy) || !(s in parsed.sell));
  if (missing.length > 0) {
    throw new Error(`ราคาไม่ครบ ขาด ${missing.length} ไอเทม เช่น ${missing.slice(0, 5).join(", ")}`);
  }

  const now = new Date();
  return {
    ts: now.toISOString().replace("T", " ").slice(0, 19) + " UTC",
    tsLocal: formatThaiTime(now),
    buy: parsed.buy,
    sell: parsed.sell,
    source: "live",
  };
}
