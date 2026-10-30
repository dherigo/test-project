"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppState";
import { monthLabel } from "@/lib/format";

const NAV = [
  { href: "/", label: "현황 요약" },
  { href: "/compare", label: "현장별 비교표" },
  { href: "/import", label: "자료 가져오기" },
  { href: "/ask", label: "AI에게 묻기" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { rows, filters } = useApp();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-6">
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-xl font-bold tracking-tight">동일토건</span>
            <span className="text-xs text-slate-500">공무팀 현장 공정·기성 관리 (교육용)</span>
          </div>
          <nav className="flex h-full items-stretch gap-1" aria-label="주요 화면">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center border-b-2 px-3 text-sm font-medium ${
                    active ? "border-navy text-navy" : "border-transparent text-slate-500 hover:text-navy"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto text-xs">
            {rows ? (
              <span className="rounded-sm border border-line bg-panel px-2 py-1">● {monthLabel(filters.month)} 기준</span>
            ) : (
              <span className="rounded-sm border border-line bg-panel px-2 py-1 text-slate-500">자료 없음</span>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-5">{children}</main>
      <footer className="border-t border-line bg-white px-6 py-3 text-xs text-slate-500">
        ※ 이 화면의 모든 현장명·계약금액·기성·공정 기록은 교육용 가상 자료이며 실제 동일토건의 계약·현장·청구 자료가 아닙니다.
      </footer>
    </div>
  );
}
