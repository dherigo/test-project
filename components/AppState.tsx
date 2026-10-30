"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  aggregate,
  compareByRisk,
  indexRows,
  listMonths,
  rankInspections,
  rowsInRange,
  siteMetrics,
  trend,
  type TrendPoint,
} from "@/lib/calc";
import { defaultFilters, reconcile } from "@/lib/filter";
import type { Aggregate, Filters, SiteMetrics, SiteRow } from "@/lib/types";

interface Derived {
  months: string[];
  /** 선택 월·필터 범위의 현장별 계산 결과(점검 우선 순) */
  metrics: SiteMetrics[];
  agg: Aggregate | null;
  ranking: SiteMetrics[];
  trend: TrendPoint[];
}

interface AppState {
  rows: SiteRow[] | null;
  filters: Filters;
  derived: Derived | null;
  notice: string | null;
  focusSite: string | null;
  /** 월·지역·유형·현장이나 자료가 바뀔 때마다 올라갑니다. AI 답변을 지우는 신호입니다. */
  rangeKey: number;
  loadRows: (rows: SiteRow[]) => void;
  setFilter: (partial: Partial<Filters>) => void;
  resetFilters: () => void;
  setFocusSite: (id: string | null) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppProvider 안에서만 쓸 수 있습니다.");
  return v;
}

const EMPTY_FILTERS: Filters = { month: "2026-09", region: "전체", projectType: "전체", siteId: "전체" };

export function AppProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<SiteRow[] | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [notice, setNotice] = useState<string | null>(null);
  const [focusSite, setFocusSiteState] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState(0);

  const loadRows = useCallback((next: SiteRow[]) => {
    setRows(next);
    setFilters(defaultFilters(next));
    setNotice(null);
    setFocusSiteState(null);
    setRangeKey((k) => k + 1);
  }, []);

  const setFilter = useCallback(
    (partial: Partial<Filters>) => {
      if (!rows) return;
      const wanted = { ...filters, ...partial };
      const { filters: next, siteReset } = reconcile(rows, wanted);
      if (JSON.stringify(next) === JSON.stringify(filters) && !siteReset) return;
      setFilters(next);
      setNotice(siteReset ? "고른 현장이 새 범위에 없어 현장 선택을 '전체'로 바꿨습니다." : null);
      setFocusSiteState(null);
      setRangeKey((k) => k + 1);
    },
    [rows, filters],
  );

  const resetFilters = useCallback(() => {
    if (!rows) return;
    setFilters(defaultFilters(rows));
    setNotice(null);
    setFocusSiteState(null);
    setRangeKey((k) => k + 1);
  }, [rows]);

  const derived = useMemo<Derived | null>(() => {
    if (!rows) return null;
    const index = indexRows(rows);
    const range = rowsInRange(rows, filters);
    const metrics = range.map((r) => siteMetrics(r, index)).sort(compareByRisk);
    return {
      months: listMonths(rows),
      metrics,
      agg: aggregate(range, index),
      ranking: rankInspections(metrics),
      trend: trend(rows, filters),
    };
  }, [rows, filters]);

  const value: AppState = {
    rows,
    filters,
    derived,
    notice,
    focusSite,
    rangeKey,
    loadRows,
    setFilter,
    resetFilters,
    setFocusSite: setFocusSiteState,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
