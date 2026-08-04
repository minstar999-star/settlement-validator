import { NextRequest, NextResponse } from "next/server";
import { MIN_PDF_TEXT_CHARS } from "../../lib/limits";

// Node.js 런타임에서 돌린다 — pdfjs-dist가 워커 없이 같은 프로세스에서 바로 파싱한다.
// (브라우저 엔진과 무관해지므로, iOS Safari/WebKit 호환성 문제 자체가 사라진다)
export const runtime = "nodejs";

/** 진단을 위해 실제 예외의 종류·메시지를 짧게 붙인다 */
function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/**
 * 질의서 PDF에서 글자를 뽑는다. (PRD 개발 단위 4)
 *
 * 원래는 브라우저(클라이언트)에서 pdfjs-dist로 처리했으나, iOS Safari/WebKit
 * 엔진에서 "TypeError: undefined is not a function"으로 계속 실패해
 * (브라우저 종류·최신/구형 빌드와 무관하게 iOS에서만 재현) 서버 처리로 옮겼다.
 * 업로드된 파일은 이 요청 처리 중에만 메모리에 있고, 디스크·DB에 저장하지 않는다.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: "PDF 파일을 받지 못했습니다." },
      { status: 400 }
    );
  }

  let pdfjsLib;
  try {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (error) {
    console.error("pdfjs-dist 로딩 오류:", error);
    return NextResponse.json(
      { error: `서버에서 PDF 처리 도구를 불러오지 못했습니다. (${describeError(error)})` },
      { status: 500 }
    );
  }

  let pdf;
  try {
    const buffer = await file.arrayBuffer();
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  } catch (error) {
    return NextResponse.json(
      {
        error: `PDF 파일을 열지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요. (${describeError(error)})`,
      },
      { status: 400 }
    );
  }

  let fullText = "";
  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      fullText += pageText + "\n\n";
    }
  } catch (error) {
    return NextResponse.json(
      { error: `PDF에서 글자를 뽑는 중 오류가 났습니다. (${describeError(error)})` },
      { status: 500 }
    );
  }

  const trimmed = fullText.trim();
  if (trimmed.length < MIN_PDF_TEXT_CHARS) {
    return NextResponse.json(
      {
        error:
          "글자를 거의 읽지 못했습니다. 이미지로 저장된 PDF일 수 있으니, " +
          "한글에서 글자가 포함된 PDF로 다시 변환해 올려 주세요.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ text: trimmed, pageCount: pdf.numPages });
}
