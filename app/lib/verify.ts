import { citedPrecision, describeConversion, findAmounts } from "./amount";
import { resolveAccount, splitQuestions } from "./select";
import { resolveBasis } from "./vocabulary";
import type {
  Figure,
  OlapData,
  OlapRow,
  Question,
  QuestionDoc,
  VerificationResult,
} from "./types";

/** 절사·반올림 오차로 보고 넘어갈 한도 (PRD 5번 (다) — 절대차 10원 미만) */
export const TOLERANCE_WON = 10;

/** 확인불가가 이 비율을 넘으면 자료가 맞지 않는다고 알린다 (개발 단위 15) */
export const UNVERIFIABLE_WARN_RATIO = 0.8;

/** 합계 대상 행들의 금액을 더한다. 값이 하나도 없으면 null */
function sumColumn(
  rows: { amounts: Record<string, number> }[],
  column: string
): number | null {
  const values = rows
    .map((r) => r.amounts[column])
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0);
}

/** 대조 대상 행이 아닌 다른 행에서, 어떤 금액 열이든 인용값과 원 단위까지 일치하는 것을 찾는다 */
function findMatchInOtherAccounts(
  olap: OlapData,
  excludeRowNumber: number,
  won: number
): { row: OlapRow; column: string } | null {
  for (const row of olap.rows) {
    if (row.rowNumber === excludeRowNumber) continue;
    for (const col of olap.amountColumns) {
      const v = row.amounts[col];
      if (typeof v === "number" && Math.abs(won - v) < TOLERANCE_WON) {
        return { row, column: col };
      }
    }
  }
  return null;
}

/** 상위 계층 합계 바로 아래 계층 이름 (관 합계 -> 항별로, 항 합계 -> 목별로 부분합을 찾는다) */
const CHILD_KEY: Record<"회계" | "관" | "항", "관" | "항" | "목"> = {
  회계: "관",
  관: "항",
  항: "목",
};

