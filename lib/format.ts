import type { Factory, Row } from "./types";

/** ย่อตัวเลขใหญ่ให้อ่านออก: 1.2k / 3.40M / 1.88T */
export function fmt(n: number | null | undefined, d = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
  return n.toFixed(d);
}

/** ตัวเลขแบบมีเครื่องหมายเสมอ (+/−) */
export function fmtc(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "−";
  return s + fmt(Math.abs(n), Math.abs(n) < 10 ? 2 : 1);
}

/** % แบบมีเครื่องหมาย */
export function fmtPct(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  return (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
}

/** วินาที → 30s / 7.5m / 12h */
export function dur(s: number): string {
  if (s >= 3600) {
    const h = s / 3600;
    return (Number.isInteger(h) ? h : h.toFixed(1)) + "h";
  }
  if (s >= 60) {
    const m = s / 60;
    return (Number.isInteger(m) ? m : m.toFixed(1)) + "m";
  }
  return s + "s";
}

/** เลเวลที่กำไรต่อวันดีที่สุด */
export function bestRow(f: Factory): Row {
  return f.rows.reduce((a, b) => (b.perday > a.perday ? b : a));
}

/** เลเวลที่ % กำไรดีที่สุด */
export function bestPctRow(f: Factory): Row {
  return f.rows.reduce((a, b) => ((b.pct ?? -Infinity) > (a.pct ?? -Infinity) ? b : a));
}
