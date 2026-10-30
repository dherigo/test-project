"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useApp } from "./AppState";
import { Card, diffColor, StatusBadge } from "./common";
import { money, moneyShort, pct, pp, NA } from "@/lib/format";

const TH = "whitespace-nowrap border-b border-line bg-panel px-2 py-2 text-xs font-semibold text-slate-700";
const TD = "px-2 py-2 align-top";

/** 12개 현장 비교표. 행을 펼치면 같은 페이지 안에서 공사기간·기록된 상황·대응 계획이 열립니다. */
export function CompareTable({ highlightFocus = false }: { highlightFocus?: boolean }) {
  const { derived, focusSite } = useApp();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const focusRef = useRef<HTMLTableRowElement | null>(null);

  // 점검 줄을 눌러 들어오면 그 현장 행을 펼치고 화면에 보이게 합니다.
  useEffect(() => {
    if (highlightFocus && focusSite) {
      setOpen((prev) => new Set(prev).add(focusSite));
      requestAnimationFrame(() => focusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
    }
  }, [highlightFocus, focusSite]);

  if (!derived) return null;
  const { metrics, agg } = derived;
  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (metrics.length === 0) {
    return (
      <Card>
        <h2 className="text-lg font-semibold">현장별 공정·기성 비교표</h2>
        <p className="mt-2 text-slate-600">표시할 현장이 없습니다(선택 범위 자료 없음).</p>
      </Card>
    );
  }

  return (
    <Card className="mb-4 !p-0">
      <div className="flex flex-wrap items-baseline gap-3 px-5 pt-4">
        <h2 className="text-lg font-semibold">현장별 공정·기성 비교표</h2>
        {agg && (
          <span className="text-sm text-slate-700">
            정상 {agg.counts.정상} · 주의 {agg.counts.주의} · 점검 {agg.counts.점검}
          </span>
        )}
        <span className="text-xs text-slate-500">공정차이가 작은 순(같으면 현장 ID 순) · 금액은 백만원</span>
      </div>
      <div className="overflow-x-auto px-5 pb-4 pt-3">
        <table className="w-full min-w-[1180px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={`${TH} text-center`}>상태</th>
              <th className={`${TH} text-left`}>현장</th>
              <th className={`${TH} text-left`}>현장명</th>
              <th className={`${TH} text-left`}>지역</th>
              <th className={`${TH} text-left`}>유형</th>
              <th className={`${TH} text-left`}>당월 주요 공종</th>
              <th className={`${TH} text-right`}>계약금액</th>
              <th className={`${TH} text-right`}>누적기성액</th>
              <th className={`${TH} text-right`}>기성률</th>
              <th className={`${TH} text-right`}>당월기성액</th>
              <th className={`${TH} text-right`}>계획공정률</th>
              <th className={`${TH} text-right`}>실제공정률</th>
              <th className={`${TH} text-right`}>공정차이</th>
              <th className={`${TH} text-center`}>기록</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const id = m.row.siteId;
              const isOpen = open.has(id);
              const focused = highlightFocus && focusSite === id;
              return (
                <Fragment key={id}>
                  <tr
                    ref={focused ? focusRef : undefined}
                    data-site={id}
                    data-focused={focused ? "true" : undefined}
                    className={`border-b border-slate-200 ${focused ? "bg-blue-50 outline outline-2 -outline-offset-2 outline-brand" : m.status === "점검" ? "bg-bad-bg/40" : ""}`}
                  >
                    <td className={`${TD} text-center`}>
                      <StatusBadge status={m.status} />
                    </td>
                    <td className={`${TD} font-mono text-xs`}>{id}</td>
                    <td className={`${TD} min-w-[170px] font-medium`}>{m.row.siteName.replace("[가상] ", "")}</td>
                    <td className={TD}>{m.row.region}</td>
                    <td className={TD}>{m.row.projectType}</td>
                    <td className={`${TD} min-w-[130px]`}>{m.row.currentWork}</td>
                    <td className={`${TD} num`}>{moneyShort(m.row.contractAmount)}</td>
                    <td className={`${TD} num`}>{money(m.row.cumulativeEarned)}</td>
                    <td className={`${TD} num font-semibold`}>{pct(m.earnedRate)}</td>
                    <td className={`${TD} num ${m.monthly === null ? "text-slate-500" : ""}`}>{m.monthly === null ? NA : money(m.monthly)}</td>
                    <td className={`${TD} num`}>{pct(m.row.plannedProgress)}</td>
                    <td className={`${TD} num`}>{pct(m.row.actualProgress)}</td>
                    <td className={`${TD} num font-bold ${diffColor(m.diff)}`}>{pp(m.diff)}</td>
                    <td className={`${TD} text-center`}>
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        aria-expanded={isOpen}
                        aria-label={`${id} 현장 기록 ${isOpen ? "닫기" : "펼치기"}`}
                        className="rounded-sm border border-line bg-white px-2 py-1 text-xs hover:bg-panel"
                      >
                        {isOpen ? "닫기 ▲" : "펼치기 ▼"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr data-detail={id} className="border-b border-slate-200">
                      <td colSpan={14} className="border-l-[3px] border-l-brand bg-canvas px-5 py-4">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                          <div>
                            <h3 className="mb-1 text-sm font-semibold">공사기간</h3>
                            <p>
                              착공일 {m.row.startDate}
                              <br />
                              계약상 준공일 {m.row.contractEndDate}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">계약상 일정이며 실제 완료일·예측일이 아닙니다.</p>
                          </div>
                          <div>
                            <h3 className="mb-1 text-sm font-semibold">
                              기록된 상황 <span className="ml-1 rounded-[3px] bg-panel px-1.5 py-0.5 text-[11px] font-normal">특이사항 분류: {m.row.issueCategory}</span>
                            </h3>
                            <p>{m.row.issueSummary || "기록 없음"}</p>
                          </div>
                          <div>
                            <h3 className="mb-1 text-sm font-semibold">계획된 대응</h3>
                            <p>{m.row.actionPlan || "기록 없음"}</p>
                            <p className="mt-1 text-xs text-slate-500">예정된 대응이며 완료나 효과를 뜻하지 않습니다.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          {agg && (
            <tfoot>
              <tr className="bg-panel font-semibold">
                <td colSpan={6} className={`${TD} text-center`}>
                  전체 {agg.siteCount}개 현장 합계 및 가중평균
                </td>
                <td className={`${TD} num`}>{moneyShort(agg.contract)}</td>
                <td className={`${TD} num`}>{money(agg.earned)}</td>
                <td className={`${TD} num`}>{pct(agg.earnedRate)}</td>
                <td className={`${TD} num`}>{agg.monthly === null ? NA : money(agg.monthly)}</td>
                <td className={`${TD} num`}>{pct(agg.planned)}</td>
                <td className={`${TD} num`}>{pct(agg.actual)}</td>
                <td className={`${TD} num ${diffColor(agg.diff)}`}>{pp(agg.diff)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}
