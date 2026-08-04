import type { OlapData, OlapRow, Question, QuestionDoc } from "./types";
import { buildVocabulary, findTerms, normalize } from "./vocabulary";

/** "질의 1.", "문의 2)", "Inquiry 3." 같은 질의 머리표 */
const QUESTION_MARKER = /(?:질의|문의|질문|Inquiry)\s*\d+\s*[.．)]?/g;

/**
 * 질의서 본문을 질의 한 건씩 자른다. (개발 단위 7)
 * 머리표를 찾지 못하면 문서 전체를 질의 1건으로 본다.
 */
export function splitQuestions(doc: QuestionDoc): Question[] {
  const text = doc.text;
  const marks = Array.from(text.matchAll(QUESTION_MARKER));

  if (marks.length === 0) {
    const body = text.trim();
    if (!body) return [];
    return [
      {
        id: `${doc.id}-q1`,
        order: 1,
        docName: doc.fileName,
        title: "질의 1",
        text: body,
      },
    ];
  }

  const questions: Question[] = [];
  marks.forEach((mark, i) => {
    const start = mark.index ?? 0;
    const end = i + 1 < marks.length ? (marks[i + 1].index ?? text.length) : text.length;
    const body = text.slice(start, end).trim();
    if (!body) return;
    questions.push({
      id: `${doc.id}-q${i + 1}`,
      order: i + 1,
      docName: doc.fileName,
      title: mark[0].trim().replace(/[.．)]$/, ""),
      text: body,
    });
  });

  return questions;
}

export interface AccountResolution {
  /** 목 단위로 딱 한 행을 특정한 경우 */
  row?: OlapRow;
  /** 상위 계층 합계를 물은 경우 */
  aggregate?: {
    label: string;
    rows: OlapRow[];
    /** 합계를 잡은 계층 — 원인 분석에서 하위 계층(예: 관→항) 부분합을 찾을 때 쓴다 */
    level: "회계" | "관" | "항";
  };
  /** 특정하지 못했을 때의 후보들 */
  candidates: OlapRow[];
  /** 특정하지 못한 사유 */
  issue?: string;
}

/**
 * 질의 문장에 나온 계정 표현으로 원자료의 행을 찾는다. (개발 단위 9·12·13)
 *
 * - 목 이름이 잡히면 그 행들로 좁힌 뒤, 회계·관·항으로 더 좁힌다
 * - 여러 회계에 같은 목 이름이 있는데 회계 구분이 없으면 고르지 않고 후보를 남긴다
 * - 목이 없고 상위 계층만 잡히면 그 아래 목들을 합산 대상으로 본다
 */
export function resolveAccount(
  text: string,
  olap: OlapData
): AccountResolution {
  const vocab = buildVocabulary(olap);
  const flat = normalize(text);

  const hit회계 = findTerms(flat, vocab.회계);
  const hit관 = findTerms(flat, vocab.관);
  const hit항 = findTerms(flat, vocab.항);
  const hit목 = findTerms(flat, vocab.목);

  // ── 목 이름이 잡힌 경우 ────────────────────────────────
  if (hit목.length > 0) {
    let rows = olap.rows.filter((r) => hit목.includes(r.목));
    if (hit회계.length > 0) {
      rows = rows.filter((r) => hit회계.includes(r.회계));
    }
    if (hit관.length > 0) {
      const narrowed = rows.filter((r) => hit관.includes(r.관));
      if (narrowed.length > 0) rows = narrowed;
    }
    if (hit항.length > 0) {
      const narrowed = rows.filter((r) => hit항.includes(r.항));
      if (narrowed.length > 0) rows = narrowed;
    }

    if (rows.length === 1) return { row: rows[0], candidates: [] };
    if (rows.length > 1) {
      return {
        candidates: rows,
        issue:
          `같은 계정 이름이 여러 회계에 있어 한 곳으로 좁히지 못했습니다. ` +
          `질의서에 회계 구분(예: 일반회계)이 드러나 있지 않습니다.`,
      };
    }
  }

  // ── 상위 계층만 잡힌 경우 → 합계 질의로 본다 ──────────────
  const levels: { key: "항" | "관" | "회계"; hits: string[] }[] = [
    { key: "항", hits: hit항 },
    { key: "관", hits: hit관 },
    { key: "회계", hits: hit회계 },
  ];

  for (const { key, hits } of levels) {
    if (hits.length !== 1) continue;
    let rows = olap.rows.filter((r) => r[key] === hits[0]);
    if (key !== "회계" && hit회계.length === 1) {
      rows = rows.filter((r) => r.회계 === hit회계[0]);
    }
    if (rows.length === 0) continue;

    const prefix =
      key !== "회계" && hit회계.length === 1 ? `${hit회계[0]} > ` : "";
    return {
      aggregate: { label: `${prefix}${hits[0]}`, rows, level: key },
      candidates: [],
    };
  }

  return {
    candidates: [],
    issue:
      "질의서에서 대조할 계정(회계·관·항·목)을 찾지 못했습니다. " +
      "계정 이름이 원자료와 다르게 적혀 있을 수 있습니다.",
  };
}
