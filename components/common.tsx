"use client";

import Link from "next/link";
import type { Status } from "@/lib/types";

const STYLE: Record<Status, string> = {
  정상: "bg-ok-bg text-ok border-green-300",
  주의: "bg-warn-bg text-warn border-amber-300",
  점검: "bg-bad-bg text-bad border-red-300",
};

/** 색만으로 구별하지 않도록 점과 글자를 함께 씁니다. */
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border px-1.5 py-0.5 text-[11px] font-medium ${STYLE[status]}`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function diffColor(diff: number | null): string {
  if (diff === null) return "text-slate-500";
  return diff < 0 ? "text-bad" : "text-ok";
}

export function Card({
  children,
  className = "",
  ...rest
}: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement> & { "data-testid"?: string }) {
  return (
    <section {...rest} className={`rounded-md border border-line bg-white p-5 ${className}`}>
      {children}
    </section>
  );
}

/** 처음 열었을 때(자료 없음). */
export function EmptyData() {
  return (
    <Card className="mx-auto mt-10 max-w-xl text-center">
      <h2 className="text-lg font-semibold">자료 없음</h2>
      <p className="mt-2 text-slate-600">자료를 먼저 가져와 주세요. 이 앱은 새로고침하면 가져온 자료가 사라지므로, 새로고침한 뒤에는 파일을 다시 가져와야 합니다.</p>
      <Link href="/import" className="mt-4 inline-block rounded-sm bg-navy px-4 py-2 text-sm font-semibold text-white">
        자료 가져오기로 이동
      </Link>
    </Card>
  );
}

/** 고른 범위에 행이 없을 때. 0%로 바꾸지 않습니다. */
export function NoRange() {
  return (
    <Card className="border-amber-300 bg-warn-bg text-warn">
      <h2 className="font-semibold">선택 범위 자료 없음</h2>
      <p className="mt-1 text-sm">고른 월·지역·유형·현장에 해당하는 자료가 없어 모든 숫자를 &quot;계산 불가&quot;로 표시합니다. 필터를 바꾸거나 &quot;필터 초기화&quot;를 눌러 주세요.</p>
    </Card>
  );
}
