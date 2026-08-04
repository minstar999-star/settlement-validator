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
    // 삭제 대기함 (더는 안 쓰지만 바로 지우지 않고 옮겨둔 파일들)
    "trash-can/**",
  ]),
]);

export default eslintConfig;
