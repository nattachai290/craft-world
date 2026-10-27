"use client";

import { useCallback, useSyncExternalStore } from "react";
import { clampMastery, type Masteries } from "./mastery";

const KEY = "craft-world:mastery";
const CHANGE = "stored-mastery-change";
const EMPTY: Masteries = Object.freeze({});

/** ค่าในแท็บนี้ ใช้แทน localStorage เมื่อเบราว์เซอร์บล็อก */
let memory: string | null | undefined;
/** useSyncExternalStore ต้องได้ object ตัวเดิมถ้าข้อมูลไม่เปลี่ยน */
let cache: { raw: string | null; value: Masteries } = { raw: null, value: EMPTY };

function readRaw(): string | null {
  if (memory !== undefined) return memory;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Masteries {
  if (!raw) return EMPTY;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lv = clampMastery(v);
      if (lv > 0) out[k] = lv;
    }
    return out;
  } catch {
    return EMPTY;
  }
}

function snapshot(): Masteries {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    memory = e.newValue;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE, onChange);
  };
}

/**
 * ระดับ mastery ของแต่ละโรงงาน จำไว้ในเบราว์เซอร์ข้ามการโหลดหน้า
 * ฝั่ง server และตอน hydrate เป็นค่าว่างเสมอ แล้วค่อยสลับเป็นค่าที่จำไว้
 */
export function useStoredMasteries(): [Masteries, (next: Masteries) => void] {
  const value = useSyncExternalStore(subscribe, snapshot, () => EMPTY);

  const set = useCallback((next: Masteries) => {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(next)) {
      const lv = clampMastery(v);
      if (lv > 0) clean[k] = lv;
    }
    const raw = Object.keys(clean).length ? JSON.stringify(clean) : null;
    memory = raw;
    try {
      if (raw) window.localStorage.setItem(KEY, raw);
      else window.localStorage.removeItem(KEY);
    } catch {
      // จำในแท็บนี้อย่างเดียวพอ
    }
    window.dispatchEvent(new Event(CHANGE));
  }, []);

  return [value, set];
}
