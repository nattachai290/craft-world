import { DATA } from "./data";
import { masteryKey, masteryMultiplier, type Masteries } from "./mastery";
import type { PriceTable } from "./prices";
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
 *
 * ราคาเปลี่ยนได้ระหว่างรัน (รีเฟรชทุกนาที) ต้นทุนจึงคิดจาก PriceTable ที่ส่งเข้ามา
 * ไม่ใช่ค่าคงที่ตอน build — ตัวเลข cost/profit/pct/perday ที่ติดมากับ prices.json
 * ถูกคำนวณใหม่ทุกครั้ง ไม่ได้ใช้ของเดิม
 */

/** ของที่ซื้ออย่างเดียว: ไม่มีโรงงาน หรือเป็นเหมือง (Earth) */
export function isPurchasedOnly(sym: string): boolean {
  const f = DATA.factories[sym];
  return !f || f.rows.every((r) => Object.keys(r.inputs).length === 0);
}

/** ของหนึ่งอย่างที่ต้องซื้อจากตลาด */
export type Purchase = {
  sym: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
};

/** แถวหนึ่งเลเวลพร้อมตัวเลขที่คิดใหม่ตามโมเดลและราคาปัจจุบัน */
export type CostedRow = Row & {
  cost: number;
  profit: number;
  pct: number | null;
  /**
   * เวลาจริงต่อหนึ่งรอบ (วินาที) — รอบของโรงงานเป้าหมาย หรือเวลาที่โรงงานป้อน
   * ตัวที่ช้าที่สุดต้องใช้ผลิตวัตถุดิบให้ครบหนึ่งรอบ แล้วแต่อย่างไหนนานกว่า
   */
  cycle: number;
  /** โรงงานป้อนที่ช้ากว่าโรงงานเป้าหมาย (null = โรงงานเป้าหมายเป็นตัวกำหนดเอง) */
  bottleneck: { sym: string; time: number } | null;
  perday: number;
};

/**
 * เลเวลที่ทำให้ต้นทุนวัตถุดิบต่อชิ้นต่ำสุด
 * anyLevel = ทุกเลเวลใช้วัตถุดิบต่อชิ้นเท่ากัน เลเวลไม่มีผลกับต้นทุน
 */
export type CraftLevel = { lv: number; anyLevel: boolean };

export type CostEngine = {
  prices: PriceTable;
  unitCost(mode: CostMode, sym: string): number;
  sourcedByCrafting(mode: CostMode, sym: string): boolean;
  /** เลเวลของโรงงานที่ป้อนให้ ซึ่งใช้คิดต้นทุนทำเอง (null เมื่อคราฟต์ไม่ได้) */
  craftLevel(mode: CostMode, sym: string): CraftLevel | null;
  /** speed = ตัวคูณความเร็วการผลิต (2 = เวลาต่อรอบลดครึ่ง จากโฆษณา ads2x) */
  costRows(f: Factory, mode: CostMode, speed?: number): CostedRow[];
  shoppingList(row: Row, mode: CostMode): Purchase[];
  craftChain(sym: string, mode: CostMode): string[];
};

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

/**
 * สูตรของทุกโรงงานหลังหัก mastery — วัตถุดิบต่อรอบหารด้วยตัวคูณของระดับนั้น
 * โรงงานที่ mastery 0 ใช้ข้อมูลเดิมโดยตรง
 */
function applyMastery(masteries: Masteries): Record<string, Factory> {
  const out: Record<string, Factory> = {};
  for (const [sym, f] of Object.entries(DATA.factories)) {
    const m = masteryMultiplier(masteries[sym] ?? 0);
    out[sym] =
      m === 1
        ? f
        : {
            ...f,
            rows: f.rows.map((r) => ({
              ...r,
              inputs: Object.fromEntries(Object.entries(r.inputs).map(([s, q]) => [s, q / m])),
            })),
          };
  }
  return out;
}

