import { describe, expect, it } from "vitest";
import { aggregate, indexRows, prevMonth, rankInspections, round1, rowsInRange, siteMetrics, statusOf, trend } from "@/lib/calc";
import { money, pct, pp } from "@/lib/format";
import { filters, loadRows } from "./helpers";

const rows = loadRows();
const index = indexRows(rows);
const agg = (over = {}) => aggregate(rowsInRange(rows, filters(over)), index);

describe("정답 숫자 (data/검산표.md)", () => {
  it("9월 전체", () => {
    const a = agg()!;
    expect(a.contract).toBe(630700);
    expect(money(a.earned)).toBe("424,063.4");
    expect(pct(a.earnedRate)).toBe("67.2%");
    expect(pct(a.planned)).toBe("73.2%");
    expect(pct(a.actual)).toBe("71.2%");
    expect(pp(a.diff)).toBe("-2.0pp");
    expect(money(a.monthly)).toBe("28,878.7");
    expect(a.counts).toEqual({ 정상: 6, 주의: 3, 점검: 3 });
  });

  it("8월·7월 전체", () => {
    const aug = agg({ month: "2026-08" })!;
    expect(money(aug.earned)).toBe("395,184.7");
    expect(pct(aug.earnedRate)).toBe("62.7%");
    const jul = agg({ month: "2026-07" })!;
    expect(money(jul.earned)).toBe("364,718.5");
    expect(pct(jul.earnedRate)).toBe("57.8%");
  });

  it("12개월 전체 표(검산표 월별)", () => {
    // 월, 누적기성액, 기성률, 계획, 실제, 공정차이, 당월기성액, 정상, 주의, 점검
    const table: [string, string, string, string, string, string, string, number, number, number][] = [
      ["2025-10", "105,449.7", "16.7%", "19.4%", "19.6%", "+0.2pp", "계산 불가", 10, 2, 0],
      ["2025-11", "125,857.8", "20.0%", "22.8%", "23.2%", "+0.3pp", "20,408.1", 10, 2, 0],
      ["2025-12", "148,530.2", "23.6%", "26.9%", "27.0%", "+0.2pp", "22,672.4", 9, 3, 0],
      ["2026-01", "173,599.9", "27.5%", "31.4%", "31.3%", "-0.1pp", "25,069.7", 9, 3, 0],
      ["2026-02", "202,848.9", "32.2%", "36.7%", "36.2%", "-0.4pp", "29,249.0", 8, 4, 0],
      ["2026-03", "233,981.1", "37.1%", "42.4%", "41.6%", "-0.8pp", "31,132.2", 8, 3, 1],
      ["2026-04", "266,640.0", "42.3%", "48.6%", "47.1%", "-1.5pp", "32,658.9", 8, 2, 2],
      ["2026-05", "300,878.0", "47.7%", "54.8%", "52.9%", "-1.9pp", "34,238.0", 8, 1, 3],
      ["2026-06", "335,344.9", "53.2%", "60.7%", "58.3%", "-2.4pp", "34,466.9", 7, 2, 3],
      ["2026-07", "364,718.5", "57.8%", "65.8%", "63.2%", "-2.6pp", "29,373.6", 6, 2, 4],
      ["2026-08", "395,184.7", "62.7%", "69.9%", "67.6%", "-2.3pp", "30,466.2", 6, 2, 4],
      ["2026-09", "424,063.4", "67.2%", "73.2%", "71.2%", "-2.0pp", "28,878.7", 6, 3, 3],
    ];
    for (const [month, earned, rate, plan, act, diff, monthly, ok, warn, bad] of table) {
      const a = agg({ month })!;
      expect([month, money(a.earned), pct(a.earnedRate), pct(a.planned), pct(a.actual), pp(a.diff), money(a.monthly), a.counts.정상, a.counts.주의, a.counts.점검]).toEqual([
        month, earned, rate, plan, act, diff, monthly, ok, warn, bad,
      ]);
    }
  });

  it("9월 점검 순서는 D → I → K", () => {
    const metrics = rowsInRange(rows, filters()).map((r) => siteMetrics(r, index));
    const rank = rankInspections(metrics);
    expect(rank.map((m) => [m.row.siteId, pp(m.diff)])).toEqual([
      ["D", "-10.7pp"],
      ["I", "-7.6pp"],
      ["K", "-5.4pp"],
    ]);
  });

  it("9월 D: 기성률 69.4%, 당월기성액 3,339.6", () => {
    const m = siteMetrics(rowsInRange(rows, filters({ siteId: "D" }))[0], index);
    expect(pct(m.earnedRate)).toBe("69.4%");
    expect(money(m.monthly)).toBe("3,339.6");
    expect(m.status).toBe("점검");
  });

  it("9월 지역별 필터(검산표)", () => {
    const expected: Record<string, [number, number, string, number, number, number]> = {
      인천: [2, 185100, "61.2%", 2, 0, 0],
      경기: [4, 210400, "68.5%", 2, 1, 1],
      충남: [2, 55400, "73.5%", 1, 1, 0],
      충북: [1, 57600, "60.7%", 0, 0, 1],
      세종: [1, 32400, "92.7%", 0, 1, 0],
      강원: [1, 65200, "60.5%", 0, 0, 1],
      대전: [1, 24600, "87.4%", 1, 0, 0],
    };
    for (const [region, [n, contract, rate, ok, warn, bad]] of Object.entries(expected)) {
      const a = agg({ region })!;
      expect([a.siteCount, a.contract, pct(a.earnedRate), a.counts.정상, a.counts.주의, a.counts.점검]).toEqual([n, contract, rate, ok, warn, bad]);
    }
  });

  it("9월 인천·공동주택은 A·G 2곳", () => {
    const r = rowsInRange(rows, filters({ region: "인천", projectType: "공동주택" }));
    expect(r.map((x) => x.siteId)).toEqual(["A", "G"]);
  });
});

