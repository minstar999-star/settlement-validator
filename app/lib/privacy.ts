/** "홍길동 위원", "김철수 의원" 같은 표현에서 이름 부분을 지운다. */
const NAME_TITLE_PATTERN = /[가-힣]{2,4}\s*(위원|의원)/g;

/**
 * 개인 식별 표현(위원명·직위)을 제거한다. (PRD 7번 — 불일치 원인 분석을 위해
 * 서버로 보내기 전, 위원명·직위 등 개인 식별 표현을 지운 뒤 전송한다)
 */
export function redactPersonalNames(text: string): string {
  return text.replace(NAME_TITLE_PATTERN, "○○○ $1");
}
