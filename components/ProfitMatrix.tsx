"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import SummaryTiles from "@/components/SummaryTiles";
import { DATA } from "@/lib/data";
import {
  costRows,
  craftChain,
  shoppingList,
  sourcedByCrafting,
  type CostedRow,
} from "@/lib/cost";
import { bestPctRow, bestRow, dur, fmt, fmtc, fmtPct, num } from "@/lib/format";
import { isBaseItem, itemName } from "@/lib/items";
import type { CostMode, Factory, SortKey } from "@/lib/types";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "perday", label: "กำไร/วัน" },
  { key: "pct", label: "%" },
  { key: "name", label: "ชื่อ" },
];

const MODES: { key: CostMode; label: string; desc: string }[] = [
  {
    key: "market",
    label: "ซื้อวัตถุดิบ",
    desc: "ซื้อวัตถุดิบชั้นถัดไปจากตลาด คราฟต์ 1 รอบ แล้วขายผลผลิตกลับเข้าตลาดทันที",
  },
  {
    key: "chain",
    label: "คราฟต์สุดสาย",
    desc: "ซื้อเฉพาะของที่ผลิตเองไม่ได้ (Dust · Fire · Water) กับ Earth นอกนั้นคราฟต์เองทุกชั้นจนถึงเป้าหมาย",
  },
  {
    key: "mixed",
    label: "เลือกที่ถูกกว่า",
    desc: "ไล่ทีละชั้น ชั้นไหนซื้อจากตลาดถูกกว่าก็ซื้อ ชั้นไหนคราฟต์เองถูกกว่าก็ทำเอง",
  },
];

const FACTORIES = Object.values(DATA.factories);

function recipe(f: Factory): string {
  return f.inputNames.join(" + ") || "เหมือง";
}

/** ค้นได้ทั้งชื่อโรงงานและชื่อวัตถุดิบที่มันใช้ */
function matches(f: Factory, q: string): boolean {
  if (!q) return true;
  const hay = [f.name, f.output, ...f.inputNames, ...f.inputs].join(" ").toLowerCase();
  return hay.includes(q);
}

