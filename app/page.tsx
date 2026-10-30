"use client";

import { useApp } from "@/components/AppState";
import { MonthlyBars, TrendChart } from "@/components/Charts";
import { CompareTable } from "@/components/CompareTable";
import { EmptyData, NoRange } from "@/components/common";
import { FilterBar } from "@/components/FilterBar";
import { InspectionCards } from "@/components/Inspection";
import { KpiCards } from "@/components/Kpi";

/** 현황 요약(첫 화면): 필터 → 큰 숫자 4개 → 점검 줄 → 12개 현장 비교표 → 추이와 월별 기성. */
export default function HomePage() {
  const { rows, derived } = useApp();
  if (!rows || !derived) return <EmptyData />;
  return (
    <>
      <FilterBar showCsv />
      {derived.metrics.length === 0 && <div className="mb-4"><NoRange /></div>}
      <KpiCards agg={derived.agg} />
      {derived.metrics.length > 0 && (
        <>
          <InspectionCards />
          <CompareTable />
        </>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TrendChart />
        <MonthlyBars />
      </div>
    </>
  );
}
