/**
 * Mastery ของโรงงาน (0–10) — ยิ่งสูงยิ่งใช้วัตถุดิบต่อรอบน้อยลง
 *
 * ตัวหารต้นทุนวัตถุดิบต่อรอบของแต่ละระดับ ตามที่ rawrtools.com ใช้
 * (mastery 1 ลด 2% ไล่ไปจนถึง mastery 10 ลด 5%)
 */
export const MASTERY_MULTIPLIERS = [
  1, 1.0204, 1.0286, 1.0329, 1.0372, 1.0415, 1.0437, 1.0459, 1.0481, 1.0503, 1.0525,
] as const;

export const MAX_MASTERY = MASTERY_MULTIPLIERS.length - 1;

/** ระดับ mastery ของแต่ละโรงงาน key คือ symbol ผลผลิต เช่น SALT · ไม่มี = 0 */
export type Masteries = Readonly<Record<string, number>>;

export function clampMastery(level: unknown): number {
  const n = Math.round(Number(level));
  return Number.isFinite(n) ? Math.min(MAX_MASTERY, Math.max(0, n)) : 0;
}

export function masteryMultiplier(level: number): number {
  return MASTERY_MULTIPLIERS[clampMastery(level)];
}

/** ต้นทุนลดลงกี่ % เช่น mastery 10 → 4.99 */
export function masteryDiscountPct(level: number): number {
  return (1 - 1 / masteryMultiplier(level)) * 100;
}

/** key คงที่ของชุด mastery ใช้แคช engine — ลำดับ key ไม่มีผล ค่า 0 ไม่นับ */
export function masteryKey(m: Masteries): string {
  return Object.entries(m)
    .filter(([, v]) => clampMastery(v) > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${clampMastery(v)}`)
    .join(",");
}
