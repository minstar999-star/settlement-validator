import { MIN_PDF_TEXT_CHARS } from "./limits";

/** 화면에 그대로 보여줄 안내 문구를 담은 오류 */
export class PdfParseError extends Error {}

/**
 * 질의서 PDF에서 글자를 뽑는다. (PRD 개발 단위 4)
 * pdfjs는 브라우저 전용 API를 쓰기 때문에, 서버 렌더링 중에 불러오지 않도록
 * 함수가 실제로 호출될 때 동적으로 import 한다.
 */
export async function extractPdfText(
  file: File
): Promise<{ text: string; pageCount: number }> {
  const pdfjsLib = await import("pdfjs-dist");
  // 번들러가 워커 경로를 잘못 풀어내는 브라우저(카카오톡 인앱 브라우저 등)가 있어,
  // public/에 워커 파일을 직접 두고 고정 경로로 가리킨다.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  let pdf;
  try {
    const buffer = await file.arrayBuffer();
    pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  } catch {
    throw new PdfParseError(
      "PDF 파일을 열지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요."
    );
  }

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n\n";
  }

  const trimmed = fullText.trim();
  if (trimmed.length < MIN_PDF_TEXT_CHARS) {
    throw new PdfParseError(
      "글자를 거의 읽지 못했습니다. 이미지로 저장된 PDF일 수 있으니, " +
        "한글에서 글자가 포함된 PDF로 다시 변환해 올려 주세요."
    );
  }

  return { text: trimmed, pageCount: pdf.numPages };
}
