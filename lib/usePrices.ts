"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SNAPSHOT, type PriceTable } from "./prices";

export type PricesState = {
  prices: PriceTable;
  /** เวลา (ms) ที่จะดึงรอบถัดไป · 0 = ยังไม่ได้ตั้ง */
  nextAt: number;
  intervalSec: number;
  loading: boolean;
  /** ข้อความตอนดึงไม่สำเร็จจนต้องคงราคาเดิมไว้ */
  error: string | null;
  refreshNow: () => void;
};

/**
 * ดึงราคาใหม่ทุก ๆ intervalSec
 *
 * hook นี้ไม่ได้นับถอยหลังเอง — มันบอกแค่ว่ารอบหน้าคือเมื่อไหร่ (nextAt)
 * ให้ตัวแสดงผลนับเอง ไม่งั้นทั้งหน้าที่ใช้ราคาจะ render ใหม่ทุกวินาทีโดยที่ราคาไม่ได้เปลี่ยน
 *
 * เริ่มต้นด้วย snapshot ที่ render มากับหน้า (ค่าเท่ากันทั้งฝั่ง server และ client
 * จึงไม่มีปัญหา hydration) แล้วค่อยดึงของสดหลัง mount
 *
 * ได้ราคาสดมาแล้วจะไม่ถอยกลับไปใช้ snapshot อีก แม้ server จะตอบ snapshot มา
 * (ต้นทางล่ม และ instance ที่รับคำขอไม่มีราคาสดชุดเก่าในหน่วยความจำ) — คงราคาสดชุดล่าสุด
 * ไว้แล้วแสดงข้อผิดพลาดแทน เวลาที่แสดงบนหน้าจะบอกเองว่าราคาเก่าแค่ไหน
 *
 * แท็บที่ถูกซ่อนจะข้ามรอบที่ครบกำหนด แล้วดึงใหม่ทันทีเมื่อกลับมาโฟกัส
 */
export function usePrices(intervalSec: number): PricesState {
  const [prices, setPrices] = useState<PriceTable>(SNAPSHOT);
  const [nextAt, setNextAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);
  const hasLive = useRef(false);

  const fetchPrices = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = (await res.json()) as PriceTable;

      if (next.source === "snapshot" && hasLive.current) {
        // ใช้สาเหตุดิบ ไม่ใช่ note ของ server ซึ่งบอกว่ากำลังใช้ snapshot — ที่นี่ไม่ได้ใช้
        setError(next.reason ?? "ต้นทางไม่ตอบ");
      } else {
        if (next.source === "live") hasLive.current = true;
        setPrices(next);
        setError(null);
      }
    } catch (err) {
      // ดึงไม่ได้ก็คงราคาชุดเดิมไว้ ดีกว่าทำให้ทั้งหน้าว่าง
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setNextAt(Date.now() + intervalSec * 1000);
      setLoading(false);
      inFlight.current = false;
    }
  }, [intervalSec]);

  // รอบแรกหลัง mount และดึงใหม่ทันทีเมื่อแท็บกลับมาโฟกัส
  useEffect(() => {
    // เลื่อนออกจากตัว effect เพื่อไม่ให้ setState ทำงานตอน effect body กำลังรัน
    const first = window.setTimeout(() => void fetchPrices(), 0);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchPrices();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchPrices]);

  // ตั้งเวลาดึงรอบถัดไปทุกครั้งที่รอบก่อนจบ (รวมรอบที่กดรีเฟรชเอง)
  useEffect(() => {
    if (nextAt === 0) return;
    const id = window.setTimeout(
      () => {
        if (document.visibilityState === "visible") void fetchPrices();
      },
      Math.max(0, nextAt - Date.now()),
    );
    return () => window.clearTimeout(id);
  }, [nextAt, fetchPrices]);

  return { prices, nextAt, intervalSec, loading, error, refreshNow: fetchPrices };
}
