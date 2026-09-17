import { DATA } from "@/lib/data";
import { bestRow, fmtc, fmtPct } from "@/lib/format";

export default function SummaryTiles() {
  const facs = Object.values(DATA.factories);
  const profitable = facs.filter((f) => bestRow(f).profit > 0).length;

  const bestPerDay = facs
    .map(bestRow)
    .reduce((a, b) => (b.perday > a.perday ? b : a));

  let bestPct: number | null = null;
  for (const f of facs) {
    for (const r of f.rows) {
      if (r.pct != null && (bestPct === null || r.pct > bestPct)) bestPct = r.pct;
    }
  }

  return (
    <div className="tiles">
      <div className="tile">
        <div className="k">โรงงานทั้งหมด</div>
        <div className="v">{facs.length}</div>
      </div>
      <div className="tile">
        <div className="k">ผลิตขายได้กำไร</div>
        <div className="v pos">{profitable}</div>
      </div>
      <div className="tile">
        <div className="k">กำไร/วัน สูงสุด</div>
        <div className={"v " + (bestPerDay.perday >= 0 ? "pos" : "neg")}>
          {fmtc(bestPerDay.perday)}
        </div>
      </div>
      <div className="tile">
        <div className="k">% กำไรสูงสุด</div>
        <div className={"v " + (bestPct != null && bestPct >= 0 ? "pos" : "neg")}>
          {fmtPct(bestPct)}
        </div>
      </div>
    </div>
  );
}
