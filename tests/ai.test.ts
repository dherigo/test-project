import { afterEach, describe, expect, it, vi } from "vitest";
import { buildContext, buildEvidence, buildPrompt, isTrendQuestion, mentionedSites, mockAnswer, SYSTEM_INSTRUCTION } from "@/lib/aiContext";
import { handleAsk } from "@/lib/askApi";
import { askGemini } from "@/lib/gemini";
import { pp } from "@/lib/format";
import { filters, loadRows } from "./helpers";

const rows = loadRows();
const upTo = (f = filters()) => rows.filter((r) => r.month <= f.month);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AI에 보내는 자료", () => {
  it("D 선택: 원문 기록과 계산된 지표를 구분해서 담고 숫자는 프로그램 계산값", () => {
    const f = filters({ siteId: "D" });
    const ctx = buildContext("D가 늦어진 원인과 대응은?", f, upTo(f).filter((r) => r.siteId === "D"));
    const prompt = buildPrompt(ctx);
    expect(prompt).toContain("[계산된 지표");
    expect(prompt).toContain("[원문 기록");
    expect(prompt).toContain("공정차이 -10.7pp");
    expect(prompt).toContain("기성률 69.4%");
    expect(prompt).toContain("골조 자재 공급 정상화 후 작업면 추가 운영 중");
    expect(prompt).toContain("층별 작업 순서와 투입 인원을 주간 단위로 확인하고 미달 구간 보완.");
    expect(prompt).not.toContain("[월별 요약"); // 추이 질문이 아니면 보내지 않음
  });

  it("추이 질문에는 같은 범위의 월별 요약과(현장 선택 시) 월별 기록을 함께", () => {
    const f = filters({ siteId: "D" });
    const ctx = buildContext("D는 회복 중인가요?", f, upTo(f).filter((r) => r.siteId === "D"));
    expect(ctx.isTrend).toBe(true);
    const prompt = buildPrompt(ctx);
    expect(prompt).toContain("[월별 요약");
    expect(prompt).toContain("2026-08");
    expect(prompt).toContain("[월별 원문 기록");
    const aug = ctx.monthSummary.find((p) => p.month === "2026-08")!.agg!;
    const sep = ctx.monthSummary.find((p) => p.month === "2026-09")!.agg!;
    expect(pp(aug.diff)).toBe("-11.2pp");
    expect(pp(sep.diff)).toBe("-10.7pp");
  });

  it("전체 범위에서 J의 7월을 물으면 J의 월별 기록(기성 확인 서류 보완)을 보낸다", () => {
    const f = filters();
    const ctx = buildContext("J 현장의 7월 기성은 왜 늘지 않았나요?", f, upTo(f));
    expect(mentionedSites("J 현장의 7월", ["A", "J"])).toEqual(["J"]);
    expect(ctx.monthlyRecords.some((r) => r.siteId === "J" && r.month === "2026-07" && r.issueSummary.includes("기성 확인 서류 보완"))).toBe(true);
  });

  it("전체에서 점검 현장 질문은 D → I → K", () => {
    const ctx = buildContext("점검 현장은?", filters(), upTo());
    expect(ctx.ranking.map((m) => m.row.siteId)).toEqual(["D", "I", "K"]);
    expect(buildPrompt(ctx)).toContain("D(-10.7pp) → I(-7.6pp) → K(-5.4pp)");
    expect(buildEvidence(ctx).items.map((i) => i.siteId)).toEqual(["D", "I", "K"]);
  });

  it("지시문: 기록은 완료·원인 단정 금지, 준공일·미수금은 자료 없음", () => {
    expect(SYSTEM_INSTRUCTION).toContain("자료에 없어 알 수 없습니다");
    expect(SYSTEM_INSTRUCTION).toContain("계약상 준공일");
    expect(SYSTEM_INSTRUCTION).toContain("완료됐다거나");
  });

  it("키 값이 프롬프트에 들어가지 않는다", () => {
    vi.stubEnv("GEMINI_API_KEY", "SECRET-KEY-VALUE");
    const ctx = buildContext("점검 현장은?", filters(), upTo());
    expect(buildPrompt(ctx)).not.toContain("SECRET-KEY-VALUE");
    expect(SYSTEM_INSTRUCTION).not.toContain("SECRET-KEY-VALUE");
  });

  it("추이 질문 판별", () => {
    expect(isTrendQuestion("7월 기성은 왜 늘지 않았나요?")).toBe(true);
    expect(isTrendQuestion("D 기성률은?")).toBe(false);
  });

  it("모의 응답: 준공일·미수금은 자료 없음", () => {
    const ctx = buildContext("실제 준공일·미수금은?", filters(), upTo());
    expect(mockAnswer(ctx)).toContain("알 수 없습니다");
  });
});

