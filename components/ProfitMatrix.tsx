"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { DATA } from "@/lib/data";
import { bestPctRow, bestRow, dur, fmt, fmtc, fmtPct } from "@/lib/format";
import { isBaseItem, itemName } from "@/lib/items";
import type { Factory, SortKey } from "@/lib/types";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "perday", label: "กำไร/วัน" },
  { key: "pct", label: "%" },
  { key: "name", label: "ชื่อ" },
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
  const [sortKey, setSortKey] = useState<SortKey>("perday");
  const [profitOnly, setProfitOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>(
    () => FACTORIES.reduce((a, b) => (bestRow(b).perday > bestRow(a).perday ? b : a)).output,
  );

  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = FACTORIES.filter(
      (f) => (!profitOnly || bestRow(f).profit > 0) && matches(f, q),
    );

    if (sortKey === "name") return out.sort((a, b) => a.name.localeCompare(b.name));
    if (sortKey === "pct")
      return out.sort(
        (a, b) => (bestPctRow(b).pct ?? -Infinity) - (bestPctRow(a).pct ?? -Infinity),
      );
    return out.sort((a, b) => bestRow(b).perday - bestRow(a).perday);
  }, [sortKey, profitOnly, query]);

  const detail = DATA.factories[selected] ?? list[0] ?? FACTORIES[0];

  return (
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
            const b = bestRow(f);
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
        <FactoryDetail factory={detail} />
      </div>
    </div>
  );
}

function FactoryDetail({ factory }: { factory: Factory }) {
  const best = bestRow(factory);
  const bestPct = bestPctRow(factory);

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
      </div>

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
            {factory.rows.map((r) => {
              const pos = r.profit >= 0;
              const ins =
                Object.keys(r.inputs).length > 0 ? <Ingredients inputs={r.inputs} /> : "—";
              const isBest = r.lv === best.lv;
              return (
                <Fragment key={r.lv}>
                  <tr className={isBest ? "bestrow" : undefined}>
                    <th scope="row">
                      <span className="lvnum">Lv{r.lv}</span>
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
                  <tr className={"subrow" + (isBest ? " bestrow" : "")}>
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
 * ของพื้นฐาน (Dust / Fire / Water) ไม่มีโรงงานผลิต ต้องใช้ coin ซื้อจากตลาดอย่างเดียว
 * จึงทำเครื่องหมายไว้ให้แยกออกจากของที่คราฟต์เองได้
 */
function Ingredients({ inputs }: { inputs: Record<string, number> }) {
  return (
    <>
      {Object.entries(inputs).map(([sym, amt], i) => (
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
        </span>
      ))}
    </>
  );
}
