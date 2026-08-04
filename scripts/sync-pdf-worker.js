// pdfjs-dist의 legacy 빌드 워커 파일을 public/에 복사한다.
// npm run dev/build/start 실행 전 자동으로 실행된다 (package.json의 pre* 스크립트).
// pdfjs-dist를 업그레이드해도 워커 파일 버전이 라이브러리와 어긋나지 않도록,
// 수동 복사 대신 매번 자동으로 다시 복사한다.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const source = path.join(
  root,
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.min.mjs"
);
const target = path.join(root, "public", "pdf.worker.legacy.min.mjs");

if (!fs.existsSync(source)) {
  console.warn(
    "[sync-pdf-worker] pdfjs-dist legacy 워커 파일을 찾지 못했습니다. " +
      "node_modules가 설치돼 있는지 확인해 주세요."
  );
  process.exit(0);
}

fs.copyFileSync(source, target);
console.log("[sync-pdf-worker] pdfjs-dist legacy 워커 -> public/pdf.worker.legacy.min.mjs 동기화 완료");
