import { NextResponse } from "next/server";
import { DEFAULT_ENDPOINT, fetchQuotes } from "@/lib/feed";
import { SNAPSHOT, parsePriceFeed, type PriceTable } from "@/lib/prices";

/** ราคาต้องสดเสมอ ห้ามให้ Next แคชไว้ */
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** ให้ Vercel รอ function ได้นานกว่างบเวลาดึงราคา ไม่งั้นโดนตัดก่อนได้ตอบ snapshot */
export const maxDuration = 60;

/**
 * งบเวลารวมของการดึงหนึ่งครั้ง (สองรอบต่อกัน ขายแล้วค่อยซื้อ) — ปกติใช้ 4–6 วินาที
 * เผื่อให้แต่ละรอบยิงซ้ำก้อนที่ค้างได้หนึ่งครั้ง
 */
const TIMEOUT_MS = 30_000;
/** กันหลายแท็บยิงพร้อมกันจนถล่มต้นทาง สั้นกว่ารอบรีเฟรช 60 วิ ของหน้าเว็บ */
const CACHE_MS = 30_000;

let cached: { at: number; table: PriceTable } | null = null;
let inFlight: Promise<PriceTable> | null = null;
/** ราคาสดชุดล่าสุดที่ดึงสำเร็จ ใช้แทน snapshot ตอนต้นทางล่มชั่วคราว */
let lastLive: PriceTable | null = null;

/**
 * ราคาปัจจุบัน
 *
 * ดึงจาก GraphQL ของ craft-world.gg (เปลี่ยนปลายทางได้ด้วย PRICE_API_URL)
 * ถ้าดึงไม่สำเร็จหรือราคาไม่ครบ จะตอบด้วย snapshot ที่ติดมากับ build พร้อมบอกเหตุผล
 * ใน note เพื่อให้หน้าเว็บแสดงได้ว่าเลขที่เห็นสดหรือไม่
 */
export async function GET() {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return json(cached.table);

  // คำขอที่มาพร้อมกันใช้ผลของเที่ยวเดียวกัน
  inFlight ??= load().finally(() => {
    inFlight = null;
  });

  return json(await inFlight);
}

async function load(): Promise<PriceTable> {
  const endpoint = process.env.PRICE_API_URL || DEFAULT_ENDPOINT;
  try {
    const quotes = await fetchQuotes(endpoint, AbortSignal.timeout(TIMEOUT_MS));
    const table = parsePriceFeed(quotes);
    cached = { at: Date.now(), table };
    lastLive = table;
    return table;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    // ต้นทางพลาดชั่วคราวไม่ควรทำให้ถอยกลับไปราคา snapshot ตอน build
    // ถ้าเคยดึงสดได้ ให้ตอบชุดล่าสุดนั้นพร้อมบอกว่ามันค้างมาจากเวลาไหน
    const table: PriceTable = lastLive
      ? { ...lastLive, reason, note: `ดึงราคาสดไม่สำเร็จ (${reason}) ยังแสดงราคาสดชุดล่าสุดอยู่` }
      : { ...SNAPSHOT, reason, note: `ดึงราคาสดจาก ${endpoint} ไม่สำเร็จ (${reason}) จึงใช้ราคา snapshot` };
    // แคชผลล้มเหลวไว้สั้น ๆ จะได้ไม่รัวยิงซ้ำตอนต้นทางล่ม
    cached = { at: Date.now(), table };
    return table;
  }
}

function json(body: PriceTable) {
  return NextResponse.json(body, {
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
