/** 화면에 그대로 보여줄 안내 문구를 담은 오류 */
export class ReportGenerationError extends Error {}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/**
 * 화면에 그려둔 보고서 DOM(reportRef)을 그대로 캡처해 PDF로 저장한다.
 * 한글은 표준 PDF 내장 폰트가 지원하지 않아, 폰트를 따로 심는 대신
 * DOM을 이미지로 캡처해 PDF에 붙이는 방식을 쓴다(브랜드 컬러가
 * Tailwind v4 기본 팔레트의 oklch() 색상이라 일반 html2canvas는
 * 색을 못 읽어 html2canvas-pro를 쓴다).
 */
export async function downloadReportPdf(
  element: HTMLElement,
  fileName: string
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: html2canvas } = await import("html2canvas-pro");

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
    });
  } catch (error) {
    throw new ReportGenerationError(
      `보고서 화면을 이미지로 만들지 못했습니다. (${describeError(error)})`
    );
  }

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/png");

  // 한 페이지보다 길면, 같은 이미지를 위로 밀어가며 여러 페이지에 나눠 붙인다
  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}
