import { describe, expect, it } from "vitest";
import { buildCsv, CSV_ADDED_COLUMNS } from "@/lib/csv";
import { parseCsvText } from "@/lib/parse";
import { defaultFilters, filterOptions, reconcile } from "@/lib/filter";
import { REQUIRED_FIELDS } from "@/lib/types";
import { filters, loadRows } from "./helpers";

const rows = loadRows();
const parse = (text: string) => parseCsvText(text).rows;

describe("필터", () => {
  it("처음에는 2026-09·전체", () => {
    expect(defaultFilters(rows)).toEqual({ month: "2026-09", region: "전체", projectType: "전체", siteId: "전체" });
  });
  it("2026-09가 없으면 자료의 가장 최근 월", () => {
    expect(defaultFilters(rows.filter((r) => r.month <= "2026-03")).month).toBe("2026-03");
  });
  it("지역 변경으로 현장이 범위에서 빠지면 현장을 전체로 되돌림", () => {
    const r = reconcile(rows, filters({ siteId: "D", region: "인천" }));
    expect(r.siteReset).toBe(true);
    expect(r.filters.siteId).toBe("전체");
  });
  it("현장이 범위에 남으면 그대로", () => {
    const r = reconcile(rows, filters({ siteId: "A", region: "인천" }));
    expect(r.siteReset).toBe(false);
    expect(r.filters.siteId).toBe("A");
  });
  it("현장 목록은 지역·유형 범위의 현장만", () => {
    expect(filterOptions(rows, filters({ region: "인천" })).sites.map((s) => s.id)).toEqual(["A", "G"]);
    expect(filterOptions(rows, filters()).sites).toHaveLength(12);
  });
});

describe("CSV 내보내기", () => {
  it("D만: 헤더 + 데이터 1행, 계산 4열 포함", () => {
    const out = parse(buildCsv(rows, filters({ siteId: "D" }))!);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual([...REQUIRED_FIELDS, ...CSV_ADDED_COLUMNS]);
    expect(out[1].slice(-4)).toEqual(["69.4", "-10.7", "점검", "3339.6"]);
    expect(out[1][0]).toBe("2026-09");
    expect(out[1][1]).toBe("D");
    expect(out[1][3]).toBe("72600");
  });
  it("인천·공동주택: 데이터 2행(A·G)", () => {
    const out = parse(buildCsv(rows, filters({ region: "인천", projectType: "공동주택" }))!);
    expect(out.slice(1).map((r) => r[1])).toEqual(["A", "G"]);
  });
  it("9월 전체: 데이터 12행", () => {
    expect(parse(buildCsv(rows, filters())!)).toHaveLength(13);
  });
  it("2025-10 전체: 당월기성액이 모두 계산 불가(누적액으로 대신하지 않음)", () => {
    const out = parse(buildCsv(rows, filters({ month: "2025-10" }))!);
    expect(out.slice(1).every((r) => r[r.length - 1] === "계산 불가")).toBe(true);
  });
  it("J의 7월은 0.0", () => {
    const out = parse(buildCsv(rows, filters({ month: "2026-07", siteId: "J" }))!);
    expect(out[1][out[1].length - 1]).toBe("0.0");
  });
  it("쉼표가 든 값은 따옴표로 감싸 열이 밀리지 않는다", () => {
    const tweaked = rows.map((r) => (r.siteId === "D" ? { ...r, issueSummary: "a,b \"c\"" } : r));
    const out = parse(buildCsv(tweaked, filters({ siteId: "D" }))!);
    expect(out[1]).toHaveLength(out[0].length);
    expect(out[1][13]).toBe('a,b "c"');
  });
  it("범위에 자료가 없으면 null", () => {
    expect(buildCsv(rows, filters({ region: "강원", projectType: "물류시설" }))).toBeNull();
  });
});
