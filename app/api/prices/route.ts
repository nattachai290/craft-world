import { NextResponse } from "next/server";
import { SNAPSHOT, parsePriceFeed, type PriceTable } from "@/lib/prices";

/** ราคาต้องสดเสมอ ห้ามให้ Next แคชไว้ */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIMEOUT_MS = 8000;

/**
 * ราคาปัจจุบัน
 *
 * ดึงจากต้นทางที่ตั้งไว้ใน PRICE_API_URL แล้วแปลงด้วย parsePriceFeed
 * ถ้าไม่ได้ตั้งค่าไว้ หรือดึงไม่สำเร็จ จะตอบด้วย snapshot ที่ติดมากับ build
 * พร้อมบอกเหตุผลใน note เพื่อให้หน้าเว็บแสดงได้ว่าเลขที่เห็นสดหรือไม่
 */
export async function GET() {
  const url = process.env.PRICE_API_URL;

  if (!url) {
    return json({
      ...SNAPSHOT,
      note: "ยังไม่ได้ตั้งค่า PRICE_API_URL จึงใช้ราคา snapshot ที่ติดมากับ build",
    });
  }

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`ต้นทางตอบ HTTP ${res.status}`);
    return json(parsePriceFeed(await res.json()));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return json({ ...SNAPSHOT, note: `ดึงราคาสดไม่สำเร็จ (${reason}) จึงใช้ snapshot` });
  }
}

function json(body: PriceTable) {
  return NextResponse.json(body, {
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