describe("당월기성액과 누적값", () => {
  it("첫 달은 계산 불가이고 누적액으로 대신하지 않는다", () => {
    const a = agg({ month: "2025-10" })!;
    expect(a.monthly).toBeNull();
    expect(money(a.monthly)).toBe("계산 불가");
    expect(money(a.earned)).toBe("105,449.7");
    const d = siteMetrics(rowsInRange(rows, filters({ month: "2025-10", siteId: "D" }))[0], index);
    expect(d.monthly).toBeNull();
  });

  it("J의 7월 당월기성액 0.0은 정상값(계산 불가가 아님)", () => {
    const j = siteMetrics(rowsInRange(rows, filters({ month: "2026-07", siteId: "J" }))[0], index);
    expect(j.monthly).toBe(0);
    expect(money(j.monthly)).toBe("0.0");
  });

  it("전월 행이 빠진 현장이 있으면 전체 당월기성액도 계산 불가", () => {
    const without = rows.filter((r) => !(r.month === "2026-08" && r.siteId === "A"));
    const a = aggregate(rowsInRange(without, filters()), indexRows(without))!;
    expect(a.monthly).toBeNull();
  });

  it("월별 당월기성액을 합쳐도 누적과 다르다는 것을 구분한다(추이는 월마다 따로 집계)", () => {
    const t = trend(rows, filters());
    expect(t).toHaveLength(12);
    expect(t[0].month).toBe("2025-10");
    expect(t[0].agg!.monthly).toBeNull();
    expect(money(t[11].agg!.monthly)).toBe("28,878.7");
    expect(money(t[11].agg!.earned)).toBe("424,063.4");
  });

  it("추이는 선택 월까지만", () => {
    const t = trend(rows, filters({ month: "2026-03" }));
    expect(t.map((p) => p.month)).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]);
  });
});

describe("상태 경계와 표시", () => {
  it("계획 70·실제 70 / 65.1 / 65", () => {
    expect(statusOf(70 - 70)).toBe("정상");
    expect(statusOf(65.1 - 70)).toBe("주의");
    expect(statusOf(65 - 70)).toBe("점검");
  });
  it("부동소수점 오차에도 -5.0은 점검", () => {
    expect(statusOf(65.2 - 70.2)).toBe("점검");
  });
  it("소수 첫째 자리 반올림", () => {
    expect(round1(0.05)).toBe(0.1);
    expect(round1(-0.05)).toBe(-0.1);
    expect(round1(67.2361)).toBe(67.2);
    expect(pp(-2.0)).toBe("-2.0pp");
    expect(pp(0.2)).toBe("+0.2pp");
  });
  it("전월 계산", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(prevMonth("2025-10")).toBe("2025-09");
  });
  it("자료 없음은 0%가 아니라 계산 불가", () => {
    expect(aggregate([], index)).toBeNull();
    expect(pct(null)).toBe("계산 불가");
  });
});
