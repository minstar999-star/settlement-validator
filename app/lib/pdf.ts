/** 화면에 그대로 보여줄 안내 문구를 담은 오류 */
export class PdfParseError extends Error {}

/** 진단을 위해 실제 예외의 종류·메시지를 짧게 붙인다 */
function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/**
 * 질의서 PDF에서 글자를 뽑는다. (PRD 개발 단위 4)
 *
 * iOS Safari/WebKit 엔진에서 브라우저 내 PDF 파싱(pdfjs-dist)이 브라우저
 * 종류·빌드와 무관하게 계속 실패해(TypeError: undefined is not a function),
 * 실제 파싱은 서버(`/api/extract-pdf`, Node.js 런타임)에서 하도록 옮겼다.
 * 업로드한 파일은 그 요청 처리 중에만 서버 메모리에 있고, 저장하지 않는다.
 */
export async function extractPdfText(
  file: File
): Promise<{ text: string; pageCount: number }> {
  const formData = new FormData();
  formData.append("file", file);

  let res: Response;
  try {
    res = await fetch("/api/extract-pdf", { method: "POST", body: formData });
  } catch (error) {
    throw new PdfParseError(
      `서버와 통신하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요. (${describeError(error)})`
    );
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new PdfParseError(
      data?.error ?? "PDF를 처리하는 중 알 수 없는 오류가 났습니다."
    );
  }
  if (typeof data?.text !== "string" || typeof data?.pageCount !== "number") {
    throw new PdfParseError("서버 응답 형식이 올바르지 않습니다.");
  }

  return { text: data.text, pageCount: data.pageCount };
}
