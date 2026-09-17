import { NextResponse } from "next/server";
import { DEFAULT_ENDPOINT, fetchQuotes } from "@/lib/feed";
import { SNAPSHOT, parsePriceFeed, type PriceTable } from "@/lib/prices";

/** ราคาต้องสดเสมอ ห้ามให้ Next แคชไว้ */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIMEOUT_MS = 12_000;
/** กันหลายแท็บยิงพร้อมกันจนถล่มต้นทาง สั้นกว่ารอบรีเฟรช 60 วิ ของหน้าเว็บ */
const CACHE_MS = 30_000;

let cached: { at: number; table: PriceTable } | null = null;
let inFlight: Promise<PriceTable> | null = null;

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
    return table;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const table: PriceTable = {
      ...SNAPSHOT,
      note: `ดึงราคาสดจาก ${endpoint} ไม่สำเร็จ (${reason}) จึงใช้ราคา snapshot`,
    };
    // แคช snapshot ไว้สั้น ๆ เหมือนกัน จะได้ไม่รัวยิงซ้ำตอนต้นทางล่ม
    cached = { at: Date.now(), table };
    return table;
  }
}

function json(body: PriceTable) {
  return NextResponse.json(body, {
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
