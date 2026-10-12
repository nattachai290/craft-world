"use client";

import { useCallback, useSyncExternalStore } from "react";

/** แจ้งคอมโพเนนต์ในแท็บเดียวกัน (event "storage" ของเบราว์เซอร์ยิงเฉพาะแท็บอื่น) */
const CHANGE = "stored-flag-change";

/**
 * ค่าในแท็บนี้ — ใช้แทน localStorage เมื่อเบราว์เซอร์บล็อก (private mode, ปิด site data)
 * ช่องติ๊กจะได้ยังกดได้ แค่จำข้ามการโหลดหน้าไม่ได้
 */
const memory = new Map<string, boolean>();

function read(key: string): boolean {
  const cached = memory.get(key);
  if (cached !== undefined) return cached;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * ค่า true/false ที่จำไว้ในเบราว์เซอร์ข้ามการโหลดหน้า
 *
 * ฝั่ง server และตอน hydrate ใช้ false เสมอ แล้ว React ค่อยสลับเป็นค่าที่จำไว้
 * หลัง hydrate เสร็จ — หน้าจึงไม่เกิด hydration mismatch
 */
export function useStoredFlag(key: string): [boolean, (value: boolean) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (e: StorageEvent) => {
        if (e.key !== key) return;
        memory.set(key, e.newValue === "1");
        onChange();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(CHANGE, onChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(CHANGE, onChange);
      };
    },
    [key],
  );

  const value = useSyncExternalStore(subscribe, () => read(key), () => false);

  const set = useCallback(
    (next: boolean) => {
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // จำในแท็บนี้อย่างเดียวพอ
      }
      window.dispatchEvent(new Event(CHANGE));
    },
    [key],
  );

  return [value, set];
}
