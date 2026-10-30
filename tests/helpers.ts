import { readFileSync } from "node:fs";
import path from "node:path";
import { readFileText } from "@/lib/parse";
import { validate } from "@/lib/validate";
import { ALL, type Filters } from "@/lib/types";

export const dataPath = (...p: string[]) => path.join(process.cwd(), "data", ...p);

export function loadFile(...p: string[]) {
  const text = readFileSync(dataPath(...p), "utf8");
  return validate(readFileText(p[p.length - 1], text));
}

export function loadRows() {
  const v = loadFile("현장공정기성.csv");
  if (!v.ok) throw new Error("정상 CSV가 검사를 통과하지 못했습니다.");
  return v.rows;
}

export const filters = (over: Partial<Filters> = {}): Filters => ({
  month: "2026-09",
  region: ALL,
  projectType: ALL,
  siteId: ALL,
  ...over,
});
