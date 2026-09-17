"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SNAPSHOT, type PriceTable } from "./prices";

export type PricesState = {
  prices: PriceTable;
  /** วินาทีที่เหลือก่อนรีเฟรชรอบถัดไป */
  secondsLeft: number;
  loading: boolean;
  /** ข้อความตอนดึงไม่สำเร็จจนต้องคงราคาเดิมไว้ */
  error: string | null;
  refreshNow: () => void;
};

/**
 * ดึงราคาใหม่ทุก ๆ intervalSec พร้อมนับถอยหลังให้แสดงผล
 *
 * เริ่มต้นด้วย snapshot ที่ render มากับหน้า (ค่าเท่ากันทั้งฝั่ง server และ client
 * จึงไม่มีปัญหา hydration) แล้วค่อยดึงของสดหลัง mount
 *
 * ตัวนับอ่านจากเวลาครบกำหนดจริง ไม่ใช่นับถอยทีละหนึ่ง เบราว์เซอร์จึงหน่วง timer
 * ตอนแท็บไม่ได้อยู่หน้าจอได้โดยที่ตัวเลขไม่เพี้ยน แท็บที่ถูกซ่อนจะหยุดนับ
 * และดึงใหม่ทันทีเมื่อกลับมาโฟกัส
 */
export function usePrices(intervalSec = 60): PricesState {
  const [prices, setPrices] = useState<PriceTable>(SNAPSHOT);
  const [secondsLeft, setSecondsLeft] = useState(intervalSec);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);
  const deadline = useRef(0);

  const fetchPrices = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPrices((await res.json()) as PriceTable);
      setError(null);
    } catch (err) {
      // ดึงไม่ได้ก็คงราคาชุดเดิมไว้ ดีกว่าทำให้ทั้งหน้าว่าง
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      deadline.current = Date.now() + intervalSec * 1000;
      setSecondsLeft(intervalSec);
      setLoading(false);
      inFlight.current = false;
    }
  }, [intervalSec]);

  useEffect(() => {
    deadline.current = Date.now() + intervalSec * 1000;

    // ดึงรอบแรกนอกตัว effect เพื่อไม่ให้ setState ทำงานตอน effect body กำลังรัน
    const first = window.setTimeout(() => void fetchPrices(), 0);

    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const left = Math.ceil((deadline.current - Date.now()) / 1000);
      if (left <= 0) void fetchPrices();
      else setSecondsLeft(Math.min(left, intervalSec));
    }, 1000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchPrices();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchPrices, intervalSec]);

  return { prices, secondsLeft, loading, error, refreshNow: fetchPrices };
}
