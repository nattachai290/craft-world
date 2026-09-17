import { NextResponse } from "next/server";
import { DEFAULT_ENDPOINT } from "@/lib/feed";

/**
 * ทดสอบว่า quote หลายตัวใน request เดียว (GraphQL alias) ให้ผลเท่ากับยิงทีละตัวไหม
 * ใช้ชั่วคราวเพื่อวินิจฉัย แล้วลบทิ้ง
 */
export const dynamic = "force-dynamic";

const ENDPOINT = process.env.PRICE_API_URL || DEFAULT_ENDPOINT;
const FIELDS = "{ output { symbol amount } details { priceImpactPercentage } }";

async function gql(specs: { alias: string; input: object }[]) {
  const args = specs.map((s) => `$${s.alias}: ExactInputInput!`).join(", ");
  const body = specs
    .map((s) => `${s.alias}: exactInputQuote(input: $${s.alias}) ${FIELDS}`)
    .join("\n");
  const variables = Object.fromEntries(specs.map((s) => [s.alias, s.input]));
  const res = await fetch(ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: `query D(${args}) {\n${body}\n}`, variables }),
  });
  const j = await res.json();
  return j as { data?: Record<string, { output?: { amount?: number }; details?: { priceImpactPercentage?: number } }>; errors?: unknown };
}

const q = (inputSymbol: string, outputSymbol: string, inputAmount: number) => ({
  inputSymbol,
  outputSymbol,
  inputAmount,
});

export async function GET() {
  const probes = ["MUD", "COPPER", "CERAMICS"];
  const out: Record<string, unknown> = { endpoint: ENDPOINT };

  // 1) ยิงทีละตัว หนึ่ง quote ต่อหนึ่ง request
  const single: Record<string, unknown> = {};
  for (const s of probes) {
    const r = await gql([{ alias: "a", input: q(s, "COIN", 1) }]);
    single[s] = {
      amount: r.data?.a?.output?.amount,
      impact: r.data?.a?.details?.priceImpactPercentage,
    };
  }
  out.single = single;

  // 2) ตัวเดิมซ้ำ 5 alias ใน request เดียว — ถ้าค่าไม่เท่ากัน แปลว่า state สะสมกันจริง
  const rep = await gql(
    Array.from({ length: 5 }, (_, i) => ({ alias: `r${i}`, input: q("MUD", "COIN", 1) })),
  );
  out.repeatedInOneRequest = Array.from({ length: 5 }, (_, i) => rep.data?.[`r${i}`]?.output?.amount);

  // 3) แบตช์ 24 ตัวแบบที่โค้ดจริงใช้ ดูว่าค่าของ probe เปลี่ยนไปไหม
  const syms = ["MUD", "COPPER", "CERAMICS", "CLAY", "SAND", "STEEL", "WIRE", "NEST",
    "KEY", "BOLTS", "SCREWS", "HEAT", "LAVA", "GLASS", "SALT", "ALGAE", "OXYGEN",
    "SEAWATER", "GAS", "FUEL", "OIL", "ENERGY", "STONE", "BOOK"];
  const batch = await gql(syms.map((s, i) => ({ alias: `b${i}`, input: q(s, "COIN", 1) })));
  out.inBatchOf24 = Object.fromEntries(
    probes.map((p) => [p, batch.data?.[`b${syms.indexOf(p)}`]?.output?.amount]),
  );

  // 4) ผลของขนาดคำสั่ง — ยิง MUD หลายขนาดแยก request
  const sizes: Record<string, unknown> = {};
  for (const amt of [1, 10, 1000]) {
    const r = await gql([{ alias: "a", input: q("MUD", "COIN", amt) }]);
    const amount = r.data?.a?.output?.amount;
    sizes[`in${amt}`] = {
      out: amount,
      perUnit: typeof amount === "number" ? amount / amt : null,
      impact: r.data?.a?.details?.priceImpactPercentage,
    };
  }
  out.tradeSize = sizes;

  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
