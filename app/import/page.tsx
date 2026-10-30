"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppState";
import { Card, diffColor, StatusBadge } from "@/components/common";
import { indexRows, siteMetrics } from "@/lib/calc";
import { money, moneyShort, NA, pct, pp } from "@/lib/format";
import { readFileText } from "@/lib/parse";
import { validate, type ValidationResult } from "@/lib/validate";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SHOWN_ERRORS = 20;

interface Checked {
  fileName: string;
  result: ValidationResult;
}

export default function ImportPage() {
  const { rows, loadRows } = useApp();
  const [checked, setChecked] = useState<Checked | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setDone(null);
    if (file.size > MAX_BYTES) {
      setChecked({
        fileName: file.name,
        result: {
          ok: false,
          errors: [{ where: "파일", column: "-", value: `${Math.round(file.size / 1024 / 1024)}MB`, reason: "10MB를 넘는 파일은 가져올 수 없습니다." }],
          warnings: [],
          infos: [],
          rows: [],
          summary: { rowCount: 0, siteCount: 0, firstMonth: "", lastMonth: "" },
        },
      });
      return;
    }
    let text = "";
    try {
      text = await file.text();
    } catch {
      text = "";
    }
    setChecked({ fileName: file.name, result: validate(readFileText(file.name, text)) });
  };

  const preview = useMemo(() => {
    if (!checked?.result.ok) return [];
    const idx = indexRows(checked.result.rows);
    return checked.result.rows.slice(0, 5).map((r) => siteMetrics(r, idx));
  }, [checked]);

  const cancel = () => {
    setChecked(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const apply = () => {
    if (!checked?.result.ok) return;
    loadRows(checked.result.rows);
    setDone(checked.result.rows.length);
    setChecked(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const r = checked?.result;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">월간 현장 공정·기성 자료 가져오기</h1>
        <p className="mt-1 text-slate-600">
          CSV 또는 JSON 파일을 검사하고 미리 본 뒤 전체를 바꿉니다. 오류가 있거나 취소하면 지금 자료가 그대로 유지됩니다.
        </p>
        <p className="mt-1 text-sm" data-testid="current-data">
          지금 자료: <strong>{rows ? `${rows.length}행` : "없음"}</strong>
        </p>
      </div>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">1. 파일 고르기</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          className={`flex flex-col items-center gap-3 rounded-md border-2 border-dashed p-8 text-center ${dragging ? "border-brand bg-blue-50" : "border-line bg-panel"}`}
        >
          <label className="cursor-pointer rounded-sm bg-navy px-4 py-2 text-sm font-semibold text-white">
            파일 선택
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.json"
              className="sr-only"
              data-testid="file-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
          <p className="text-sm text-slate-600">또는 이 영역에 파일을 끌어다 놓으세요. (.csv, .json · UTF-8 · 최대 10MB)</p>
          {checked && <p className="text-sm font-medium">선택한 파일: {checked.fileName}</p>}
        </div>
      </Card>

      {r && (
        <Card data-testid="check-result">
          <h2 className="mb-3 text-lg font-semibold">2. 검사 결과</h2>
          {r.ok ? (
            <>
              <p className="rounded-md bg-ok-bg px-3 py-2 font-semibold text-ok" role="status">
                검사 통과 — {r.summary.rowCount}행 · {r.summary.siteCount}개 현장 · {r.summary.firstMonth}~{r.summary.lastMonth} · 오류 0
              </p>
              {r.infos.map((t) => (
                <p key={t} className="mt-2 text-sm text-slate-600">
                  ℹ {t}
                </p>
              ))}
              {r.warnings.map((t) => (
                <p key={t} className="mt-2 text-sm text-warn" role="status">
                  ⚠ {t}
                </p>
              ))}
              <h3 className="mb-2 mt-4 font-semibold">반영 전 미리보기 (앞 5행 · 계산된 4개 열 포함)</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-panel text-xs">
                      {["month", "siteId", "현장명", "지역", "유형", "계약금액", "누적기성액", "기성률", "당월기성액", "계획", "실제", "공정차이", "상태"].map((h) => (
                        <th key={h} className="border-b border-line px-2 py-2 text-left font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((m) => (
                      <tr key={`${m.row.month}${m.row.siteId}`} className="border-b border-slate-200">
                        <td className="px-2 py-1.5">{m.row.month}</td>
                        <td className="px-2 py-1.5">{m.row.siteId}</td>
                        <td className="px-2 py-1.5">{m.row.siteName.replace("[가상] ", "")}</td>
                        <td className="px-2 py-1.5">{m.row.region}</td>
                        <td className="px-2 py-1.5">{m.row.projectType}</td>
                        <td className="num px-2 py-1.5">{moneyShort(m.row.contractAmount)}</td>
                        <td className="num px-2 py-1.5">{money(m.row.cumulativeEarned)}</td>
                        <td className="num px-2 py-1.5">{pct(m.earnedRate)}</td>
                        <td className="num px-2 py-1.5">{m.monthly === null ? NA : money(m.monthly)}</td>
                        <td className="num px-2 py-1.5">{pct(m.row.plannedProgress)}</td>
                        <td className="num px-2 py-1.5">{pct(m.row.actualProgress)}</td>
                        <td className={`num px-2 py-1.5 ${diffColor(m.diff)}`}>{pp(m.diff)}</td>
                        <td className="px-2 py-1.5">
                          <StatusBadge status={m.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <p className="rounded-md bg-bad-bg px-3 py-2 font-semibold text-bad" role="alert">
                가져오기 오류 — {r.errors.length}건 · 이 파일은 반영하지 않습니다. 지금 자료는 그대로 유지됩니다.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-[13px]" data-testid="error-table">
                  <thead>
                    <tr className="bg-panel text-xs">
                      <th className="border-b border-line px-2 py-2 text-left">위치</th>
                      <th className="border-b border-line px-2 py-2 text-left">열</th>
                      <th className="border-b border-line px-2 py-2 text-left">값</th>
                      <th className="border-b border-line px-2 py-2 text-left">이유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.errors.slice(0, MAX_SHOWN_ERRORS).map((e, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="px-2 py-1.5 font-medium">{e.where}</td>
                        <td className="px-2 py-1.5">{e.column}</td>
                        <td className="px-2 py-1.5">{e.value}</td>
                        <td className="px-2 py-1.5">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {r.errors.length > MAX_SHOWN_ERRORS && (
                <p className="mt-2 text-sm text-slate-600">처음 {MAX_SHOWN_ERRORS}건만 보여 드립니다. 외 {r.errors.length - MAX_SHOWN_ERRORS}건.</p>
              )}
            </>
          )}
        </Card>
      )}

      {r && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">3. 반영</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={cancel} className="h-10 rounded-sm border border-line bg-white px-4 text-sm font-medium">
              취소하고 기존 자료 유지
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!r.ok}
              className="h-10 rounded-sm bg-navy px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {r.ok ? `검사된 자료로 전체 교체 (${r.summary.rowCount}행)` : "오류가 있어 교체할 수 없습니다"}
            </button>
          </div>
        </Card>
      )}

      {done !== null && (
        <Card className="border-green-300 bg-ok-bg" data-testid="import-done">
          <p className="font-semibold text-ok">교체 완료 — 지금 자료는 {done}행입니다. (누적하지 않고 전체를 바꿨습니다)</p>
          <Link href="/" className="mt-2 inline-block text-sm font-semibold text-brand">
            현황 요약 보기 →
          </Link>
        </Card>
      )}
    </div>
  );
}
