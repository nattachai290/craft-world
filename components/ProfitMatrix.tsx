"use client";

import { useMemo, useState } from "react";
import { DATA } from "@/lib/data";
import { bestPctRow, bestRow, dur, fmt, fmtc, fmtPct } from "@/lib/format";
import type { Factory, SortKey } from "@/lib/types";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "perday", label: "กำไร/วัน" },
  { key: "pct", label: "%" },
  { key: "name", label: "ชื่อ" },
];

const FACTORIES = Object.values(DATA.factories);

/** ชื่อไทย/อังกฤษของทรัพยากร ใช้ตอนแสดงสูตรวัตถุดิบ */
function itemName(sym: string): string {
  return DATA.disp[sym] ?? DATA.factories[sym]?.name ?? sym;
}

function recipe(f: Factory): string {
  return f.inputNames.join(" + ") || "เหมือง";
}

export default function ProfitMatrix() {
  const [sortKey, setSortKey] = useState<SortKey>("perday");
  const [profitOnly, setProfitOnly] = useState(false);
  const [selected, setSelected] = useState<string>(
    () => FACTORIES.reduce((a, b) => (bestRow(b).perday > bestRow(a).perday ? b : a)).output,
  );

  const list = useMemo(() => {
    const out = profitOnly
      ? FACTORIES.filter((f) => bestRow(f).profit > 0)
      : FACTORIES.slice();

    if (sortKey === "name") return out.sort((a, b) => a.name.localeCompare(b.name));
    if (sortKey === "pct")
      return out.sort(
        (a, b) => (bestPctRow(b).pct ?? -Infinity) - (bestPctRow(a).pct ?? -Infinity),
      );
    return out.sort((a, b) => bestRow(b).perday - bestRow(a).perday);
  }, [sortKey, profitOnly]);

  const detail = DATA.factories[selected] ?? list[0] ?? FACTORIES[0];

  return (
    <div className="layout">
      <div className="panel">
        <div className="phead">
          <h2>โรงงาน</h2>
          <div className="ctrls">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={sortKey === s.key ? "on" : undefined}
                onClick={() => setSortKey(s.key)}
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              className={profitOnly ? "on" : undefined}
              onClick={() => setProfitOnly((v) => !v)}
            >
              เฉพาะที่กำไร
            </button>
          </div>
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
                onClick={() => setSelected(f.output)}
              >
                <div className="nm">{f.name}</div>
                <div className={"pd " + (pos ? "pos" : "neg")}>{fmtc(b.perday)}</div>
                <div className="rc">
                  {recipe(f)} → {f.name}
                </div>
                <div className="lv">
                  Lv{b.lv} · {fmtPct(b.pct)}
                </div>
              </button>
            );
          })}
          {list.length === 0 && <div className="foot">ไม่มีโรงงานที่ผลิตแล้วกำไร</div>}
        </div>
      </div>

      <FactoryDetail factory={detail} />
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
          <span className={"chip " + ((bestPct.pct ?? -1) >= 0 ? "pos" : "neg")}>
            %ดีสุด: Lv{bestPct.lv} · {fmtPct(bestPct.pct)}
          </span>
        </div>
      </div>

      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th>Lv</th>
              <th>ผลผลิต/รอบ</th>
              <th>วัตถุดิบ/รอบ</th>
              <th>รอบ</th>
              <th>ต้นทุน</th>
              <th>รายได้</th>
              <th>กำไร/รอบ</th>
              <th>%</th>
              <th>กำไร/วัน</th>
            </tr>
          </thead>
          <tbody>
            {factory.rows.map((r) => {
              const pos = r.profit >= 0;
              const ins =
                Object.entries(r.inputs)
                  .map(([sym, amt]) => `${fmt(amt, amt < 10 ? 2 : 0)} ${itemName(sym)}`)
                  .join(" + ") || "—";
              return (
                <tr key={r.lv} className={r.lv === best.lv ? "bestrow" : undefined}>
                  <td>Lv{r.lv}</td>
                  <td>{fmt(r.out, r.out < 10 ? 2 : 0)}</td>
                  <td>{ins}</td>
                  <td>{dur(r.dur)}</td>
                  <td>{fmt(r.cost, 2)}</td>
                  <td>{fmt(r.rev, 2)}</td>
                  <td className={pos ? "pos" : "neg"}>{fmtc(r.profit)}</td>
                  <td className={pos ? "pos" : "neg"}>{fmtPct(r.pct)}</td>
                  <td className={r.perday >= 0 ? "pos" : "neg"}>{fmtc(r.perday)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
