import { indexRows, rowsInRange, siteMetrics, round1 } from "./calc";
import { NA } from "./format";
import { REQUIRED_FIELDS, type Filters, type SiteRow } from "./types";

export const CSV_ADDED_COLUMNS = ["기성률(%)", "공정차이(pp)", "상태", "당월기성액(백만원)"] as const;

function cell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 지금 필터 범위의 행을 CSV 글자로 만듭니다.
 * 원본 15열 뒤에 기성률·공정차이·상태·당월기성액을 더합니다. 데이터 행이 없으면 null.
 * (엑셀용 BOM은 내려받을 때 붙입니다.)
 */
export function buildCsv(allRows: SiteRow[], f: Filters): string | null {
  const range = rowsInRange(allRows, f);
  if (range.length === 0) return null;
  const index = indexRows(allRows);
  const header = [...REQUIRED_FIELDS, ...CSV_ADDED_COLUMNS].map(cell).join(",");
  const lines = range.map((row) => {
    const m = siteMetrics(row, index);
    const original = REQUIRED_FIELDS.map((k) => cell(row[k]));
    const added = [
      round1(m.earnedRate).toFixed(1),
      round1(m.diff).toFixed(1),
      m.status,
      m.monthly === null ? NA : round1(m.monthly).toFixed(1),
    ].map(cell);
    return [...original, ...added].join(",");
  });
  return [header, ...lines].join("\r\n") + "\r\n";
}

export function csvFileName(f: Filters): string {
  const part = (s: string) => s.replace(/[\\/:*?"<>|\s]/g, "");
  return `현장공정기성_${f.month}_${part(f.region)}_${part(f.projectType)}_${part(f.siteId)}.csv`;
}

/** 브라우저에서 BOM을 붙여 내려받습니다. */
export function downloadCsv(text: string, fileName: string) {
  const blob = new Blob(["﻿", text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
