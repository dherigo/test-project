/** 파일 글자를 읽어 "검사 전" 기록으로 바꿉니다. 값의 옳고 그름은 validate.ts에서 검사합니다. */

export interface RawRecord {
  /** 사용자에게 보여 줄 위치(예: "134행", "3번째 기록") */
  where: string;
  values: Record<string, unknown>;
}

export interface ReadResult {
  kind: "csv" | "json";
  records: RawRecord[];
  header: string[];
  metadata?: Record<string, unknown>;
  /** 파일 전체를 읽을 수 없을 때의 이유 */
  fatal?: string;
}

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/** 따옴표·쉼표·줄바꿈을 처리하는 CSV 읽기. 각 레코드가 시작한 줄 번호를 함께 돌려줍니다. */
export function parseCsvText(input: string): { rows: string[][]; lines: number[] } {
  const text = stripBom(input);
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let startLine = 1;
  let i = 0;
  const endRow = () => {
    row.push(field);
    field = "";
    // 완전히 빈 줄은 건너뜁니다.
    if (!(row.length === 1 && row[0] === "")) {
      rows.push(row);
      lines.push(startLine);
    }
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (c === "\n") line++;
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === ",") {
      row.push(field);
      field = "";
      i++;
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
      startLine = line;
      i++;
    } else {
      field += c;
      i++;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return { rows, lines };
}

export function readCsv(text: string): ReadResult {
  const { rows, lines } = parseCsvText(text);
  if (rows.length === 0) return { kind: "csv", records: [], header: [], fatal: "파일이 비어 있습니다." };
  const header = rows[0].map((h) => h.trim());
  const records: RawRecord[] = rows.slice(1).map((r, idx) => {
    const values: Record<string, unknown> = {};
    header.forEach((h, c) => {
      values[h] = r[c]; // 칸이 모자라면 undefined → 빈 값으로 검사
    });
    return { where: `${lines[idx + 1]}행`, values };
  });
  return { kind: "csv", records, header };
}

export function readJson(text: string): ReadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(text));
  } catch {
    return { kind: "json", records: [], header: [], fatal: "JSON 형식이 올바르지 않습니다." };
  }
  const obj = parsed as { metadata?: unknown; records?: unknown };
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.records)) {
    return { kind: "json", records: [], header: [], fatal: "JSON에 records 목록이 없습니다." };
  }
  const metadata =
    obj.metadata && typeof obj.metadata === "object" ? (obj.metadata as Record<string, unknown>) : undefined;
  const records: RawRecord[] = obj.records.map((r, idx) => ({
    where: `${idx + 1}번째 기록`,
    values: r && typeof r === "object" ? (r as Record<string, unknown>) : {},
  }));
  const header = records.length ? Object.keys(records[0].values) : [];
  return { kind: "json", records, header, metadata };
}

export function readFileText(fileName: string, text: string): ReadResult {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return readCsv(text);
  if (lower.endsWith(".json")) return readJson(text);
  return {
    kind: "csv",
    records: [],
    header: [],
    fatal: "CSV 또는 JSON 파일만 가져올 수 있습니다.",
  };
}
