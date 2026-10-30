import { buildContext, buildEvidence, buildPrompt, mockAnswer, type Evidence } from "./aiContext";
import { askGemini, AiError, type AiErrorCode } from "./gemini";
import { validate } from "./validate";
import { ALL, REQUIRED_FIELDS, type Filters, type SiteRow } from "./types";

import { ERROR_MESSAGES, MAX_QUESTION } from "./askConstants";

const MAX_ROWS = 200;

export interface AskBody {
  question: string;
  filters: Filters;
  rows: SiteRow[];
}

export type AskResult =
  | { ok: true; answer: string; mock: boolean; evidence: Evidence }
  | { ok: false; code: AiErrorCode | "BAD_REQUEST"; message: string };

const fail = (code: AiErrorCode | "BAD_REQUEST", message = ERROR_MESSAGES[code]): AskResult => ({ ok: false, code, message });

/** 요청을 검사하고, 숫자를 서버에서 다시 계산한 뒤 AI에 묻습니다. */
export async function handleAsk(body: unknown, fetchImpl?: typeof fetch): Promise<AskResult> {
  const b = body as Partial<AskBody> | null;
  const question = typeof b?.question === "string" ? b.question.trim() : "";
  if (!question) return fail("BAD_REQUEST", "질문을 입력해 주세요.");
  if (question.length > MAX_QUESTION) return fail("BAD_REQUEST", `질문은 ${MAX_QUESTION}자 이하로 입력해 주세요.`);
  const f = b?.filters;
  if (!f || typeof f.month !== "string" || typeof f.region !== "string" || typeof f.projectType !== "string" || typeof f.siteId !== "string")
    return fail("BAD_REQUEST", "범위가 올바르지 않습니다.");
  if (!Array.isArray(b?.rows) || b.rows.length === 0 || b.rows.length > MAX_ROWS)
    return fail("BAD_REQUEST", "전달된 자료가 없거나 너무 많습니다.");

  // 브라우저가 보낸 행도 같은 검사 규칙으로 다시 검사합니다.
  const checked = validate({
    kind: "json",
    header: [...REQUIRED_FIELDS],
    records: (b.rows as unknown[]).map((r, i) => ({ where: `${i + 1}번째 기록`, values: (r ?? {}) as Record<string, unknown> })),
    metadata: { schemaVersion: "2.0", moneyUnit: "백만원", progressUnit: "percent_0_100", requiredFields: [...REQUIRED_FIELDS] },
  });
  if (!checked.ok) return fail("BAD_REQUEST", "전달된 자료가 검사를 통과하지 못했습니다.");

  const filters: Filters = { month: f.month, region: f.region || ALL, projectType: f.projectType || ALL, siteId: f.siteId || ALL };
  const ctx = buildContext(question, filters, checked.rows);
  if (ctx.metrics.length === 0) return fail("BAD_REQUEST", "선택한 범위에 자료가 없습니다.");
  const evidence = buildEvidence(ctx);

  try {
    if (process.env.AI_MOCK === "true") return { ok: true, answer: mockAnswer(ctx), mock: true, evidence };
    const answer = await askGemini(buildPrompt(ctx), fetchImpl);
    return { ok: true, answer, mock: false, evidence };
  } catch (e) {
    return fail(e instanceof AiError ? e.code : "UPSTREAM");
  }
}
