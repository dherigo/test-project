"use client";

import { useState } from "react";
import { Card } from "./common";
import { useApp } from "./AppState";
import { money, NA, pct, pp } from "@/lib/format";
import { round1 } from "@/lib/calc";

const W = 640;
const H = 260;
const PAD = { l: 44, r: 16, t: 16, b: 32 };

/** 선택 월까지 계획·실제 누적 공정률 추이(계획은 점선, 실제는 실선). */
export function TrendChart() {
  const { derived, filters } = useApp();
  const [hover, setHover] = useState<number | null>(null);
  if (!derived) return null;
  const points = derived.trend;
  const n = points.length;
  const x = (i: number) => PAD.l + (n <= 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (n - 1));
  const y = (v: number) => PAD.t + ((100 - v) / 100) * (H - PAD.t - PAD.b);

  // 자료가 없는 달에서는 선을 이어 그리지 않습니다.
  const path = (pick: (a: NonNullable<(typeof points)[number]["agg"]>) => number) => {
    let d = "";
    let pen = false;
    points.forEach((p, i) => {
      if (!p.agg) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(pick(p.agg)).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const shown = hover ?? points.findIndex((p) => p.month === filters.month);
  const sp = points[shown];

  return (
    <Card className="min-w-0">
      <h2 className="text-lg font-semibold">누적 공정률 추이 (계획 대 실제)</h2>
      <p className="text-xs text-slate-600">
        {points[0]?.month} ~ {filters.month} · 같은 월·지역·유형·현장 범위로 매월 따로 집계
      </p>
      {n === 0 ? (
        <p className="mt-4 text-slate-600">선택 범위 자료 없음</p>
      ) : (
        <>
          <p className="mt-2 min-h-5 text-sm" aria-live="polite" data-testid="trend-readout">
            {sp ? (
              sp.agg ? (
                <>
                  <strong>{sp.month}</strong> 계획 {pct(sp.agg.planned)} · 실제 {pct(sp.agg.actual)} · 공정차이 {pp(sp.agg.diff)}
                </>
              ) : (
                <>
                  <strong>{sp.month}</strong> 자료 없음
                </>
              )
            ) : null}
          </p>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label="계획 대 실제 누적 공정률 추이 차트">
            {[0, 20, 40, 60, 80, 100].map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
                <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#64748b">
                  {t}%
                </text>
              </g>
            ))}
            {shown >= 0 && <rect x={x(shown) - 14} y={PAD.t} width={28} height={H - PAD.t - PAD.b} fill="#eff6ff" />}
            <path d={path((a) => a.planned)} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 4" />
            <path d={path((a) => a.actual)} fill="none" stroke="#0f172a" strokeWidth="2.5" />
            {points.map((p, i) => (
              <g key={p.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={x(i) - 14} y={PAD.t} width={28} height={H - PAD.t - PAD.b} fill="transparent" />
                {p.agg && <circle cx={x(i)} cy={y(p.agg.actual)} r={p.month === filters.month ? 4 : 2.5} fill="#0f172a" />}
                <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#64748b">
                  {p.month.slice(2).replace("-", ".")}
                </text>
              </g>
            ))}
          </svg>
          <div className="mt-1 flex gap-4 text-xs text-slate-600">
            <span>┅ 계획 공정률(%)</span>
            <span>━ 실제 공정률(%)</span>
          </div>
        </>
      )}
    </Card>
  );
}

/** 월별 당월기성액 막대. 누적기성액은 옆에 따로 적습니다(두 값을 더하거나 서로 대신하지 않습니다). */
export function MonthlyBars() {
  const { derived, filters } = useApp();
  if (!derived) return null;
  const points = derived.trend;
  const max = Math.max(0, ...points.map((p) => p.agg?.monthly ?? 0));
  return (
    <Card className="min-w-0">
      <h2 className="text-lg font-semibold">월별 기성 (당월기성액과 누적기성액)</h2>
      <p className="text-xs text-slate-600">단위: 백만원 · 막대는 당월기성액, 오른쪽 글자는 그 달 말 누적기성액</p>
      {points.length === 0 ? (
        <p className="mt-4 text-slate-600">선택 범위 자료 없음</p>
      ) : (
        <ul className="mt-3 space-y-1.5" data-testid="monthly-bars">
          {points.map((p) => {
            const m = p.agg?.monthly ?? null;
            const current = p.month === filters.month;
            return (
              <li key={p.month} data-month={p.month} className={`grid grid-cols-[64px_1fr_190px] items-center gap-2 rounded-sm px-2 py-1 text-xs ${current ? "bg-blue-50" : ""}`}>
                <span className="font-medium">{p.month}</span>
                <div className="h-3 rounded bg-panel">
                  {m !== null && max > 0 && <div className={`h-3 rounded ${current ? "bg-brand" : "bg-slate-500"}`} style={{ width: `${(Math.max(0, m) / max) * 100}%` }} />}
                </div>
                <span className="text-right">
                  {!p.agg ? (
                    "자료 없음"
                  ) : (
                    <>
                      당월 <strong>{m === null ? NA : money(m)}</strong> / 누적 {money(round1(p.agg.earned))}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
