import type { Aggregate, Calc, Filters, SiteMetrics, SiteRow, Status } from "./types";
import { ALL } from "./types";

/** 부동소수점 잡음(65-70 = -5.000000000000007 같은 값)을 없앱니다. */
export function clean(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/** 소수 첫째 자리 반올림(0.05는 올림, 음수는 절댓값 기준). 마지막 표시 단계에서만 씁니다. */
export function round1(x: number): number {
  const v = clean(x);
  const sign = v < 0 ? -1 : 1;
  const r = Math.round(Number(Math.abs(v) + "e1")) / 10;
  return r === 0 ? 0 : sign * r;
}

export function statusOf(diff: number): Status {
  const d = clean(diff);
  if (d >= 0) return "정상";
  if (d > -5) return "주의";
  return "점검";
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function key(month: string, siteId: string) {
  return `${month}|${siteId}`;
}

export function indexRows(rows: SiteRow[]): Map<string, SiteRow> {
  return new Map(rows.map((r) => [key(r.month, r.siteId), r]));
}

export function listMonths(rows: SiteRow[]): string[] {
  return [...new Set(rows.map((r) => r.month))].sort();
}

export function siteMetrics(row: SiteRow, index: Map<string, SiteRow>): SiteMetrics {
  const diff = clean(row.actualProgress - row.plannedProgress);
  const prev = index.get(key(prevMonth(row.month), row.siteId));
  return {
    row,
    diff,
    status: statusOf(diff),
    earnedRate: (row.cumulativeEarned / row.contractAmount) * 100,
    monthly: prev ? clean(row.cumulativeEarned - prev.cumulativeEarned) : null,
  };
}

/** 점검 순위: 공정차이 오름차순, 같으면 현장 ID 오름차순. */
export function compareByRisk(a: SiteMetrics, b: SiteMetrics): number {
  if (a.diff !== b.diff) return a.diff - b.diff;
  return a.row.siteId.localeCompare(b.row.siteId);
}

/** 한 달·한 범위의 행들을 합칩니다. 행이 없으면 null(계산 불가). */
export function aggregate(rows: SiteRow[], index: Map<string, SiteRow>): Aggregate | null {
  if (rows.length === 0) return null;
  const metrics = rows.map((r) => siteMetrics(r, index));
  const contract = clean(rows.reduce((s, r) => s + r.contractAmount, 0));
  if (!(contract > 0)) return null;
  const earned = clean(rows.reduce((s, r) => s + r.cumulativeEarned, 0));
  const planned = clean(rows.reduce((s, r) => s + r.contractAmount * r.plannedProgress, 0)) / contract;
  const actual = clean(rows.reduce((s, r) => s + r.contractAmount * r.actualProgress, 0)) / contract;
  const diff = clean(actual - planned);
  const counts: Record<Status, number> = { 정상: 0, 주의: 0, 점검: 0 };
  for (const m of metrics) counts[m.status]++;
  const monthlyList: Calc[] = metrics.map((m) => m.monthly);
  const monthly = monthlyList.some((v) => v === null)
    ? null
    : clean((monthlyList as number[]).reduce((s, v) => s + v, 0));
  return {
    siteCount: rows.length,
    contract,
    earned,
    earnedRate: (earned / contract) * 100,
    planned,
    actual,
    diff,
    status: statusOf(diff),
    monthly,
    counts,
  };
}

/** 지역·유형·현장 조건에 맞는 현장 ID 목록(월과 무관). */
export function sitesInScope(rows: SiteRow[], f: Pick<Filters, "region" | "projectType" | "siteId">): string[] {
  const ids = new Set<string>();
  for (const r of rows) {
    if (f.region !== ALL && r.region !== f.region) continue;
    if (f.projectType !== ALL && r.projectType !== f.projectType) continue;
    if (f.siteId !== ALL && r.siteId !== f.siteId) continue;
    ids.add(r.siteId);
  }
  return [...ids].sort();
}

/** 선택 월·필터 범위의 행(현장 ID 순). */
export function rowsInRange(rows: SiteRow[], f: Filters): SiteRow[] {
  return rows
    .filter(
      (r) =>
        r.month === f.month &&
        (f.region === ALL || r.region === f.region) &&
        (f.projectType === ALL || r.projectType === f.projectType) &&
        (f.siteId === ALL || r.siteId === f.siteId),
    )
    .sort((a, b) => a.siteId.localeCompare(b.siteId));
}

export interface TrendPoint {
  month: string;
  agg: Aggregate | null;
}

/** 같은 필터로 첫 달~선택 월을 매월 따로 집계합니다. */
export function trend(rows: SiteRow[], f: Filters): TrendPoint[] {
  const index = indexRows(rows);
  return listMonths(rows)
    .filter((m) => m <= f.month)
    .map((month) => ({ month, agg: aggregate(rowsInRange(rows, { ...f, month }), index) }));
}

export function rankInspections(metrics: SiteMetrics[]): SiteMetrics[] {
  return metrics.filter((m) => m.status === "점검").sort(compareByRisk);
}
