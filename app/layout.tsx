import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { KakaoEscape } from "./KakaoEscape";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://my-app-iota-three-39.vercel.app";
const SITE_DESCRIPTION =
  "국회 결산 질의서와 D-Brain OLAP 자료를 대조해 수치를 검증하는 도구";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Validator",
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "Validator",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Validator",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Validator",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <KakaoEscape />
        {children}
      </body>
    </html>
  );
}
