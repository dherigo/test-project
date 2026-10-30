"use client";

import { useState } from "react";
import { useApp } from "./AppState";
import { buildCsv, csvFileName, downloadCsv } from "@/lib/csv";
import { filterOptions } from "@/lib/filter";
import { monthLabel } from "@/lib/format";
import { ALL } from "@/lib/types";

const selectCls = "h-8 rounded-sm border border-line bg-white px-2 text-sm font-medium";

export function FilterBar({ showCsv = false }: { showCsv?: boolean }) {
  const { rows, filters, notice, setFilter, resetFilters } = useApp();
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  if (!rows) return null;
  const opt = filterOptions(rows, filters);
  const csv = showCsv ? buildCsv(rows, filters) : null;

  const exportCsv = () => {
    try {
      const text = buildCsv(rows, filters);
      if (text === null) {
        setCsvMessage("내보낼 자료가 없습니다.");
        return;
      }
      downloadCsv(text, csvFileName(filters));
      setCsvMessage(null);
    } catch {
      setCsvMessage("CSV를 만들지 못했습니다. 다시 눌러 주세요.");
    }
  };

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-panel p-3">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          기준 월
          <select className={selectCls} value={filters.month} onChange={(e) => setFilter({ month: e.target.value })} aria-label="기준 월">
            {opt.months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          지역
          <select className={selectCls} value={filters.region} onChange={(e) => setFilter({ region: e.target.value })} aria-label="지역">
            <option value={ALL}>전체 지역</option>
            {opt.regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          공사 유형
          <select className={selectCls} value={filters.projectType} onChange={(e) => setFilter({ projectType: e.target.value })} aria-label="공사 유형">
            <option value={ALL}>전체 유형</option>
            {opt.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          현장
          <select className={`${selectCls} max-w-[260px]`} value={filters.siteId} onChange={(e) => setFilter({ siteId: e.target.value })} aria-label="현장">
            <option value={ALL}>전체 현장 ({opt.sites.length}곳)</option>
            {opt.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} · {s.name.replace("[가상] ", "")}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={resetFilters} className="h-8 rounded-sm border border-line bg-white px-3 text-sm">
            필터 초기화
          </button>
          {showCsv && (
            <button
              type="button"
              onClick={exportCsv}
              disabled={csv === null}
              className="h-8 rounded-sm bg-navy px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              CSV 내보내기
            </button>
          )}
        </div>
      </div>
      {notice && (
        <p role="status" className="mt-2 text-sm text-warn">
          {notice}
        </p>
      )}
      {showCsv && csv === null && <p className="mt-2 text-sm text-slate-600">내보낼 자료가 없습니다.</p>}
      {csvMessage && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {csvMessage}
        </p>
      )}
    </div>
  );
}