describe("/api/ask 처리", () => {
  const body = (over = {}) => ({ question: "점검 현장은?", filters: filters(), rows: upTo(), ...over });

  it("키가 없으면 NO_KEY (대시보드와 상관없이 오류 안내)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("AI_MOCK", "");
    const r = await handleAsk(body());
    expect(r).toMatchObject({ ok: false, code: "NO_KEY" });
  });

  it("빈 질문·500자 초과·자료 없음은 BAD_REQUEST", async () => {
    expect(await handleAsk(body({ question: "  " }))).toMatchObject({ ok: false, code: "BAD_REQUEST" });
    expect(await handleAsk(body({ question: "가".repeat(501) }))).toMatchObject({ ok: false, code: "BAD_REQUEST" });
    expect(await handleAsk(body({ rows: [] }))).toMatchObject({ ok: false, code: "BAD_REQUEST" });
  });

  it("검사를 통과하지 못하는 행은 거부", async () => {
    const bad = upTo().map((r, i) => (i === 0 ? { ...r, actualProgress: 101 } : r));
    expect(await handleAsk(body({ rows: bad }))).toMatchObject({ ok: false, code: "BAD_REQUEST" });
  });

  it("모의 모드: '모의 응답'으로 표시하고 근거를 붙인다", async () => {
    vi.stubEnv("AI_MOCK", "true");
    const r = await handleAsk(body());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mock).toBe(true);
      expect(r.answer).toContain("D(-10.7pp)");
      expect(r.evidence.month).toBe("2026-09");
    }
  });

  it("Gemini 호출: 키는 머리글로만 보내고 본문에 넣지 않으며 성공 응답을 돌려준다", async () => {
    vi.stubEnv("GEMINI_API_KEY", "SECRET-KEY-VALUE");
    vi.stubEnv("AI_MOCK", "");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "답변입니다" }] } }] }), { status: 200 }));
    const r = await handleAsk(body(), fetchMock as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true, answer: "답변입니다", mock: false });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("gemini-3.8-flash");
    expect(url).not.toContain("SECRET-KEY-VALUE");
    expect(String(init.body)).not.toContain("SECRET-KEY-VALUE");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("SECRET-KEY-VALUE");
  });

  it("한도 초과·연결 실패·시간 초과·빈 답변을 구분", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("AI_MOCK", "");
    const make = (f: () => Promise<Response>) => handleAsk(body(), f as unknown as typeof fetch);
    expect(await make(async () => new Response("{}", { status: 429 }))).toMatchObject({ code: "QUOTA" });
    expect(await make(async () => new Response("{}", { status: 500 }))).toMatchObject({ code: "UPSTREAM" });
    expect(await make(async () => { throw new TypeError("network"); })).toMatchObject({ code: "UPSTREAM" });
    expect(await make(async () => { throw new DOMException("t", "TimeoutError"); })).toMatchObject({ code: "TIMEOUT" });
    expect(await make(async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }))).toMatchObject({ code: "EMPTY" });
  });

  it("askGemini는 키가 없으면 NO_KEY", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(askGemini("x")).rejects.toMatchObject({ code: "NO_KEY" });
  });
});