/** จอแคบเท่านั้นที่ต้องเลื่อน — จอกว้างสองพาเนลอยู่ข้างกันอยู่แล้ว */
function scrollIntoViewOnNarrow(el: HTMLElement | null) {
  if (!el || typeof window === "undefined") return;
  if (window.matchMedia("(min-width: 900px)").matches) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export default function ProfitMatrix() {
  const [mode, setMode] = useState<CostMode>("market");
  const [sortKey, setSortKey] = useState<SortKey>("perday");
  const [profitOnly, setProfitOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("EARTH");

  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const costed = useMemo(
    () => new Map(FACTORIES.map((f) => [f.output, costRows(f, mode)] as const)),
    [mode],
  );
  const rowsOf = (f: Factory) => costed.get(f.output) ?? [];

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = FACTORIES.filter(
      (f) =>
        (!profitOnly || bestRow(costed.get(f.output) ?? []).profit > 0) && matches(f, q),
    );

    if (sortKey === "name") return out.sort((a, b) => a.name.localeCompare(b.name));
    const pick = sortKey === "pct" ? bestPctRow : bestRow;
    const score = (f: Factory) => {
      const r = pick(costed.get(f.output) ?? []);
      return sortKey === "pct" ? (r.pct ?? -Infinity) : r.perday;
    };
    return out.sort((a, b) => score(b) - score(a));
  }, [sortKey, profitOnly, query, costed]);

  const detail = DATA.factories[selected] ?? list[0] ?? FACTORIES[0];
  const activeMode = MODES.find((m) => m.key === mode)!;

  return (
    <>
      <div className="modebar">
        <div className="moderow">
          <span className="ctrls-label">วัตถุดิบมาจากไหน</span>
          <div className="modes" role="group" aria-label="โมเดลต้นทุน">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                className={mode === m.key ? "on" : undefined}
                aria-pressed={mode === m.key}
                onClick={() => setMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <p className="modedesc">{activeMode.desc}</p>
      </div>

      <SummaryTiles costed={costed} />

      <div className="layout">
        <div className="panel side" ref={listRef}>
          <div className="phead">
            <h2>โรงงาน</h2>
            <span className="count">
              {list.length}/{FACTORIES.length}
            </span>
          </div>

          <div className="search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาโรงงาน หรือ วัตถุดิบ…"
              aria-label="ค้นหาโรงงานหรือวัตถุดิบ"
            />
          </div>

          <div className="ctrls" role="group" aria-label="เรียงลำดับและกรอง">
            <span className="ctrls-label">เรียง</span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={sortKey === s.key ? "on" : undefined}
                aria-pressed={sortKey === s.key}
                onClick={() => setSortKey(s.key)}
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              className={"filt" + (profitOnly ? " on" : "")}
              aria-pressed={profitOnly}
              onClick={() => setProfitOnly((v) => !v)}
            >
              เฉพาะที่กำไร
            </button>
          </div>

          <div className="flist">
            {list.map((f) => {
              const b = bestRow(rowsOf(f));
              const pos = b.profit >= 0;
              return (
                <button
                  key={f.output}
                  type="button"
                  className={"frow" + (selected === f.output ? " sel" : "")}
                  aria-current={selected === f.output ? "true" : undefined}
                  onClick={() => {
                    setSelected(f.output);
                    scrollIntoViewOnNarrow(detailRef.current);
                  }}
                >
                  <span className="nm">{f.name}</span>
                  <span className={"pd " + (pos ? "pos" : "neg")}>{fmtc(b.perday)}</span>
                  <span className="rc">
                    {recipe(f)} → {f.name}
                  </span>
                  <span className="lv">
                    Lv{b.lv} · {fmtPct(b.pct)}
                  </span>
                </button>
              );
            })}
            {list.length === 0 && (
              <p className="empty">ไม่พบโรงงานที่ตรงกับเงื่อนไข ลองล้างคำค้นหรือปิดตัวกรอง</p>
            )}
          </div>
        </div>

        <div className="detailcol" ref={detailRef}>
          <div className="detailbar">
            <button
              type="button"
              className="backbtn"
              onClick={() => scrollIntoViewOnNarrow(listRef.current)}
            >
              ← รายการโรงงาน
            </button>
            <span className="detailbar-name">{detail.name}</span>
          </div>
          <FactoryDetail
            key={detail.output + mode}
            factory={detail}
            rows={rowsOf(detail)}
            mode={mode}
          />
        </div>
      </div>
    </>
  );
}

function FactoryDetail({
  factory,
  rows,
  mode,
}: {
  factory: Factory;
  rows: CostedRow[];
  mode: CostMode;
}) {
  const best = bestRow(rows);
  const bestPct = bestPctRow(rows);
  const chain = mode === "market" ? [] : craftChain(factory.output, mode);

  // แถวที่กางรายการซื้อให้ดู เริ่มที่เลเวลกำไรดีสุด กดแถวอื่นเพื่อเปลี่ยนได้
  const [pickedLv, setPickedLv] = useState(best.lv);
  const picked = rows.find((r) => r.lv === pickedLv) ?? best;

  return (
    <div className="panel">
      <div className="dhead">
        <h2>
          {factory.name} <span>โรงงาน</span>
        </h2>
        <div className="rt">
          สูตร: <b>{factory.inputNames.join(" + ") || "ไม่มี (เหมือง)"}</b> → {factory.name} ·
          สูงสุด Lv{factory.maxlv}
        </div>
        <div className="best">
          <span className={"chip " + (best.profit >= 0 ? "pos" : "neg")}>
            กำไร/วันดีสุด: Lv{best.lv} · {fmtc(best.perday)} COIN/วัน
          </span>
          <span
            className={
              "chip " + (bestPct.pct == null ? "mute" : bestPct.pct >= 0 ? "pos" : "neg")
            }
          >
            %ดีสุด: Lv{bestPct.lv} · {fmtPct(bestPct.pct)}
          </span>
        </div>
        {chain.length > 0 && (
          <p className="chaininfo">
            ต้องมีโรงงานในสายอีก {chain.length} ตัว: {chain.map(itemName).join(" · ")}
          </p>
        )}
      </div>

      <BuyList row={picked} mode={mode} />

      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Lv</th>
              <th scope="col" className="c-out">
                ผลผลิต/รอบ
              </th>
              <th scope="col" className="c-in">
                วัตถุดิบ/รอบ
              </th>
              <th scope="col" className="c-dur">
                รอบ
              </th>
              <th scope="col" className="c-cost">
                ต้นทุน
              </th>
              <th scope="col" className="c-rev">
                รายได้
              </th>
              <th scope="col">กำไร/รอบ</th>
              <th scope="col">%</th>
              <th scope="col">กำไร/วัน</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pos = r.profit >= 0;
              const ins =
                Object.keys(r.inputs).length > 0 ? (
                  <Ingredients inputs={r.inputs} mode={mode} />
                ) : (
                  "—"
                );
              const isBest = r.lv === best.lv;
              const cls =
                (isBest ? "bestrow" : "") + (r.lv === pickedLv ? " lvsel" : "");
              return (
                <Fragment key={r.lv}>
                  <tr className={cls || undefined} onClick={() => setPickedLv(r.lv)}>
                    <th scope="row">
                      <button
                        type="button"
                        className="lvnum lvbtn"
                        aria-pressed={r.lv === pickedLv}
                        onClick={() => setPickedLv(r.lv)}
                      >
                        Lv{r.lv}
                      </button>
                    </th>
                    <td className="c-out">{fmt(r.out, r.out < 10 ? 2 : 0)}</td>
                    <td className="c-in">{ins}</td>
                    <td className="c-dur">{dur(r.dur)}</td>
                    <td className="c-cost">{fmt(r.cost, 2)}</td>
                    <td className="c-rev">{fmt(r.rev, 2)}</td>
                    <td className={pos ? "pos" : "neg"}>{fmtc(r.profit)}</td>
                    <td className={pos ? "pos" : "neg"}>{fmtPct(r.pct)}</td>
                    <td className={r.perday >= 0 ? "pos" : "neg"}>{fmtc(r.perday)}</td>
                  </tr>
                  {/* จอแคบซ่อนคอลัมน์รายละเอียด แถวนี้จึงรับไปแสดงเต็มความกว้างแทน */}
                  <tr className={"subrow" + (cls ? " " + cls : "")} onClick={() => setPickedLv(r.lv)}>
                    <td colSpan={4}>
                      <span className="sub-k">ผลผลิต</span> {fmt(r.out, r.out < 10 ? 2 : 0)}
                      <span className="sub-sep">·</span>
                      <span className="sub-k">รอบ</span> {dur(r.dur)}
                      <span className="sub-sep">·</span>
                      <span className="sub-k">ใช้</span> {ins}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * รายการวัตถุดิบของหนึ่งรอบการผลิต
 *
 * ของพื้นฐาน (Dust / Fire / Water) และ Earth ไม่มีทางได้มานอกจากซื้อ จึงขีดเส้นประไว้
 * ส่วนโหมดที่คราฟต์เองได้จะบอกด้วยว่าชั้นนี้เลือกทำเองหรือซื้อ
 */
function Ingredients({
  inputs,
  mode,
}: {
  inputs: Record<string, number>;
  mode: CostMode;
}) {
  return (
    <>
      {Object.entries(inputs).map(([sym, amt], i) => {
        const crafted = sourcedByCrafting(mode, sym);
        return (
          <span key={sym}>
            {i > 0 && " + "}
            {fmt(amt, amt < 10 ? 2 : 0)}{" "}
            {isBaseItem(sym) ? (
              <abbr className="base" title="ของพื้นฐาน ไม่มีโรงงานผลิต ต้องซื้อด้วย coin">
                {itemName(sym)}
              </abbr>
            ) : (
              itemName(sym)
            )}
            {mode !== "market" && (
              <span className={"src " + (crafted ? "make" : "buy")}>
                {crafted ? "ทำเอง" : "ซื้อ"}
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}

/**
 * รายการที่ต้องควักเงินซื้อจริงสำหรับการผลิตหนึ่งรอบ
 *
 * โหมด market คือวัตถุดิบชั้นถัดไปตรง ๆ ส่วนอีกสองโหมดกางสายลงไปจนถึงชั้นที่เลือกซื้อ
 * ผลรวมจึงเท่ากับต้นทุนของแถวนั้นเสมอ
 */
function BuyList({ row, mode }: { row: CostedRow; mode: CostMode }) {
  const purchases = shoppingList(row, mode);

  return (
    <section className="buypanel" aria-label="รายการที่ต้องซื้อ">
      <div className="buyhead">
        <h3>ต้องซื้ออะไรบ้าง · Lv{row.lv}</h3>
        <span className="buynote">
          ต่อ 1 รอบ ({dur(row.dur)}) ได้ {fmt(row.out, row.out < 10 ? 2 : 0)} ชิ้น
        </span>
      </div>

      {purchases.length === 0 ? (
        <p className="empty">ไม่ต้องซื้ออะไร — เป็นเหมือง ขุดได้เอง</p>
      ) : (
        <div className="tblwrap">
          <table className="buylist">
            <thead>
              <tr>
                <th scope="col">ซื้อ</th>
                <th scope="col">จำนวน</th>
                <th scope="col">ราคา/หน่วย</th>
                <th scope="col">รวม</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.sym}>
                  <th scope="row">
                    {isBaseItem(p.sym) ? (
                      <abbr
                        className="base"
                        title="ของพื้นฐาน ไม่มีโรงงานผลิต ต้องซื้อด้วย coin"
                      >
                        {itemName(p.sym)}
                      </abbr>
                    ) : (
                      itemName(p.sym)
                    )}
                  </th>
                  <td>{num(p.qty)}</td>
                  <td>{num(p.unitPrice, p.unitPrice < 1 ? 6 : 2)}</td>
                  <td>{num(p.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">รวมต้นทุน</th>
                <td colSpan={2} />
                <td>{num(row.cost)}</td>
              </tr>
              <tr>
                <th scope="row">ขายได้</th>
                <td colSpan={2} />
                <td>{num(row.rev)}</td>
              </tr>
              <tr className={row.profit >= 0 ? "pos" : "neg"}>
                <th scope="row">กำไร/รอบ</th>
                <td colSpan={2}>{fmtPct(row.pct)}</td>
                <td>{fmtc(row.profit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
