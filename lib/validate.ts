import type { ReadResult } from "./parse";
import { PROJECT_TYPES, REGIONS, REQUIRED_FIELDS, type SiteRow } from "./types";

export interface Issue {
  where: string; // 행 위치
  column: string;
  value: string;
  reason: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: Issue[];
  warnings: string[];
  infos: string[];
  rows: SiteRow[];
  summary: { rowCount: number; siteCount: number; firstMonth: string; lastMonth: string };
}

const FIRST_MONTH = "2025-10";
const LAST_MONTH = "2026-09";

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const show = (v: unknown) => (isEmpty(v) ? "(빈 값)" : String(v).slice(0, 40));

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return null;
}

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return `${month}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function validate(read: ReadResult): ValidationResult {
  const errors: Issue[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];
  const rows: SiteRow[] = [];
  const empty = (): ValidationResult => ({
    ok: false,
    errors,
    warnings,
    infos,
    rows: [],
    summary: { rowCount: 0, siteCount: 0, firstMonth: "", lastMonth: "" },
  });

  if (read.fatal) {
    errors.push({ where: "파일", column: "-", value: "-", reason: read.fatal });
    return empty();
  }

  if (read.kind === "csv") {
    infos.push("CSV에는 메타데이터가 없어 데이터 설명서의 단위(금액 백만원, 비율 %)로 읽습니다.");
  } else {
    const md = read.metadata;
    if (!md) {
      errors.push({ where: "metadata", column: "metadata", value: "(없음)", reason: "metadata가 없습니다." });
    } else {
      if (md.schemaVersion !== "2.0")
        errors.push({ where: "metadata", column: "schemaVersion", value: show(md.schemaVersion), reason: "schemaVersion이 2.0이 아닙니다." });
      if (md.moneyUnit !== "백만원")
        errors.push({ where: "metadata", column: "moneyUnit", value: show(md.moneyUnit), reason: "금액 단위가 백만원이 아닙니다." });
      if (md.progressUnit !== "percent_0_100")
        errors.push({ where: "metadata", column: "progressUnit", value: show(md.progressUnit), reason: "공정률 단위가 percent_0_100이 아닙니다." });
      const req = Array.isArray(md.requiredFields) ? (md.requiredFields as unknown[]) : [];
      const missing = REQUIRED_FIELDS.filter((f) => !req.includes(f));
      if (missing.length)
        errors.push({ where: "metadata", column: "requiredFields", value: show(req.length), reason: `필수 열 목록에 없음: ${missing.join(", ")}` });
    }
  }

  // 열 확인 (CSV는 머리글, JSON은 첫 기록)
  const header = new Set(read.header);
  const missingCols = REQUIRED_FIELDS.filter((f) => !header.has(f));
  if (read.records.length === 0 && missingCols.length === 0) {
    errors.push({ where: "파일", column: "-", value: "-", reason: "데이터 행이 없습니다." });
  }
  if (missingCols.length) {
    for (const c of missingCols) errors.push({ where: "머리글", column: c, value: "(없음)", reason: "필수 열이 없습니다." });
    return empty();
  }
  const extra = read.header.filter((h) => !(REQUIRED_FIELDS as readonly string[]).includes(h));
  if (extra.length) warnings.push(`필요하지 않은 열은 무시합니다: ${extra.join(", ")}`);

  // 행별 검사
  const built: { row: SiteRow; where: string }[] = [];
  for (const rec of read.records) {
    const v = rec.values;
    const before = errors.length;
    const bad = (column: string, reason: string) =>
      errors.push({ where: rec.where, column, value: show(v[column]), reason });

    for (const f of REQUIRED_FIELDS) if (isEmpty(v[f])) bad(f, "비어 있습니다. 빈 값을 0으로 바꾸지 않습니다.");

    const str = (f: string) => (isEmpty(v[f]) ? "" : String(v[f]).trim());
    const month = str("month");
    if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) bad("month", "YYYY-MM 형식이 아닙니다.");
      else if (month < FIRST_MONTH || month > LAST_MONTH) bad("month", `${FIRST_MONTH}~${LAST_MONTH} 범위를 벗어났습니다.`);
    }
    const siteId = str("siteId");
    if (siteId && !/^[A-L]$/.test(siteId)) bad("siteId", "현장 ID는 A~L 중 한 글자여야 합니다.");
    const siteName = str("siteName");
    if (siteName && !siteName.includes("[가상]")) bad("siteName", "현장명에 [가상] 표시가 없습니다.");

    const numField = (f: string, check: (n: number) => string | null) => {
      if (isEmpty(v[f])) return NaN;
      const n = toNumber(v[f]);
      if (n === null) {
        bad(f, "숫자가 아닙니다.");
        return NaN;
      }
      const msg = check(n);
      if (msg) bad(f, msg);
      return n;
    };
    const contract = numField("contractAmount", (n) => (n > 0 ? null : "0보다 커야 합니다."));
    const planned = numField("plannedProgress", (n) => (n >= 0 && n <= 100 ? null : `${n}은 0~100 범위를 벗어났습니다.`));
    const actual = numField("actualProgress", (n) => (n >= 0 && n <= 100 ? null : `${n}은 0~100 범위를 벗어났습니다.`));
    const earned = numField("cumulativeEarned", (n) => (n >= 0 ? null : "0 이상이어야 합니다."));
    if (Number.isFinite(earned) && Number.isFinite(contract) && contract > 0 && earned > contract)
      bad("cumulativeEarned", "계약금액보다 클 수 없습니다.");

    const region = str("region");
    if (region && !(REGIONS as readonly string[]).includes(region)) bad("region", `지역은 ${REGIONS.join("·")} 중 하나여야 합니다.`);
    const ptype = str("projectType");
    if (ptype && !(PROJECT_TYPES as readonly string[]).includes(ptype))
      bad("projectType", `공사 유형은 ${PROJECT_TYPES.join("·")} 중 하나여야 합니다.`);

    const start = str("startDate");
    const end = str("contractEndDate");
    if (start && !validDate(start)) bad("startDate", "YYYY-MM-DD 날짜 형식이 아닙니다.");
    if (end && !validDate(end)) bad("contractEndDate", "YYYY-MM-DD 날짜 형식이 아닙니다.");
    if (start && end && validDate(start) && validDate(end)) {
      if (!(start < end)) bad("startDate", "착공일이 계약상 준공일보다 늦거나 같습니다.");
      else if (month && /^\d{4}-\d{2}$/.test(month) && monthEnd(month) < start)
        bad("month", `착공일(${start}) 이전의 월입니다.`);
    }

    if (errors.length === before) {
      built.push({
        where: rec.where,
        row: {
          month,
          siteId,
          siteName,
          contractAmount: contract,
          plannedProgress: planned,
          actualProgress: actual,
          cumulativeEarned: earned,
          region,
          projectType: ptype,
          startDate: start,
          contractEndDate: end,
          currentWork: str("currentWork"),
          issueCategory: str("issueCategory"),
          issueSummary: str("issueSummary"),
          actionPlan: str("actionPlan"),
        },
      });
    }
  }

  // 행 사이의 검사: 중복 키, 같은 현장의 고정값, 누적값 감소
  const seen = new Map<string, string>();
  const first = new Map<string, SiteRow>();
  const clean: { row: SiteRow; where: string }[] = [];
  for (const b of built) {
    const k = `${b.row.month}|${b.row.siteId}`;
    if (seen.has(k)) {
      errors.push({ where: b.where, column: "month, siteId", value: k.replace("|", "/"), reason: `${seen.get(k)}과 같은 월·현장이 이미 있습니다(중복).` });
      continue;
    }
    seen.set(k, b.where);
    const f = first.get(b.row.siteId);
    if (!f) {
      first.set(b.row.siteId, b.row);
    } else {
      for (const col of ["siteName", "region", "projectType", "contractAmount", "startDate", "contractEndDate"] as const) {
        if (f[col] !== b.row[col])
          errors.push({ where: b.where, column: col, value: String(b.row[col]), reason: `${b.row.siteId} 현장의 ${col} 값이 다른 달과 다릅니다.` });
      }
    }
    clean.push(b);
  }

  const bySite = new Map<string, { row: SiteRow; where: string }[]>();
  for (const b of clean) bySite.set(b.row.siteId, [...(bySite.get(b.row.siteId) ?? []), b]);
  for (const list of bySite.values()) {
    list.sort((a, b) => a.row.month.localeCompare(b.row.month));
    for (let i = 1; i < list.length; i++) {
      for (const col of ["plannedProgress", "actualProgress", "cumulativeEarned"] as const) {
        if (list[i].row[col] < list[i - 1].row[col])
          errors.push({
            where: list[i].where,
            column: col,
            value: String(list[i].row[col]),
            reason: `${list[i].row.siteId} 현장의 ${list[i].row.month} 값이 전월(${list[i - 1].row.month})보다 줄었습니다.`,
          });
      }
    }
  }

  // 월 누락 경고
  const months = [...new Set(clean.map((b) => b.row.month))].sort();
  if (clean.length) {
    const missing: string[] = [];
    for (const [id, list] of bySite) {
      const have = new Set(list.map((b) => b.row.month));
      const gaps = months.filter((m) => m >= list[0].row.month && !have.has(m));
      if (gaps.length) missing.push(`${id}: ${gaps.join(", ")}`);
    }
    if (missing.length)
      warnings.push(`일부 월 자료가 없어 확인 가능한 행만 집계합니다. 전월이 없는 달의 당월기성액은 계산 불가입니다. (${missing.join(" / ")})`);
  }

  for (const b of clean) rows.push(b.row);
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    infos,
    rows: errors.length === 0 ? rows : [],
    summary: {
      rowCount: rows.length,
      siteCount: new Set(rows.map((r) => r.siteId)).size,
      firstMonth: months[0] ?? "",
      lastMonth: months[months.length - 1] ?? "",
    },
  };
}
