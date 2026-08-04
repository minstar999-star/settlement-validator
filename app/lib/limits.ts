/** PRD 5번 (가) 파일 업로드 — 처리 상한 */
export const MAX_OLAP_ROWS = 5000;
export const MAX_PDF_TOTAL_PAGES = 50;
export const MAX_TARGET_FIGURES = 100;

/** PDF에서 뽑은 글자가 이보다 적으면 텍스트 추출 실패로 본다 */
export const MIN_PDF_TEXT_CHARS = 100;

/** OLAP 엑셀에 반드시 있어야 하는 계층 열 */
export const REQUIRED_OLAP_COLUMNS = ["회계", "관", "항", "목"] as const;
