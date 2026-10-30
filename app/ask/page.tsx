"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppState";
import { Card, EmptyData } from "@/components/common";
import { FilterBar } from "@/components/FilterBar";
import { ERROR_MESSAGES, MAX_QUESTION } from "@/lib/askConstants";
import type { Evidence } from "@/lib/aiContext";
import { ALL } from "@/lib/types";

const EXAMPLES = ["D가 늦어진 원인과 대응은?", "9월 점검 현장은 어디인가요?", "J 현장의 7월 기성은 왜 늘지 않았나요?"];

interface Turn {
  id: number;
  question: string;
  status: "pending" | "done" | "error";
  answer?: string;
  mock?: boolean;
  evidence?: Evidence;
  error?: string;
}

export default function AskPage() {
  const { rows, filters, derived, rangeKey } = useApp();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const activeKey = useRef(rangeKey);

  // 월·지역·유형·현장이나 자료가 바뀌면 이전 답변을 지우고, 진행 중인 요청의 응답도 버립니다.
  useEffect(() => {
    activeKey.current = rangeKey;
    abortRef.current?.abort();
    abortRef.current = null;
    setTurns([]);
  }, [rangeKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!rows || !derived) return <EmptyData />;

  const noRange = derived.metrics.length === 0;
  const pending = turns.some((t) => t.status === "pending");
  const tooLong = question.length > MAX_QUESTION;
  const canSend = !pending && !noRange && question.trim().length > 0 && !tooLong;

  const send = async () => {
    if (!canSend) return;
    const q = question.trim();
    const id = ++seq.current;
    const keyAtSend = rangeKey;
    const controller = new AbortController();
    abortRef.current = controller;
    setTurns((t) => [...t, { id, question: q, status: "pending" }]);
    setQuestion("");

    // 같은 지역·유형·현장 범위의 선택 월까지의 행을 보냅니다(숫자는 서버가 다시 계산합니다).
    const payloadRows = rows.filter(
      (r) =>
        r.month <= filters.month &&
        (filters.region === ALL || r.region === filters.region) &&
        (filters.projectType === ALL || r.projectType === filters.projectType) &&
        (filters.siteId === ALL || r.siteId === filters.siteId),
    );
    const update = (patch: Partial<Turn>) => {
      if (activeKey.current !== keyAtSend) return; // 범위가 바뀐 뒤 늦게 온 응답은 표시하지 않습니다.
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    };
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, filters, rows: payloadRows }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.ok) update({ status: "done", answer: data.answer, mock: data.mock, evidence: data.evidence });
      else update({ status: "error", error: data.message ?? ERROR_MESSAGES.UPSTREAM });
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      update({ status: "error", error: ERROR_MESSAGES.UPSTREAM });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">AI에게 묻기</h1>
      <FilterBar />

      <Card className="!py-3" data-testid="ai-scope">
        <p className="text-sm">
          <strong>현재 분석 대상 범위:</strong> 기준 월 {filters.month} / 지역 {filters.region} / 유형 {filters.projectType} / 현장 {filters.siteId}
          {derived.metrics.length > 0 && <> ({derived.metrics.length}곳)</>}
        </p>
        <p className="mt-1 text-xs text-slate-600">필터를 바꾸면 이전 질문과 답변은 자동으로 지워집니다. AI는 기록된 상황과 계획된 대응만 근거로 설명하며, 모든 숫자는 프로그램이 계산한 값을 그대로 인용합니다.</p>
      </Card>

      {noRange && <p className="text-warn">선택 범위 자료 없음 — 질문할 수 없습니다. 필터를 바꿔 주세요.</p>}

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">예시 질문 (누르면 입력칸에 채워집니다)</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => setQuestion(e)} className="rounded-sm border border-line bg-white px-3 py-1.5 text-sm hover:bg-panel">
              Q. {e}
            </button>
          ))}
        </div>
      </div>

      <Card className="space-y-4" data-testid="conversation">
        {turns.length === 0 && <p className="text-slate-500">아직 질문이 없습니다. 아래 입력칸에 질문을 쓰거나 예시 질문을 눌러 보세요.</p>}
        {turns.map((t) => (
          <div key={t.id} className="space-y-2">
            <div className="ml-auto max-w-[80%] rounded-md bg-navy px-4 py-2 text-white">{t.question}</div>
            {t.status === "pending" && (
              <p className="text-slate-600" role="status" data-testid="ai-pending">
                답변 기다리는 중…
              </p>
            )}
            {t.status === "error" && (
              <div className="rounded-md border border-red-300 bg-bad-bg p-3 text-bad" role="alert" data-testid="ai-error">
                <strong>AI 연결 실패</strong>
                <p className="mt-1 text-sm">{t.error}</p>
                <p className="mt-1 text-sm text-slate-700">대시보드와 CSV 내보내기는 계속 사용할 수 있습니다.</p>
              </div>
            )}
            {t.status === "done" && t.evidence && (
              <div className="rounded-md border border-line bg-white p-4" data-testid="ai-answer">
                {t.mock && <p className="mb-2 inline-block rounded-sm bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn">모의 응답 (실제 AI 응답이 아닙니다)</p>}
                <p className="whitespace-pre-wrap">{t.answer}</p>
                <div className="mt-3 rounded-md bg-panel p-3 text-xs text-slate-700">
                  <p className="font-semibold">근거 (프로그램이 계산한 값과 참고한 기록)</p>
                  <p className="mt-1">기준 월: {t.evidence.month} · {t.evidence.scope}</p>
                  {t.evidence.items.map((it) => (
                    <p key={it.siteId} className="mt-0.5">
                      <strong>{it.siteId}</strong>: {it.text}
                    </p>
                  ))}
                  {t.evidence.items.length === 0 && t.evidence.aggregateText && <p className="mt-0.5">{t.evidence.aggregateText}</p>}
                  {t.evidence.trendMonths && <p className="mt-0.5">월별 요약: {t.evidence.trendMonths}</p>}
                  <p className="mt-0.5">참고한 기록 필드: {t.evidence.fields.join(", ")}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>

      <Card>
        <label htmlFor="q" className="mb-1 block text-sm font-semibold">
          질문 입력
        </label>
        <textarea
          id="q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          className="w-full rounded-sm border border-line p-2"
          placeholder="예: D가 늦어진 원인과 대응은?"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-xs ${tooLong ? "text-bad" : "text-slate-500"}`}>
            {question.length}/{MAX_QUESTION}자 · Enter: 줄바꿈 · Ctrl + Enter: 전송
          </span>
          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            className="h-10 rounded-sm bg-navy px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            질문 전송
          </button>
        </div>
      </Card>
    </div>
  );
}
