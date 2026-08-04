/** OLAP 엑셀에서 읽어온 한 행 (계정 1개) */
export interface OlapRow {
  /** 엑셀의 실제 행 번호 (머리글이 1행이므로 데이터는 2행부터) */
  rowNumber: number;
  회계: string;
  관: string;
  항: string;
  목: string;
  /** 금액 열 이름 -> 원 단위 금액 */
  amounts: Record<string, number>;
}

/** OLAP 엑셀 파일 1개를 읽은 결과 */
export interface OlapData {
  fileName: string;
  sheetName: string;
  rows: OlapRow[];
  /** 감지된 금액 열 이름 목록 (예: 국회 2차 추경안, 징수결정액) */
  amountColumns: string[];
}

/** 질의서 PDF 1개를 읽은 결과 */
export interface QuestionDoc {
  id: string;
  fileName: string;
  pageCount: number;
  text: string;
}

/** 업로드한 파일의 처리 상태 */
export type LoadStatus = "처리 중" | "준비 완료" | "오류";

export interface LoadedFile<T> {
  id: string;
  fileName: string;
  status: LoadStatus;
  /** status가 "오류"일 때 화면에 보여줄 안내 문구 */
  errorMessage?: string;
  data?: T;
}

// ─────────────────────────────────────────────────────────────
// 질의 선별 · 대조 판정 (PRD 5번 must 1)
// ─────────────────────────────────────────────────────────────

/** 질의서에서 잘라낸 질의 한 건 */
export interface Question {
  id: string;
  /** 화면에 보여줄 순번 (문서 안에서의 순서) */
  order: number;
  /** 어느 질의서에서 나왔는지 */
  docName: string;
  /** "질의 1." 처럼 잘라낸 머리 부분 */
  title: string;
  text: string;
}

/** 질의서가 어느 기준으로 수치를 인용했는지 */
export type BasisLabel = "예산 기준" | "결산 기준" | "기준 미표기";

/** 대조 판정 결과 — PRD가 정한 3가지 외에는 쓰지 않는다 */
export type Verdict = "일치" | "불일치" | "확인불가";

/** 원자료에서 찾아낸 대조 상대 */
export interface MatchedTarget {
  /** 목 단위 1행과 대조한 경우 */
  row?: OlapRow;
  /** 상위 계층 합계와 대조한 경우 (PRD 5번 (다) — 합산 사실을 표시) */
  aggregate?: {
    /** 합산 기준이 된 계층 표현 (예: 일반회계 > 내국세) */
    label: string;
    rows: OlapRow[];
    total: number;
  };
}

/** 질의에서 뽑아낸 검증 대상 수치 1건 = PRD가 말하는 "1항목" */
export interface Figure {
  id: string;
  questionId: string;
  /** 원문 표기 (예: "88조 4,000억원") */
  raw: string;
  /** 원 단위로 환산한 값 */
  won: number;
  /** 환산 과정 설명 (환산이 필요 없었으면 null) */
  conversion: string | null;
  /** 질의서가 명시한 인용 기준 */
  basis: BasisLabel;
  /** 대조에 쓸 금액 열 이름 (정하지 못하면 null) */
  basisColumn: string | null;
  /** 원자료에서 특정한 대조 상대 */
  target: MatchedTarget | null;
  /** 계정을 특정하지 못했을 때의 후보들 (PRD 5번 (나) — 후보를 함께 보여준다) */
  candidates: OlapRow[];
  /** 판정 */
  verdict: Verdict;
  /** 원자료 쪽 금액 (확인불가면 null) */
  actual: number | null;
  /** 두 수치의 차이 (확인불가면 null) */
  difference: number | null;
  /** 확인불가 사유 / 참고 설명 */
  note?: string;
  /**
   * 인용한 값이 같은 행의 '다른' 금액 열과 일치하는 경우 그 열 이름.
   * 기준을 잘못 적용한 정황이라 원인 분석(개발 단위 19)의 단서가 된다.
   */
  matchesOtherColumn?: string;
  /**
   * 인용한 값이 (대조 대상이 아닌) 완전히 다른 계정의 금액과 원 단위까지 일치하는 경우,
   * 그 계정을 사람이 읽을 수 있게 적은 설명. 세부 항목·세원을 혼동한 정황의 단서가 된다.
   */
  matchesOtherAccount?: string;
  /**
   * 관·항처럼 상위 계층 합계를 물었는데, 실제로는 그 하위 항목 하나의 부분합과
   * 일치하는 경우 그 설명. 집계 계층(관/항)을 혼동한 정황의 단서가 된다.
   */
  matchesSubAggregate?: string;
  /**
   * [nice] 같은 계정·같은 기준·같은 값을 물어 이 항목에 통합된 다른 질의들.
   * 표현·위원만 다를 뿐 실제로는 같은 질문이라 별도 행으로 재검증하지 않는다.
   */
  mergedQuestions?: { id: string; title: string; docName: string }[];
}

/** 검증 전체 결과 */
export interface VerificationResult {
  /** 금액 수치가 있어 판정한 항목들 */
  figures: Figure[];
  /** 금액 수치가 없어 판정에서 제외한 질의 (PRD 5번 (나) — 목록에는 남긴다) */
  skipped: Question[];
  /** 판정한 질의 전체 */
  questions: Question[];
  /** 확인불가 비율이 높을 때의 경고 문구 (개발 단위 15) */
  warning: string | null;
}

// ─────────────────────────────────────────────────────────────
// 불일치 원인 분석 (PRD 5번 must 2) — 서버 API와 화면이 함께 쓰는 타입
// ─────────────────────────────────────────────────────────────

/** PRD가 정한 6개 원인 — 이 목록 밖의 표현은 쓰지 않는다 */
export const CAUSES = [
  "세입기준",
  "결산기준",
  "예산현액기준",
  "총계·순계 차이",
  "회계연도 차이",
  "기타",
] as const;

export type Cause = (typeof CAUSES)[number];

/** 판별 근거가 부족할 때 쓰는 값 — CAUSES에는 포함하지 않는다 */
export const CAUSE_UNKNOWN = "원인 미상" as const;

/** /api/analyze 가 항목 1건에 대해 돌려주는 결과 */
export interface CauseResult {
  cause: Cause | typeof CAUSE_UNKNOWN;
  /** 3문장·200자 이내 단답형 근거 */
  reason: string;
}

/** /api/analyze 요청 본문 1건 — 원본 문서가 아니라 이 최소 정보만 서버로 보낸다 */
export interface AnalyzeItem {
  id: string;
  /** 개인 식별 표현을 제거한 질의 문장 */
  questionText: string;
  citedRaw: string;
  citedWon: number;
  basis: BasisLabel;
  basisColumn: string | null;
  actual: number;
  difference: number;
  /** 대조 대상 계정을 사람이 읽을 수 있게 적은 설명 */
  targetLabel: string;
  /** 같은 행의 다른 금액 열과 값이 맞아떨어지는 경우 그 열 이름 */
  matchesOtherColumn?: string;
  /** 완전히 다른 계정의 금액과 원 단위까지 일치하는 경우 그 설명 */
  matchesOtherAccount?: string;
  /** 상위 계층 합계가 아니라 하위 항목 하나의 부분합과 일치하는 경우 그 설명 */
  matchesSubAggregate?: string;
}
