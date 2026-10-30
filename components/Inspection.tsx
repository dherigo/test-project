"use client";

import { useRouter } from "next/navigation";
import { useApp } from "./AppState";
import { Card, diffColor } from "./common";
import { pct, pp } from "@/lib/format";

/** 점검 현장 줄: 공정차이가 작은 순. 누르면 현장별 비교표로 가서 그 줄을 강조하고 기록을 펼칩니다. */
export function InspectionCards() {
  const { derived, setFocusSite } = useApp();
  const router = useRouter();
  if (!derived) return null;
  const { ranking } = derived;

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-lg font-semibold">점검이 필요한 현장</h2>
        <span className="text-xs text-slate-600">공정차이 -5.0pp 이하 · 공정차이가 작은 순(같으면 현장 ID 순)</span>
      </div>
      {ranking.length === 0 ? (
        <div className="rounded-md border border-line bg-panel p-4 text-slate-700">
          <strong>점검 대상 없음</strong> — 이 범위·월에는 공정차이가 -5.0pp 이하인 현장이 없습니다.
        </div>
      ) : (
        <ol className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {ranking.map((m, i) => (
            <li key={m.row.siteId}>
              <button
                type="button"
                onClick={() => {
                  setFocusSite(m.row.siteId);
                  router.push("/compare");
                }}
                className="w-full rounded-md border border-red-300 bg-white p-4 text-left hover:bg-bad-bg/40"
                aria-label={`${m.row.siteId} 현장 점검 ${i + 1}순위, 비교표에서 기록 보기`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-[3px] bg-bad px-1.5 py-0.5 text-[11px] font-semibold text-white">점검 #{i + 1}</span>
                  <span className={`text-sm font-bold ${diffColor(m.diff)}`}>{pp(m.diff)}</span>
                </div>
                <div className="mt-2 font-semibold">
                  {m.row.siteId} · {m.row.siteName.replace("[가상] ", "")}
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500">계획 공정률</dt>
                    <dd className="font-semibold">{pct(m.row.plannedProgress)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">실제 공정률</dt>
                    <dd className="font-semibold text-bad">{pct(m.row.actualProgress)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">기성률</dt>
                    <dd className="font-semibold">{pct(m.earnedRate)}</dd>
                  </div>
                </dl>
                <p className="mt-2 line-clamp-2 text-xs text-slate-600">기록된 상황: {m.row.issueSummary}</p>
                <span className="mt-2 inline-block text-xs font-semibold text-brand">현장 비교표에서 상세 기록 펼쳐보기 →</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
