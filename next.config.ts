import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist(legacy 빌드)는 Node.js 환경에서 워커 파일을 상대 경로로 찾는데,
  // 서버 번들에 그대로 묶이면 그 경로가 깨진다. 번들링에서 제외하고
  // node_modules에서 그대로 require하게 한다. (app/api/extract-pdf/route.ts)
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
