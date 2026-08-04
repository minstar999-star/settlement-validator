"use client";

import Image from "next/image";
import Link from "next/link";

const INTRO_ITEMS = [
  {
    title: "질의자료 업로드",
    desc: "국회 결산 질의자료 PDF를 등록합니다.",
  },
  {
    title: "OLAP 원자료 대조",
    desc: "D-Brain OLAP 엑셀 자료와 인용 수치를 비교합니다.",
  },
  {
    title: "오류 근거 분석",
    desc: "불일치 수치와 집계 기준 오류의 원인을 근거와 함께 확인합니다.",
  },
];

export default function LandingPage() {
  function scrollToIntro() {
    document.getElementById("intro")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main className="min-h-full bg-white">
      {/* 정부 사이트 관례를 따른 상단 브랜드 바 */}
      <div className="h-1.5 w-full bg-brand-blue" />

      <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
        {/* 머리말 */}
        <header className="mb-10 flex items-center gap-4 sm:mb-16">
          <Image
            src="/재정경제부.svg"
            alt="재정경제부 로고"
            width={188}
            height={59}
            priority
            className="h-8 w-auto shrink-0 sm:h-9"
          />
          <div className="h-8 w-px bg-zinc-200 sm:h-9" aria-hidden />
          <span className="text-sm font-medium text-brand-gray">
            재정경제부 회계결산과
          </span>
        </header>

        {/* 히어로 */}
        <section className="flex flex-col items-start gap-5 sm:gap-6">
          <h1 className="text-5xl font-extrabold tracking-tight text-brand-blue sm:text-6xl">
            Validator
          </h1>
          <p className="text-base font-medium text-zinc-700 sm:text-lg">
            국가결산 질의자료 검증·근거분석 솔루션
          </p>
          <p className="max-w-2xl text-sm leading-7 text-brand-gray sm:text-base sm:leading-8">
            국회 결산 질의자료와 D-Brain OLAP 원자료를 대조하여 수치 오류,
            집계 기준 차이와 판단 근거를 분석합니다.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="rounded-xl bg-brand-blue px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-[#002748] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue sm:text-base"
            >
              로그인
            </Link>
            <button
              type="button"
              onClick={scrollToIntro}
              className="text-sm font-medium text-brand-blue underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue sm:text-base"
            >
              서비스 소개
            </button>
          </div>
        </section>

        {/* 서비스 소개 */}
        <section id="intro" className="mt-16 scroll-mt-10 sm:mt-24">
          <h2 className="mb-6 text-lg font-semibold text-brand-blue sm:text-xl">
            서비스 소개
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {INTRO_ITEMS.map((item, i) => (
              <div
                key={item.title}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue-light text-sm font-semibold text-brand-blue">
                  {i + 1}
                </span>
                <p className="mt-4 text-sm font-semibold text-zinc-800 sm:text-base">
                  {item.title}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-brand-gray">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 정부 사이트 관례를 따른 하단 정보 표시 */}
        <footer className="mt-16 border-t border-zinc-200 pt-6 text-center text-xs text-brand-gray sm:mt-24">
          재정경제부 회계결산과 · Validator
          <br />
          내부 검증용 도구이며, 화면의 질의서·수치는 실습을 위한 가상 더미데이터입니다.
        </footer>
      </div>
    </main>
  );
}
