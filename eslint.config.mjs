import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Node로 직접 실행하는 빌드 전 스크립트 (CommonJS, 앱 번들 대상 아님)
    "scripts/**",
    // pdfjs-dist에서 그대로 복사해온 서드파티 워커 파일 (직접 작성한 코드 아님)
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
