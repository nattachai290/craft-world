export type Row = {
  lv: number;
  /** ผลผลิตต่อรอบ */
  out: number;
  /** วินาทีต่อรอบ */
  dur: number;
  /** วัตถุดิบต่อรอบ */
  inputs: Record<string, number>;
  /** รายได้ต่อรอบ = out × ราคาขาย */
  rev: number;
  /** ต้นทุนต่อรอบ = Σ วัตถุดิบ × ราคาซื้อ */
  cost: number;
  profit: number;
  /** กำไรคิดเป็น % ของต้นทุน (null เมื่อไม่มีต้นทุน เช่น เหมือง) */
  pct: number | null;
  perday: number;
  cycday: number;
};

export type Factory = {
  key: string;
  name: string;
  output: string;
  inputs: string[];
  inputNames: string[];
  maxlv: number;
  rows: Row[];
};

export type PriceData = {
  /** เวลา snapshot ของราคา (UTC) */
  ts: string;
  /** เวลา snapshot รูปแบบไทย */
  tsLocal: string;
  sell: Record<string, number>;
  buy: Record<string, number>;
  disp: Record<string, string>;
  factories: Record<string, Factory>;
};

export type SortKey = "perday" | "pct" | "name";

/** วัตถุดิบมาจากไหน — ดูคำอธิบายแต่ละแบบใน lib/cost.ts */
export type CostMode = "market" | "chain" | "mixed";