/** 상위 계층(예: 관) 합계가 아니라, 그 아래 계층(예: 항) 하나의 부분합과 일치하는지 찾는다 */
function findSubAggregateMatch(
  aggregate: { rows: OlapRow[]; level: "회계" | "관" | "항" },
  won: number
): { label: string; column: string; rowCount: number } | null {
  const childKey = CHILD_KEY[aggregate.level];
  const groups = new Map<string, OlapRow[]>();
  for (const row of aggregate.rows) {
    const key = row[childKey];
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  for (const [label, rows] of groups) {
    if (rows.length === aggregate.rows.length) continue; // 전체와 똑같으면 부분합이 아니다
    const columns = new Set(rows.flatMap((r) => Object.keys(r.amounts)));
    for (const col of columns) {
      const sum = sumColumn(rows, col);
      if (sum !== null && Math.abs(won - sum) < TOLERANCE_WON) {
        return { label, column: col, rowCount: rows.length };
      }
    }
  }
  return null;
}

/** 판정에 쓴 대상 계정을 하나의 문자열 키로 만든다 (중복 질의 판별용) */
function targetKey(figure: Figure): string | null {
  if (figure.target?.row) return `row:${figure.target.row.rowNumber}`;
  if (figure.target?.aggregate) return `agg:${figure.target.aggregate.label}`;
  return null;
}

/**
 * 같은 계정·같은 인용 기준·같은 인용값을 묻는 질의를 하나로 묶는다. [nice] PLAN.md 26번
 * PRD 5번 3) — 표현·위원만 다를 뿐 실제로는 같은 것을 묻는 중복 질의를 재검증하지 않고
 * 1건으로 통합해, 실제 검증 대상 항목 수를 줄인다.
 */
function mergeDuplicateFigures(figures: Figure[], questions: Question[]): Figure[] {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const groups = new Map<string, Figure>();
  const merged: Figure[] = [];

  for (const figure of figures) {
    const key = targetKey(figure);
    // 대상 계정을 특정하지 못했거나(확인불가) 대조 열이 없으면 통합 대상이 아니다
    const groupKey =
      key && figure.basisColumn
        ? `${key}|${figure.basisColumn}|${Math.round(figure.won / TOLERANCE_WON)}`
        : null;

    const original = groupKey ? groups.get(groupKey) : undefined;
    if (original) {
      const q = questionById.get(figure.questionId);
      original.mergedQuestions = [
        ...(original.mergedQuestions ?? []),
        { id: figure.questionId, title: q?.title ?? "", docName: q?.docName ?? "" },
      ];
      continue; // 대표 항목에 합쳤으니 별도 행으로 남기지 않는다
    }

    merged.push(figure);
    if (groupKey) groups.set(groupKey, figure);
  }

  return merged;
}

/**
 * 질의서와 원자료를 대조해 항목별로 판정한다. (개발 단위 7~15)
 * AI를 부르지 않고 계산만으로 끝나는 부분이다.
 */
export function verify(
  olap: OlapData,
  docs: QuestionDoc[]
): VerificationResult {
  const questions: Question[] = docs.flatMap(splitQuestions);
  const figures: Figure[] = [];
  const skipped: Question[] = [];

  for (const question of questions) {
    const amounts = findAmounts(question.text);

    // 금액 수치가 없으면 판정 대상이 아니다 (PRD 5번 (나) — 검증대상외)
    if (amounts.length === 0) {
      skipped.push(question);
      continue;
    }

    const { basis, column } = resolveBasis(question.text, olap.amountColumns);
    const account = resolveAccount(question.text, olap);

    amounts.forEach((amount, i) => {
      const figure: Figure = {
        id: `${question.id}-f${i + 1}`,
        questionId: question.id,
        raw: amount.raw,
        won: amount.won,
        conversion: describeConversion(amount.raw, amount.won),
        basis,
        basisColumn: column,
        target: null,
        candidates: account.candidates,
        verdict: "확인불가",
        actual: null,
        difference: null,
      };

      // ① 대조할 금액 열을 정하지 못한 경우
      if (!column) {
        figure.note =
          basis === "기준 미표기"
            ? "질의서에 예산 기준인지 결산 기준인지 표기가 없어 대조할 금액 열을 정하지 못했습니다."
            : `${basis}에 해당하는 금액 열이 원자료에 없습니다.`;
        figures.push(figure);
        return;
      }

      // ② 계정을 특정하지 못한 경우
      if (!account.row && !account.aggregate) {
        figure.note = account.issue;
        figures.push(figure);
        return;
      }

      // ③ 대조할 실제 금액 구하기
      let actual: number | null;
      if (account.row) {
        figure.target = { row: account.row };
        actual = account.row.amounts[column] ?? null;
      } else {
        const rows = account.aggregate!.rows;
        actual = sumColumn(rows, column);
        if (actual !== null) {
          figure.target = {
            aggregate: {
              label: account.aggregate!.label,
              rows,
              total: actual,
            },
          };
        }
      }

      if (actual === null) {
        figure.note = `원자료의 해당 계정에 "${column}" 금액이 없습니다.`;
        figures.push(figure);
        return;
      }

      // ④ 판정 — 절대차 10원 미만이거나, 질의서가 적어낸 자릿수(인용 자릿수 기준)로
      // 반올림했을 때 같은 값이면 일치로 본다. (예: "62조원"이라고만 적었으면 조 단위로
      // 반올림해서 비교 — 다만 이 경우 61조 vs 62조라 반올림해도 다르므로 계속 불일치)
      const difference = Math.abs(amount.won - actual);
      const precision = citedPrecision(amount.raw);
      const roundedMatch =
        Math.round(amount.won / precision) === Math.round(actual / precision);
      figure.actual = actual;
      figure.difference = difference;
      figure.verdict =
        difference < TOLERANCE_WON || roundedMatch ? "일치" : "불일치";

      // ⑤ 같은 행의 다른 금액 열과 맞아떨어지면 기준을 잘못 적용한 정황이다
      if (figure.verdict === "불일치" && account.row) {
        const other = olap.amountColumns.find(
          (col) =>
            col !== column &&
            typeof account.row!.amounts[col] === "number" &&
            Math.abs(amount.won - account.row!.amounts[col]) < TOLERANCE_WON
        );
        if (other) figure.matchesOtherColumn = other;
      }

      // ⑥ ⑤에서 못 찾았으면, 완전히 다른 계정(행)의 값과 일치하는지 찾는다
      // (예: '일반부가가치세'를 물었는데 실제로는 '수입부가가치세' 값을 적어낸 경우)
      if (figure.verdict === "불일치" && account.row && !figure.matchesOtherColumn) {
        const cross = findMatchInOtherAccounts(olap, account.row.rowNumber, amount.won);
        if (cross) {
          figure.matchesOtherAccount =
            `${cross.row.회계} > ${cross.row.관} > ${cross.row.항} > ${cross.row.목}` +
            `(엑셀 ${cross.row.rowNumber}행)의 "${cross.column}"`;
        }
      }

      // ⑦ 상위 계층 합계를 물었는데, 실제로는 하위 항목 하나의 부분합과 일치하는지 찾는다
      // (예: '경상이전수입' 관 전체를 물었는데 실제로는 그 중 '벌금몰수및과태료' 항의 합계였던 경우)
      if (figure.verdict === "불일치" && account.aggregate) {
        const sub = findSubAggregateMatch(account.aggregate, amount.won);
        if (sub) {
          figure.matchesSubAggregate =
            `${account.aggregate.label} 전체(${account.aggregate.rows.length}개 목)가 아니라, ` +
            `그중 "${sub.label}" ${CHILD_KEY[account.aggregate.level]}(${sub.rowCount}개 목)의 "${sub.column}" 합계`;
        }
      }

      figures.push(figure);
    });
  }

  const merged = mergeDuplicateFigures(figures, questions);

  // 확인불가가 지나치게 많으면 자료가 어긋났을 수 있다고 알린다 (통합 후 항목 수 기준)
  let warning: string | null = null;
  if (merged.length > 0) {
    const unverifiable = merged.filter((f) => f.verdict === "확인불가").length;
    const ratio = unverifiable / merged.length;
    if (ratio >= UNVERIFIABLE_WARN_RATIO) {
      warning =
        `검증 대상 ${merged.length}건 가운데 ${unverifiable}건(${Math.round(ratio * 100)}%)이 확인불가입니다. ` +
        `업로드한 원자료가 이 질의서와 맞지 않을 수 있으니 회계연도와 자료 범위를 확인해 주세요.`;
    }
  }

  return { figures: merged, skipped, questions, warning };
}
