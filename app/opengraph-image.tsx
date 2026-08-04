import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** 링크 공유 시 뜨는 미리보기 카드 — 재정경제부 로고를 넣는다 */
export default async function Image() {
  const svg = await readFile(
    path.join(process.cwd(), "public", "재정경제부.svg"),
    "utf-8"
  );
  const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", height: 8, width: "100%", background: "#003668" }} />
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoDataUri} width={420} height={132} alt="" />
          <div
            style={{
              marginTop: 36,
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: -2,
              color: "#003668",
            }}
          >
            Validator
          </div>
          <div style={{ marginTop: 20, fontSize: 32, color: "#595757" }}>
            국가결산 질의자료 검증·근거분석 솔루션
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
