import type { BasisLabel, OlapData } from "./types";

/**
 * 띄어쓰기를 없앤 형태로 비교한다.
 * PDF에서 글자를 뽑으면 원문에 없던 공백이 끼어드는 경우가 많아,
 * 양쪽 모두 공백을 지우고 맞춰봐야 놓치지 않는다.
 */
export function normalize(text: string): string {
  return text.replace(/\s+/g, "");
}

export interface Vocabulary {
  회계: string[];
  관: string[];
  항: string[];
  목: string[];
}

/**
 * 계정 이름 목록을 원자료에서 직접 만든다.
 * 미리 정해둔 사전이 아니라 업로드된 엑셀의 실제 계정과목을 쓰므로,
 * 자료가 바뀌어도 그대로 동작한다. (개발 단위 9·12)
 */
export function buildVocabulary(olap: OlapData): Vocabulary {
  const pick = (key: "회계" | "관" | "항" | "목") =>
    Array.from(new Set(olap.rows.map((r) => r[key]).filter(Boolean)))
      // 긴 이름부터 맞춰봐야 "법인세"가 "각사업연도소득에대한법인세"를 가로채지 않는다
      .sort((a, b) => b.length - a.length);

  return {
    회계: pick("회계"),
    관: pick("관"),
    항: pick("항"),
    목: pick("목"),
  };
}

/**
 * 텍스트에 등장하는 계정 이름을 찾는다.
 * 이미 찾은 긴 이름에 포함되는 짧은 이름은 버린다.
 */
export function findTerms(text: string, terms: string[]): string[] {
  const flat = normalize(text);
  const hits: string[] = [];
  for (const term of terms) {
    const key = normalize(term);
    if (!key || !flat.includes(key)) continue;
    if (hits.some((h) => normalize(h).includes(key))) continue;
    hits.push(term);
  }
  return hits;
}

/** 금액 열이 예산 쪽인지 결산 쪽인지 가른다 */
export type ColumnKind = "예산" | "결산" | "미상";

export function classifyColumn(name: string): ColumnKind {
  const flat = normalize(name);
  if (/추경|추가경정|예산|편성|계상/.test(flat)) return "예산";
  if (/결산|징수|수납|실적|집행|결정/.test(flat)) return "결산";
  return "미상";
}

/** 질의 문장이 어느 기준을 말하는지 나타내는 낱말 */
const BASIS_KEYWORDS: { kind: ColumnKind; label: BasisLabel; words: RegExp }[] =
  [
    {
      kind: "결산",
      label: "결산 기준",
      // "국가결산보고서"는 인용 기준이 아니라 출처 문서 이름일 뿐이므로 "결산"만으로는 걸리지 않게 한다
      words: /(?<!국가)결산(?!보고서)|징수결정|징수실적|수납액|집행실적|결산액/,
    },
    {
      kind: "예산",
      label: "예산 기준",
      words: /추경|추가경정|예산안|예산액|본예산|예산현액|편성/,
    },
  ];

export interface BasisResolution {
  basis: BasisLabel;
  column: string | null;
}

/**
 * 질의서가 어느 기준으로 수치를 인용했는지, 그래서 어느 금액 열과
 * 대조해야 하는지를 정한다. (개발 단위 9)
 *
 * 1) 금액 열 이름이 문장에 그대로 나오면 그 열을 쓴다 (가장 확실)
 * 2) 아니면 결산·예산 낱말로 가른 뒤 해당 종류의 열을 쓴다
 * 3) 둘 다 없으면 추정하지 않고 "기준 미표기"로 둔다
 */
export function resolveBasis(
  text: string,
  amountColumns: string[]
): BasisResolution {
  const flat = normalize(text);

  // 1) 열 이름이 문장에 그대로 등장하는 경우 (긴 이름 우선)
  const byName = [...amountColumns]
    .sort((a, b) => b.length - a.length)
    .find((col) => flat.includes(normalize(col)));
  if (byName) {
    const kind = classifyColumn(byName);
    return {
      basis:
        kind === "결산"
          ? "결산 기준"
          : kind === "예산"
            ? "예산 기준"
            : "기준 미표기",
      column: byName,
    };
  }

  // 2) 낱말로 기준을 가른 뒤 같은 종류의 열을 고른다
  for (const { kind, label, words } of BASIS_KEYWORDS) {
    if (!words.test(flat)) continue;
    const column = amountColumns.find((col) => classifyColumn(col) === kind);
    if (column) return { basis: label, column };
    return { basis: label, column: null };
  }

  // 3) 단서 없음
  return { basis: "기준 미표기", column: null };
}
