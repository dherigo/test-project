"use client";

import { Card, diffColor, StatusBadge } from "./common";
import { money, moneyShort, NA, pct, pp } from "@/lib/format";
import type { Aggregate } from "@/lib/types";

/** 큰 숫자 4개: 기성률, 계획 공정률, 실제 공정률, 공정차이. 자료가 없으면 모두 "계산 불가". */
export function KpiCards({ agg }: { agg: Aggregate | null }) {
  const big = "mt-2 text-[32px] font-bold leading-10 tracking-tight";
  return (
    <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <div className="text-xs text-slate-600">전체 기성률 (금액 기준)</div>
        <div className={big}>{agg ? pct(agg.earnedRate) : NA}</div>
        <div className="mt-2 h-1 rounded bg-panel">
          <div className="h-1 rounded bg-brand" style={{ width: `${agg ? Math.min(100, agg.earnedRate) : 0}%` }} />
        </div>
        <div className="mt-2 text-xs text-slate-600">
          {agg ? `누적 기성액 ${money(agg.earned)} / 계약금액 ${moneyShort(agg.contract)} (백만원)` : "선택 범위 자료 없음"}
        </div>
      </Card>
      <Card>
        <div className="text-xs text-slate-600">계획 공정률 (가중평균)</div>
        <div className={big}>{agg ? pct(agg.planned) : NA}</div>
        <div className="mt-2 text-xs text-slate-600">계약금액으로 가중한 월말 누적 계획공정률</div>
      </Card>
      <Card>
        <div className="text-xs text-slate-600">실제 공정률 (가중평균)</div>
        <div className={big}>{agg ? pct(agg.actual) : NA}</div>
        <div className="mt-2 text-xs text-slate-600">계약금액으로 가중한 월말 누적 실제공정률</div>
      </Card>
      <Card>
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>공정차이 (실제 − 계획)</span>
          {agg && <StatusBadge status={agg.status} />}
        </div>
        <div className={`${big} ${agg ? diffColor(agg.diff) : "text-slate-500"}`}>{agg ? pp(agg.diff) : NA}</div>
        <div className="mt-2 text-xs text-slate-600">
          {agg ? `정상 ${agg.counts.정상}곳 · 주의 ${agg.counts.주의}곳 · 점검 ${agg.counts.점검}곳` : "선택 범위 자료 없음"}
        </div>
      </Card>
    </div>
  );
}
