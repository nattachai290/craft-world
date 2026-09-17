"use client";

import { bestRow, fmtc, fmtPct } from "@/lib/format";
import type { CostedRow } from "@/lib/cost";

export default function SummaryTiles({ costed }: { costed: Map<string, CostedRow[]> }) {
  const all = [...costed.values()];
  const bests = all.map(bestRow);
  const profitable = bests.filter((r) => r.profit > 0).length;
  const bestPerDay = bests.reduce((a, b) => (b.perday > a.perday ? b : a));

  let bestPct: number | null = null;
  for (const rows of all) {
    for (const r of rows) {
      if (r.pct != null && (bestPct === null || r.pct > bestPct)) bestPct = r.pct;
    }
  }

  return (
    <div className="tiles">
      <div className="tile">
        <div className="k">โรงงานทั้งหมด</div>
        <div className="v">{all.length}</div>
      </div>
      <div className="tile">
        <div className="k">ผลิตขายได้กำไร</div>
        <div className={"v " + (profitable > 0 ? "pos" : "neg")}>{profitable}</div>
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
