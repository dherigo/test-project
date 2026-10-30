import { SYSTEM_INSTRUCTION } from "./aiContext";

/** 모델 이름은 실습조건에서 정한 값입니다. 필요하면 .env.local의 GEMINI_MODEL로 바꿀 수 있습니다. */
export const DEFAULT_MODEL = "gemini-3.8-flash";
export const TIMEOUT_MS = 20000;

export type AiErrorCode = "NO_KEY" | "QUOTA" | "TIMEOUT" | "UPSTREAM" | "EMPTY";

export class AiError extends Error {
  constructor(public code: AiErrorCode) {
    super(code);
  }
}

/** 서버에서만 호출합니다. 키 값은 요청 머리글에만 쓰고 어디에도 기록하지 않습니다. */
export async function askGemini(prompt: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new AiError("NO_KEY");
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    throw new AiError(name === "TimeoutError" || name === "AbortError" ? "TIMEOUT" : "UPSTREAM");
  }

  if (res.status === 429) throw new AiError("QUOTA");
  if (!res.ok) throw new AiError("UPSTREAM");

  let json: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  try {
    json = await res.json();
  } catch {
    throw new AiError("UPSTREAM");
  }
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new AiError("EMPTY");
  return text;
}
