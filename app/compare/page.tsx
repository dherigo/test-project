"use client";

import { useApp } from "@/components/AppState";
import { CompareTable } from "@/components/CompareTable";
import { EmptyData, NoRange } from "@/components/common";
import { FilterBar } from "@/components/FilterBar";

export default function ComparePage() {
  const { rows, derived } = useApp();
  if (!rows || !derived) return <EmptyData />;
  return (
    <>
      <h1 className="mb-3 text-2xl font-bold tracking-tight">현장별 공정·기성 비교표</h1>
      <FilterBar showCsv />
      {derived.metrics.length === 0 ? <NoRange /> : <CompareTable highlightFocus />}
    </>
  );
}
