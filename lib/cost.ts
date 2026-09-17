import { DATA } from "./data";
import type { CostMode, Factory, Row } from "./types";

/**
 * โมเดลต้นทุนสามแบบ
 *
 * ทั้งสามแบบขายผลผลิตที่ราคาขาย (swap sell) เหมือนกัน ต่างกันที่ "วัตถุดิบมาจากไหน"
 *
 * - market : ซื้อวัตถุดิบชั้นถัดไปจากตลาดตรง ๆ ชั้นเดียว
 * - chain  : ซื้อเฉพาะของที่ผลิตเองไม่ได้ (Dust/Fire/Water) กับ Earth ที่ซื้อจากตลาด
 *            นอกนั้นคราฟต์เองไล่ลงไปจนสุดสาย
 * - mixed  : แต่ละชั้นเลือกทางที่ถูกกว่าระหว่างซื้อจากตลาดกับคราฟต์เอง
 *
 * Earth ไม่ถือว่าขุดฟรี — คิดที่ราคาซื้อในตลาดเสมอ เพื่อให้เห็นต้นทุนแบบซื้อจริง
 */

/** ของที่ซื้ออย่างเดียว: ไม่มีโรงงาน หรือเป็นเหมือง (Earth) */
function isPurchasedOnly(sym: string): boolean {
  const f = DATA.factories[sym];
  return !f || f.rows.every((r) => Object.keys(r.inputs).length === 0);
}

/** ต้นทุนวัตถุดิบต่อผลผลิต 1 ชิ้นของแถวนั้น */
function rowUnitCost(row: Row, unit: (sym: string) => number): number {
  let total = 0;
  for (const [sym, qty] of Object.entries(row.inputs)) {
    const c = unit(sym);
    if (!Number.isFinite(c)) return Infinity;
    total += qty * c;
  }
  return total / row.out;
}

/** เลเวลที่ทำให้ต้นทุนวัตถุดิบต่อชิ้นถูกที่สุด */
function cheapestCraftRow(
  f: Factory,
  unit: (sym: string) => number,
): { row: Row; unitCost: number } | null {
  let best: { row: Row; unitCost: number } | null = null;
  for (const row of f.rows) {
    if (Object.keys(row.inputs).length === 0) continue;
    const c = rowUnitCost(row, unit);
    if (!best || c < best.unitCost) best = { row, unitCost: c };
  }
  return best;
}

function cheapestCraftCost(f: Factory, unit: (sym: string) => number): number {
  return cheapestCraftRow(f, unit)?.unitCost ?? Infinity;
}

/** ต้นทุนต่อหน่วยของทุกไอเทมภายใต้โมเดลที่เลือก (กราฟสูตรเป็น DAG จึงไม่วน) */
function buildUnitCosts(mode: CostMode): Record<string, number> {
  const memo: Record<string, number> = {};
  const visiting = new Set<string>();

  const unit = (sym: string): number => {
    if (sym in memo) return memo[sym];

    const market = DATA.buy[sym] ?? Infinity;
    if (mode === "market" || isPurchasedOnly(sym)) return (memo[sym] = market);

    if (visiting.has(sym)) return Infinity;
    visiting.add(sym);
    const craft = cheapestCraftCost(DATA.factories[sym], unit);
    visiting.delete(sym);

    return (memo[sym] = mode === "mixed" ? Math.min(market, craft) : craft);
  };

  for (const sym of Object.keys(DATA.buy)) unit(sym);
  for (const sym of Object.keys(DATA.factories)) unit(sym);
  return memo;
}

const UNIT_COSTS: Record<CostMode, Record<string, number>> = {
  market: buildUnitCosts("market"),
  chain: buildUnitCosts("chain"),
  mixed: buildUnitCosts("mixed"),
};

export function unitCost(mode: CostMode, sym: string): number {
  return UNIT_COSTS[mode][sym] ?? Infinity;
}

