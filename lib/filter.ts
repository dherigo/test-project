import { listMonths, sitesInScope } from "./calc";
import { ALL, PROJECT_TYPES, REGIONS, type Filters, type SiteRow } from "./types";

export const DEFAULT_MONTH = "2026-09";

/** 자료를 가져온 직후·필터 초기화 때의 필터. 2026-09가 없으면 자료의 가장 최근 월. */
export function defaultFilters(rows: SiteRow[]): Filters {
  const months = listMonths(rows);
  const month = months.includes(DEFAULT_MONTH) ? DEFAULT_MONTH : (months[months.length - 1] ?? DEFAULT_MONTH);
  return { month, region: ALL, projectType: ALL, siteId: ALL };
}

export interface Reconciled {
  filters: Filters;
  /** 현장 선택이 범위에서 빠져 "전체"로 되돌려졌는지 */
  siteReset: boolean;
}

/** 지역·유형을 바꿔 선택한 현장이 범위에서 빠지면 현장을 전체로 되돌립니다. */
export function reconcile(rows: SiteRow[], f: Filters): Reconciled {
  if (f.siteId !== ALL) {
    const inScope = sitesInScope(rows, { region: f.region, projectType: f.projectType, siteId: ALL });
    if (!inScope.includes(f.siteId)) return { filters: { ...f, siteId: ALL }, siteReset: true };
  }
  return { filters: f, siteReset: false };
}

export function filterOptions(rows: SiteRow[], f: Filters) {
  const months = listMonths(rows);
  const regions = REGIONS.filter((r) => rows.some((x) => x.region === r));
  const types = PROJECT_TYPES.filter((t) => rows.some((x) => x.projectType === t));
  const ids = sitesInScope(rows, { region: f.region, projectType: f.projectType, siteId: ALL });
  const names = new Map(rows.map((r) => [r.siteId, r.siteName]));
  const sites = ids.map((id) => ({ id, name: names.get(id) ?? id }));
  return { months, regions, types, sites };
}

export function describeScope(f: Filters): string {
  return `기준 월 ${f.month} / 지역 ${f.region} / 유형 ${f.projectType} / 현장 ${f.siteId}`;
}
