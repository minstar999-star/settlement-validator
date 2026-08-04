import type { OlapData, OlapRow } from "./types";
import { MAX_OLAP_ROWS, REQUIRED_OLAP_COLUMNS } from "./limits";

/** 화면에 그대로 보여줄 안내 문구를 담은 오류 */
export class OlapParseError extends Error {}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * 숫자로 읽을 수 있으면 숫자를, 아니면 null을 돌려준다.
 * 엑셀이 문자열로 내보낸 "88,400,000,000,000" 같은 값도 받아준다.
 */
function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s원]/g, "");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * OLAP 엑셀을 읽어 계정 행 목록으로 바꾼다. (PRD 개발 단위 3)
 * - 첫 행을 머리글로 본다
 * - 회계·관·항·목 열이 하나라도 없으면 어떤 열이 없는지 알려주고 멈춘다
 * - 계층 열을 뺀 나머지 중 숫자가 들어있는 열을 금액 열로 본다
 */
export async function parseOlapFile(file: File): Promise<OlapData> {
  // 이 패키지는 루트 진입점이 없고 실행 환경별 하위 경로만 제공한다
  const readXlsxFile = (await import("read-excel-file/browser")).default;

  // v9는 시트를 [{ sheet: 시트명, data: 행배열 }] 형태로 감싸서 돌려준다
  let sheets: { sheet: string; data: unknown[][] }[];
  try {
    sheets = (await readXlsxFile(file)) as unknown as {
      sheet: string;
      data: unknown[][];
    }[];
  } catch {
    throw new OlapParseError(
      "엑셀 파일을 열지 못했습니다. .xlsx 형식이 맞는지 확인해 주세요."
    );
  }

  if (!Array.isArray(sheets) || sheets.length === 0 || !sheets[0]?.data) {
    throw new OlapParseError(
      "엑셀에서 시트를 찾지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요."
    );
  }

  const sheetName = sheets[0].sheet;
  const raw = sheets[0].data;

  if (raw.length < 2) {
    throw new OlapParseError(
      "엑셀에 데이터 행이 없습니다. 머리글 아래에 자료가 있는지 확인해 주세요."
    );
  }

  const header = raw[0].map(toText);

  // 계층 열 위치 찾기
  const columnIndex: Record<string, number> = {};
  const missing: string[] = [];
  for (const name of REQUIRED_OLAP_COLUMNS) {
    const idx = header.indexOf(name);
    if (idx === -1) missing.push(name);
    else columnIndex[name] = idx;
  }
  if (missing.length > 0) {
    throw new OlapParseError(
      `엑셀에 필요한 열이 없습니다: ${missing.join(", ")}\n` +
        `현재 첫 행에서 찾은 열: ${header.filter(Boolean).join(", ")}`
    );
  }

  const body = raw.slice(1);
  if (body.length > MAX_OLAP_ROWS) {
    throw new OlapParseError(
      `엑셀 행이 ${body.length.toLocaleString()}행으로 상한(${MAX_OLAP_ROWS.toLocaleString()}행)을 넘습니다. ` +
        `자료를 나눠서 올려 주세요.`
    );
  }

  // 금액 열 후보: 계층 열이 아니면서 숫자가 한 번이라도 나오는 열
  const hierarchyIdx = new Set(Object.values(columnIndex));
  const amountColumns: string[] = [];
  header.forEach((name, idx) => {
    if (!name || hierarchyIdx.has(idx)) return;
    const hasNumber = body.some((row) => toNumber(row[idx]) !== null);
    if (hasNumber) amountColumns.push(name);
  });

  if (amountColumns.length === 0) {
    throw new OlapParseError(
      "금액이 들어있는 열을 찾지 못했습니다. 예산·결산 금액 열이 포함된 자료인지 확인해 주세요."
    );
  }

  const rows: OlapRow[] = [];
  body.forEach((row, i) => {
    const 회계 = toText(row[columnIndex["회계"]]);
    const 관 = toText(row[columnIndex["관"]]);
    const 항 = toText(row[columnIndex["항"]]);
    const 목 = toText(row[columnIndex["목"]]);

    // 계층 값이 모두 비어 있으면 빈 줄로 보고 건너뛴다
    if (!회계 && !관 && !항 && !목) return;

    const amounts: Record<string, number> = {};
    amountColumns.forEach((colName) => {
      const idx = header.indexOf(colName);
      const n = toNumber(row[idx]);
      if (n !== null) amounts[colName] = n;
    });

    rows.push({
      rowNumber: i + 2, // 머리글이 1행
      회계,
      관,
      항,
      목,
      amounts,
    });
  });

  if (rows.length === 0) {
    throw new OlapParseError(
      "읽을 수 있는 계정 행이 없습니다. 회계·관·항·목 값이 채워져 있는지 확인해 주세요."
    );
  }

  return {
    fileName: file.name,
    sheetName: sheetName || "Sheet1",
    rows,
    amountColumns,
  };
}
