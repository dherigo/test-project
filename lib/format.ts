import { round1 } from "./calc";
import type { Calc } from "./types";

export const NA = "계산 불가";

const nf = (min: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: 1 });

/** 금액(백만원): 소수 첫째 자리. */
export function money(n: Calc): string {
  return n === null ? NA : nf(1).format(round1(n));
}

/** 계약금액처럼 정수로 입력된 금액. */
export function moneyShort(n: Calc): string {
  return n === null ? NA : nf(0).format(round1(n));
}

export function pct(n: Calc): string {
  return n === null ? NA : `${round1(n).toFixed(1)}%`;
}

/** 공정차이(pp). 양수는 +를 붙입니다. */
export function pp(n: Calc): string {
  if (n === null) return NA;
  const v = round1(n);
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`;
}

export function monthLabel(m: string): string {
  const [y, mm] = m.split("-");
  return `${y}년 ${Number(mm)}월`;
}