function createEngine(prices: PriceTable, masteries: Masteries): CostEngine {
  const buy = prices.buy;
  const sell = prices.sell;
  const factories = applyMastery(masteries);

  /**
   * ต้นทุนต่อหน่วยของทุกไอเทมภายใต้โมเดลหนึ่ง (กราฟสูตรเป็น DAG จึงไม่วน)
   *
   * เก็บไว้สามอย่างในรอบเดียว: ต้นทุนที่ใช้จริง (unit), ต้นทุนถ้าคราฟต์เอง (craft)
   * และเลเวลที่คราฟต์ได้ถูกที่สุด (row) — การตัดสินซื้อ/ทำเอง รายการซื้อ และสายโรงงาน
   * อ่านจากตารางนี้หมด จะได้ไม่ต้องคำนวณซ้ำทุกครั้งที่ render
   */
  const buildModel = (mode: CostMode) => {
    const unitMemo: Record<string, number> = {};
    const craftMemo: Record<string, number> = {};
    const rowMemo: Record<string, Row | null> = {};
    const levelMemo: Record<string, CraftLevel> = {};
    /** เลเวลที่ใช้คิดเวลาผลิตของโรงงานป้อน */
    const runRowMemo: Record<string, Row> = {};
    const visiting = new Set<string>();

    const unit = (sym: string): number => {
      if (sym in unitMemo) return unitMemo[sym];

      const market = buy[sym] ?? Infinity;
      if (mode === "market" || isPurchasedOnly(sym)) return (unitMemo[sym] = market);

      if (visiting.has(sym)) return Infinity;
      visiting.add(sym);
      const best = cheapestCraftRow(factories[sym], unit);
      visiting.delete(sym);

      const craft = best?.unitCost ?? Infinity;
      craftMemo[sym] = craft;
      rowMemo[sym] = best?.row ?? null;
      if (best) {
        const anyLevel = factories[sym].rows
          .filter((r) => Object.keys(r.inputs).length > 0)
          .every((r) => Math.abs(rowUnitCost(r, unit) - craft) <= Math.abs(craft) * 1e-9);
        levelMemo[sym] = { lv: best.row.lv, anyLevel };
        // ต้นทุนเท่ากันทุกเลเวล → ใช้เลเวลที่ผลิตต่อชั่วโมงได้มากที่สุด
        runRowMemo[sym] = anyLevel
          ? factories[sym].rows
              .filter((r) => Object.keys(r.inputs).length > 0)
              .reduce((a, b) => (b.out / b.dur > a.out / a.dur ? b : a))
          : best.row;
      }
      return (unitMemo[sym] = mode === "mixed" ? Math.min(market, craft) : craft);
    };

    for (const sym of Object.keys(buy)) unit(sym);
    for (const sym of Object.keys(factories)) unit(sym);
    return { unit: unitMemo, craft: craftMemo, row: rowMemo, level: levelMemo, runRow: runRowMemo };
  };

  const model: Record<CostMode, ReturnType<typeof buildModel>> = {
    market: buildModel("market"),
    chain: buildModel("chain"),
    mixed: buildModel("mixed"),
  };

  const unitCost = (mode: CostMode, sym: string) => model[mode].unit[sym] ?? Infinity;

  /**
   * วัตถุดิบตัวนี้คราฟต์เองหรือซื้อ
   * ไม่มีการตรึงไว้ล่วงหน้า — เทียบราคาซื้อปัจจุบันกับต้นทุนคราฟต์ที่ถูกที่สุดเสมอ
   */
  const sourcedByCrafting = (mode: CostMode, sym: string): boolean => {
    if (mode === "market" || isPurchasedOnly(sym)) return false;
    if (mode === "chain") return true;
    return (model.mixed.craft[sym] ?? Infinity) < (buy[sym] ?? Infinity);
  };

  /** เลเวลที่คราฟต์ได้ถูกที่สุด ใช้กางรายการซื้อกับสายโรงงาน */
  /**
   * เวลาที่โรงงานป้อนแต่ละตัวต้องใช้ ผลิตวัตถุดิบให้พอสำหรับหนึ่งรอบของแถวนี้ (วินาที)
   *
   * สมมติว่ามีโรงงานแต่ละชนิดอย่างละโรง เดินพร้อมกัน — ทั้งสายจึงได้รอบต่อวัน
   * เท่ากับตัวที่ช้าที่สุด (คอขวด) ไม่ใช่ผลรวมของทุกชั้น
   */
  const feederTimes = (row: Row, mode: CostMode): Map<string, number> => {
    const need = new Map<string, number>();
    const walk = (sym: string, qty: number, depth: number) => {
      if (depth >= 64 || !sourcedByCrafting(mode, sym)) return;
      const r = model[mode].row[sym];
      if (!r) return;
      need.set(sym, (need.get(sym) ?? 0) + qty);
      for (const [s, q] of Object.entries(r.inputs)) walk(s, (qty * q) / r.out, depth + 1);
    };
    for (const [sym, qty] of Object.entries(row.inputs)) walk(sym, qty, 0);

    const times = new Map<string, number>();
    for (const [sym, qty] of need) {
      const run = model[mode].runRow[sym];
      if (run) times.set(sym, (qty / run.out) * run.dur);
    }
    return times;
  };

  const cheapestRowFor = (mode: CostMode, sym: string): Row | null =>
    model[mode].row[sym] ?? null;

  const craftLevel = (mode: CostMode, sym: string): CraftLevel | null =>
    model[mode].level[sym] ?? null;

  return {
    prices,
    unitCost,
    sourcedByCrafting,
    craftLevel,

    costRows(f, mode, speed = 1) {
      const price = sell[f.output] ?? 0;
      return (factories[f.output] ?? f).rows.map((r) => {
        const cost = Object.entries(r.inputs).reduce(
          (sum, [sym, qty]) => sum + qty * unitCost(mode, sym),
          0,
        );
        const rev = r.out * price;
        const profit = rev - cost;

        // ads2x เร่งทุกโรงงานในสาย ไม่ใช่แค่โรงงานเป้าหมาย
        let bottleneck: CostedRow["bottleneck"] = null;
        for (const [sym, t] of feederTimes(r, mode)) {
          if (t > r.dur && (!bottleneck || t > bottleneck.time)) bottleneck = { sym, time: t };
        }
        const cycle = (bottleneck?.time ?? r.dur) / speed;

        return {
          ...r,
          rev,
          cost,
          profit,
          pct: cost > 0 ? (profit / cost) * 100 : null,
          dur: r.dur / speed,
          cycle,
          bottleneck: bottleneck && { sym: bottleneck.sym, time: bottleneck.time / speed },
          perday: profit * (86400 / cycle),
        };
      });
    },

    /**
     * รายการที่ต้องซื้อจริงสำหรับการผลิตหนึ่งรอบ
     *
     * กางสายลงไปจนถึงชั้นที่โมเดลเลือก "ซื้อ" แล้วรวมจำนวนของแต่ละอย่างเข้าด้วยกัน
     * ผลรวมของ subtotal จึงเท่ากับต้นทุนของแถวนั้นพอดี
     */
    shoppingList(row, mode) {
      const qtyBySym = new Map<string, number>();

      const add = (sym: string, qty: number, depth: number) => {
        const best =
          depth < 64 && sourcedByCrafting(mode, sym) ? cheapestRowFor(mode, sym) : null;
        if (!best) {
          qtyBySym.set(sym, (qtyBySym.get(sym) ?? 0) + qty);
          return;
        }
        for (const [s, q] of Object.entries(best.inputs)) {
          add(s, (qty * q) / best.out, depth + 1);
        }
      };

      for (const [sym, qty] of Object.entries(row.inputs)) add(sym, qty, 0);

      return [...qtyBySym]
        .map(([sym, qty]) => {
          const unitPrice = buy[sym] ?? Infinity;
          return { sym, qty, unitPrice, subtotal: qty * unitPrice };
        })
        .sort((a, b) => b.subtotal - a.subtotal);
    },

    /** โรงงานไหนบ้างที่ต้องมีในสาย ถ้าจะคราฟต์ไอเทมนี้เองภายใต้โมเดลที่เลือก */
    craftChain(sym, mode) {
      const seen = new Set<string>();
      const walk = (s: string) => {
        if (seen.has(s) || !sourcedByCrafting(mode, s)) return;
        seen.add(s);
        const best = cheapestRowFor(mode, s);
        if (best) for (const input of Object.keys(best.inputs)) walk(input);
      };
      const f = factories[sym];
      if (f) for (const r of f.rows) for (const input of Object.keys(r.inputs)) walk(input);
      return [...seen];
    },
  };
}

/** สร้าง engine ครั้งเดียวต่อชุดราคากับชุด mastery หนึ่งชุด จะได้ไม่ต้องคำนวณซ้ำ */
const engines = new WeakMap<PriceTable, Map<string, CostEngine>>();

export function costEngine(prices: PriceTable, masteries: Masteries = {}): CostEngine {
  let byMastery = engines.get(prices);
  if (!byMastery) {
    byMastery = new Map();
    engines.set(prices, byMastery);
  }
  const key = masteryKey(masteries);
  let e = byMastery.get(key);
  if (!e) {
    e = createEngine(prices, masteries);
    byMastery.set(key, e);
  }
  return e;
}
