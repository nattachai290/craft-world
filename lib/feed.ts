import { DATA } from "./data";

/**
 * ดึงราคาสดจาก GraphQL ของ craft-world.gg
 *
 * API มีแต่ exactInputQuote (ระบุจำนวนขาเข้า) จึงต้องยิงสองทิศ
 *
 *   ขาย S : S -> COIN จำนวน 1 ชิ้น         ได้ COIN เท่าไหร่ = ราคาขายต่อชิ้น
 *   ซื้อ S : COIN -> S จำนวน sell[S] COIN   ได้ S ประมาณ 1 ชิ้น
 *            ราคาซื้อต่อชิ้น = sell[S] ÷ จำนวนที่ได้
 *
 * ยิงขาซื้อด้วยมูลค่าประมาณหนึ่งชิ้น เพื่อให้ price impact เทียบเท่ากับขาขาย
 * ถ้ายิงด้วย 1 COIN เฉย ๆ ของแพงจะกลายเป็นรายการจิ๋วและได้ราคาที่ดีเกินจริง
 *
 * สองทิศเป็นคนละ pool กันจริง — ในข้อมูล snapshot อัตราส่วน buy/sell กระจายตั้งแต่
 * 0.93 (DYNOKEY) ถึง 1.12 (PLASTICS) ไม่ใช่ค่าธรรมเนียมคงที่ที่คำนวณย้อนได้
 */

export const DEFAULT_ENDPOINT = "https://craft-world.gg/graphql";

/** ทุก symbol ที่แอปต้องใช้ราคา (COIN เป็นหน่วยอ้างอิง ไม่ต้องถาม) */
export const SYMBOLS: string[] = [
  ...new Set(
    Object.values(DATA.factories).flatMap((f) => [f.output, ...f.inputs]),
  ),
].filter((s) => s !== "COIN");

type QuoteSpec = {
  key: string;
  inputSymbol: string;
  outputSymbol: string;
  inputAmount: number;
};

/** ยิงหลาย quote ในคำขอเดียวด้วย alias คืนค่า key -> จำนวนขาออก */
async function runQuotes(
  endpoint: string,
  specs: QuoteSpec[],
  signal: AbortSignal,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (specs.length === 0) return out;

  const aliasOf = specs.map((_, i) => `q${i}`);
  const args = aliasOf.map((a) => `$${a}: ExactInputInput!`).join(", ");
  const body = specs
    .map((_, i) => `${aliasOf[i]}: exactInputQuote(input: $${aliasOf[i]}) { output { symbol amount } }`)
    .join("\n");

  const variables: Record<string, unknown> = {};
  specs.forEach((s, i) => {
    variables[aliasOf[i]] = {
      inputSymbol: s.inputSymbol,
      outputSymbol: s.outputSymbol,
      inputAmount: s.inputAmount,
    };
  });

  const res = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    signal,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query: `query Quotes(${args}) {\n${body}\n}`, variables }),
  });
  if (!res.ok) throw new Error(`ต้นทางตอบ HTTP ${res.status}`);

  const json = (await res.json()) as {
    data?: Record<string, { output?: { amount?: unknown } } | null>;
    errors?: { message?: string }[];
  };

  // GraphQL ตอบ error พร้อม data บางส่วนได้ เก็บเท่าที่สำเร็จไว้ก่อน
  // ถ้าขาดไปจนไม่ครบ ตัวตรวจใน parsePriceFeed จะปฏิเสธเองทีหลัง
  if (!json.data) {
    throw new Error(json.errors?.[0]?.message ?? "ไม่มีฟิลด์ data ในคำตอบ");
  }

  specs.forEach((s, i) => {
    const amount = Number(json.data?.[aliasOf[i]]?.output?.amount);
    if (Number.isFinite(amount) && amount > 0) out.set(s.key, amount);
  });
  return out;
}

/** แบ่งเป็นก้อนย่อย เผื่อต้นทางจำกัดความซับซ้อนของ query */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function runAll(
  endpoint: string,
  specs: QuoteSpec[],
  signal: AbortSignal,
  batchSize: number,
): Promise<Map<string, number>> {
  const merged = new Map<string, number>();
  for (const batch of chunk(specs, batchSize)) {
    for (const [k, v] of await runQuotes(endpoint, batch, signal)) merged.set(k, v);
  }
  return merged;
}

/** ราคาซื้อ/ขายของทุก symbol ในรูปแบบที่ parsePriceFeed รับได้ */
export async function fetchQuotes(
  endpoint: string,
  signal: AbortSignal,
  batchSize = 24,
): Promise<{ buy: Record<string, number>; sell: Record<string, number> }> {
  // รอบแรก: ขาย 1 ชิ้นได้กี่ COIN
  const sellAmounts = await runAll(
    endpoint,
    SYMBOLS.map((s) => ({ key: s, inputSymbol: s, outputSymbol: "COIN", inputAmount: 1 })),
    signal,
    batchSize,
  );

  const sell: Record<string, number> = { COIN: 1 };
  for (const [s, amount] of sellAmounts) sell[s] = amount;

  // รอบสอง: ใช้ COIN มูลค่าราวหนึ่งชิ้นซื้อกลับ ได้ของกี่ชิ้น
  const buySpecs: QuoteSpec[] = [];
  for (const s of SYMBOLS) {
    const spend = sell[s];
    if (spend === undefined || !(spend > 0)) continue;
    buySpecs.push({ key: s, inputSymbol: "COIN", outputSymbol: s, inputAmount: spend });
  }
  const bought = await runAll(endpoint, buySpecs, signal, batchSize);

  const buy: Record<string, number> = { COIN: 1 };
  for (const [s, received] of bought) buy[s] = sell[s] / received;

  return { buy, sell };
}
