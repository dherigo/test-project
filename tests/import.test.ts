import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readCsv, readFileText, parseCsvText } from "@/lib/parse";
import { validate } from "@/lib/validate";
import { dataPath, loadFile } from "./helpers";

describe("정상 파일", () => {
  it("CSV 144행·12현장·2025-10~2026-09", () => {
    const v = loadFile("현장공정기성.csv");
    expect(v.ok).toBe(true);
    expect(v.summary).toEqual({ rowCount: 144, siteCount: 12, firstMonth: "2025-10", lastMonth: "2026-09" });
    expect(v.errors).toEqual([]);
  });
  it("JSON도 144행이고 CSV와 같은 값", () => {
    const j = loadFile("현장공정기성.json");
    const c = loadFile("현장공정기성.csv");
    expect(j.ok).toBe(true);
    expect(j.rows).toHaveLength(144);
    expect(j.rows).toEqual(c.rows);
  });
  it("CSV 다음 JSON을 가져와도 전체 교체라 144행(누적하지 않음)", () => {
    let current = loadFile("현장공정기성.csv").rows;
    current = loadFile("현장공정기성.json").rows; // 앱의 "전체 교체"와 같은 동작
    expect(current).toHaveLength(144);
  });
  it("BOM이 있어도 첫 열 이름이 month", () => {
    const text = readFileSync(dataPath("현장공정기성.csv"), "utf8");
    expect(readCsv(text).header[0]).toBe("month");
    expect(readCsv("﻿" + text).header[0]).toBe("month");
  });
});

describe("오류 파일 3종은 모두 거부", () => {
  it("중복키: 146행 2026-09/D", () => {
    const v = loadFile("검증용_오류데이터", "오류_중복키.csv");
    expect(v.ok).toBe(false);
    expect(v.rows).toEqual([]);
    expect(v.errors.some((e) => e.where === "146행" && e.reason.includes("중복"))).toBe(true);
  });
  it("공정률 101: 134행 actualProgress", () => {
    const v = loadFile("검증용_오류데이터", "오류_공정률101.csv");
    expect(v.ok).toBe(false);
    expect(v.errors).toHaveLength(1);
    expect(v.errors[0]).toMatchObject({ where: "134행", column: "actualProgress" });
  });
  it("공정률 빈값: 0으로 바꾸지 않고 필수값 오류", () => {
    const v = loadFile("검증용_오류데이터", "오류_공정률빈값.csv");
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toMatchObject({ where: "134행", column: "actualProgress" });
    expect(v.errors[0].reason).toContain("비어");
  });
});

describe("그 밖의 검사 규칙", () => {
  const csv = readFileSync(dataPath("현장공정기성.csv"), "utf8").replace(/^﻿/, "");
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const run = (mutate: (l: string[]) => string[]) => validate(readCsv(mutate([...lines]).join("\n")));

  it("계약금액 0은 거부", () => {
    const v = run((l) => ((l[1] = l[1].replace(",86400,", ",0,")), l));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.column === "contractAmount")).toBe(true);
  });
  it("열이 빠지면 거부", () => {
    const v = validate(readCsv(lines.map((l) => l.split(",").slice(0, 14).join(",")).join("\n")));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.where === "머리글")).toBe(true);
  });
  it("누적 공정률이 줄어들면 거부", () => {
    // 2026-09 A의 계획 공정률을 8월보다 낮게
    const v = run((l) => ((l[133] = l[133].replace(",75.4,", ",10.0,")), l));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.column === "plannedProgress" && e.reason.includes("줄었습니다"))).toBe(true);
  });
  it("같은 현장의 계약금액이 달라지면 거부", () => {
    const v = run((l) => ((l[133] = l[133].replace(",86400,", ",86401,")), l));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.column === "contractAmount")).toBe(true);
  });
  it("CSV·JSON이 아닌 파일은 거부", () => {
    expect(validate(readFileText("자료.xlsx", "abc")).ok).toBe(false);
  });
  it("망가진 JSON·metadata 불일치는 거부", () => {
    expect(validate(readFileText("a.json", "{ not json")).ok).toBe(false);
    const j = JSON.parse(readFileSync(dataPath("현장공정기성.json"), "utf8"));
    j.metadata.schemaVersion = "1.0";
    expect(validate(readFileText("a.json", JSON.stringify(j))).errors.some((e) => e.column === "schemaVersion")).toBe(true);
  });
  it("월이 빠지면 오류가 아니라 경고", () => {
    const v = run((l) => l.filter((x) => !x.startsWith("2026-08,A,")));
    expect(v.ok).toBe(true);
    expect(v.warnings.length).toBe(1);
  });
  it("따옴표·쉼표·줄바꿈이 든 칸도 읽는다", () => {
    const { rows } = parseCsvText('a,b\r\n"x,1","he said ""hi"""\r\n');
    expect(rows[1]).toEqual(["x,1", 'he said "hi"']);
  });
});
