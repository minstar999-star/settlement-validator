/** 한글 금액 단위 (큰 것부터) */
const UNITS: [string, number][] = [
  ["조", 1e12],
  ["억", 1e8],
  ["만", 1e4],
  ["천", 1e3],
];

/**
 * 금액 표기 하나를 원 단위 숫자로 바꾼다.
 * 예) "88조 4,000억원" -> 88_400_000_000_000
 *     "62,000,000,000,000원" -> 62_000_000_000_000
 */
export function parseAmountToken(raw: string): number | null {
  let rest = raw.replace(/[\s,]/g, "").replace(/원$/, "");
  if (rest === "") return null;

  let total = 0;
  let matchedUnit = false;

  for (const [symbol, multiplier] of UNITS) {
    const idx = rest.indexOf(symbol);
    if (idx === -1) continue;
    const head = rest.slice(0, idx);
    // "조" 앞에 숫자가 없으면 잘못된 표기로 본다
    if (head === "") return null;
    const n = Number(head);
    if (!Number.isFinite(n)) return null;
    total += n * multiplier;
    rest = rest.slice(idx + symbol.length);
    matchedUnit = true;
  }

  if (rest !== "") {
    const n = Number(rest);
    if (!Number.isFinite(n)) return null;
    total += n;
  } else if (!matchedUnit) {
    return null;
  }

  return total;
}

/**
 * 금액 표기를 찾아내는 규칙.
 * 반드시 "원"으로 끝나야 하므로 회계연도(2025년)·비율(30%)·건수(12건)는 걸러진다.
 * (PRD 5번 (나) — 검증 대상 수치는 금액 표기를 가진 수치로만 한정)
 */
const AMOUNT_PATTERN =
  /(?:\d[\d,]*(?:\.\d+)?\s*(?:조|억|만|천)\s*)+\d*[\d,]*(?:\.\d+)?\s*원|\d[\d,]*(?:\.\d+)?\s*원/g;

export interface FoundAmount {
  /** 원문에 적힌 그대로의 표기 */
  raw: string;
  /** 원 단위로 환산한 값 */
  won: number;
  /** 질의 텍스트 안에서의 위치 */
  index: number;
}

/** 문장에서 금액 표기를 모두 찾아 원 단위로 환산한다. (개발 단위 8·11) */
export function findAmounts(text: string): FoundAmount[] {
  const found: FoundAmount[] = [];
  for (const m of text.matchAll(AMOUNT_PATTERN)) {
    const raw = m[0].trim();
    const won = parseAmountToken(raw);
    if (won === null) continue;
    found.push({ raw, won, index: m.index ?? 0 });
  }
  return found;
}

/** 화면 표시용 — 1234500000 -> "1,234,500,000원" */
export function formatWon(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

/**
 * 환산 과정을 사람이 읽을 수 있게 적는다. (PRD 5번 (다) — 환산 과정을 함께 표시)
 * 원문 표기와 환산 결과가 같으면 굳이 설명하지 않는다.
 */
export function describeConversion(raw: string, won: number): string | null {
  const plain = raw.replace(/[\s,]/g, "");
  if (plain === `${won}원` || plain === `${won}`) return null;
  return `${raw} → ${formatWon(won)}`;
}

/**
 * 질의서가 실제로 적어낸 가장 작은 단위를 원 단위 반올림 폭으로 돌려준다. (인용 자릿수 기준 오차범위)
 * 예) "88조 4,000억원" -> 억 단위까지만 적었으므로 1억원 단위로 반올림해 비교한다.
 *     "62조원" -> 조 단위까지만 적었으므로 1조원 단위로 반올림해 비교한다.
 *     단위 표현이 전혀 없으면(예: "1,234,000원") 원 단위 그대로(반올림 폭 1원) 비교한다.
 */
export function citedPrecision(raw: string): number {
  const rest = raw.replace(/[\s,]/g, "").replace(/원$/, "");
  let smallest = 1;
  for (const [symbol, multiplier] of UNITS) {
    if (rest.includes(symbol)) smallest = multiplier;
  }
  return smallest;
}
