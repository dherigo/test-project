export const REQUIRED_FIELDS = [
  "month",
  "siteId",
  "siteName",
  "contractAmount",
  "plannedProgress",
  "actualProgress",
  "cumulativeEarned",
  "region",
  "projectType",
  "startDate",
  "contractEndDate",
  "currentWork",
  "issueCategory",
  "issueSummary",
  "actionPlan",
] as const;

export const REGIONS = ["인천", "경기", "충남", "충북", "세종", "강원", "대전"] as const;
export const PROJECT_TYPES = ["공동주택", "물류시설", "업무시설", "상업시설", "생산시설"] as const;

export type Status = "정상" | "주의" | "점검";

/** 검사를 통과한 한 행(한 현장의 한 달 월말 상태). */
export interface SiteRow {
  month: string;
  siteId: string;
  siteName: string;
  contractAmount: number;
  plannedProgress: number;
  actualProgress: number;
  cumulativeEarned: number;
  region: string;
  projectType: string;
  startDate: string;
  contractEndDate: string;
  currentWork: string;
  issueCategory: string;
  issueSummary: string;
  actionPlan: string;
}

export interface Filters {
  month: string;
  region: string; // "전체" 또는 지역명
  projectType: string; // "전체" 또는 유형명
  siteId: string; // "전체" 또는 현장 ID
}

export const ALL = "전체";

/** 계산할 수 없는 값은 null (0으로 바꾸지 않습니다). */
export type Calc = number | null;

export interface SiteMetrics {
  row: SiteRow;
  diff: number; // 공정차이 pp (반올림 전)
  status: Status;
  earnedRate: number; // 기성률 %
  monthly: Calc; // 당월기성액, 바로 전월이 없으면 null
}

export interface Aggregate {
  siteCount: number;
  contract: number;
  earned: number;
  earnedRate: number;
  planned: number; // 가중 계획 공정률
  actual: number; // 가중 실제 공정률
  diff: number; // 반올림 전 가중 실제 - 반올림 전 가중 계획
  status: Status;
  monthly: Calc; // 모든 현장에 전월 값이 있을 때만
  counts: Record<Status, number>;
}