/**
 * ในโหมด mixed วัตถุดิบตัวนี้คุ้มกว่าถ้าคราฟต์เองไหม
 * (market จะซื้อเสมอ, chain จะคราฟต์เสมอถ้าคราฟต์ได้)
 */
export function sourcedByCrafting(mode: CostMode, sym: string): boolean {
  if (mode === "market" || isPurchasedOnly(sym)) return false;
  if (mode === "chain") return true;
  const craft = cheapestCraftCost(DATA.factories[sym], (s) => unitCost("mixed", s));
  return craft < (DATA.buy[sym] ?? Infinity);
}

/** แถวหนึ่งเลเวลพร้อมตัวเลขที่คิดใหม่ตามโมเดล */
export type CostedRow = Row & {
  cost: number;
  profit: number;
  pct: number | null;
  perday: number;
};

export function costRows(f: Factory, mode: CostMode): CostedRow[] {
  const sell = DATA.sell[f.output] ?? 0;
  return f.rows.map((r) => {
    const cost = Object.entries(r.inputs).reduce(
      (sum, [sym, qty]) => sum + qty * unitCost(mode, sym),
      0,
    );
    const rev = r.out * sell;
    const profit = rev - cost;
    return {
      ...r,
      rev,
      cost,
      profit,
      pct: cost > 0 ? (profit / cost) * 100 : null,
      perday: profit * (86400 / r.dur),
    };
  });
}

/** โรงงานไหนบ้างที่ต้องมีในสาย ถ้าจะคราฟต์ไอเทมนี้เองภายใต้โมเดลที่เลือก */
export function craftChain(sym: string, mode: CostMode): string[] {
  const seen = new Set<string>();
  const walk = (s: string) => {
    if (seen.has(s) || !sourcedByCrafting(mode, s)) return;
    seen.add(s);
    const f = DATA.factories[s];
    const best = f.rows
      .filter((r) => Object.keys(r.inputs).length > 0)
      .reduce((a, b) =>
        rowUnitCost(b, (x) => unitCost(mode, x)) < rowUnitCost(a, (x) => unitCost(mode, x)) ? b : a,
      );
    for (const input of Object.keys(best.inputs)) walk(input);
  };
  const f = DATA.factories[sym];
  if (f) for (const r of f.rows) for (const input of Object.keys(r.inputs)) walk(input);
  return [...seen];
}

/** ของหนึ่งอย่างที่ต้องซื้อจากตลาด */
export type Purchase = {
  sym: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
};

/**
 * รายการที่ต้องซื้อจริงสำหรับการผลิตหนึ่งรอบ
 *
 * กางสายลงไปจนถึงชั้นที่โมเดลเลือก "ซื้อ" แล้วรวมจำนวนของแต่ละอย่างเข้าด้วยกัน
 * ผลรวมของ subtotal จึงเท่ากับต้นทุนของแถวนั้นพอดี
 */
export function shoppingList(row: Row, mode: CostMode): Purchase[] {
  const qtyBySym = new Map<string, number>();

  const add = (sym: string, qty: number, depth: number) => {
    const craftIt = depth < 64 && sourcedByCrafting(mode, sym);
    const best = craftIt
      ? cheapestCraftRow(DATA.factories[sym], (s) => unitCost(mode, s))
      : null;

    if (!best) {
      qtyBySym.set(sym, (qtyBySym.get(sym) ?? 0) + qty);
      return;
    }
    for (const [s, q] of Object.entries(best.row.inputs)) {
      add(s, (qty * q) / best.row.out, depth + 1);
    }
  };

  for (const [sym, qty] of Object.entries(row.inputs)) add(sym, qty, 0);

  return [...qtyBySym]
    .map(([sym, qty]) => {
      const unitPrice = DATA.buy[sym] ?? Infinity;
      return { sym, qty, unitPrice, subtotal: qty * unitPrice };
    })
    .sort((a, b) => b.subtotal - a.subtotal);
}
