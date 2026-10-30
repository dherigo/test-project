export const MAX_QUESTION = 500;

export type AskErrorCode = "NO_KEY" | "QUOTA" | "TIMEOUT" | "UPSTREAM" | "EMPTY" | "BAD_REQUEST";

export const ERROR_MESSAGES: Record<AskErrorCode, string> = {
  NO_KEY: "AI 키가 설정되지 않았습니다. .env.local의 GEMINI_API_KEY를 확인해 주세요.",
  QUOTA: "AI 사용 한도를 넘었습니다. 잠시 뒤에 다시 시도해 주세요.",
  TIMEOUT: "AI 답변이 너무 오래 걸려 중단했습니다.",
  UPSTREAM: "AI 서비스에 연결하지 못했습니다.",
  EMPTY: "AI가 빈 답변을 돌려보냈습니다.",
  BAD_REQUEST: "질문 내용을 확인해 주세요.",
};
