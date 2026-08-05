"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import { OlapParseError, parseOlapFile } from "../lib/excel";
import { PdfParseError, extractPdfText } from "../lib/pdf";
import { MAX_PDF_TOTAL_PAGES } from "../lib/limits";
import { formatWon } from "../lib/amount";
import { verify } from "../lib/verify";
import { redactPersonalNames } from "../lib/privacy";
import { ReportGenerationError, downloadReportPdf } from "../lib/report";
import type {
  AnalyzeItem,
  CauseResult,
  Figure,
  LoadedFile,
  OlapData,
  Question,
  QuestionDoc,
  VerificationResult,
  Verdict,
} from "../lib/types";

/** 원인 컬럼에 쓸 텍스트 — 결과 복사·CSV 내보내기 공용 (PLAN.md 19번) */
function causeText(figure: Figure, state: CauseState | undefined): string {
  if (figure.verdict !== "불일치") return "";
  if (!state) return "";
  if (state.status === "loading") return "분석 중";
  if (state.status === "error") return state.message;
  return `${state.result.cause} — ${state.result.reason}`;
}

/** 결과 표 한 행을 내보내기용 문자열 배열로 만든다 */
function figureRowValues(
  figure: Figure,
  question: Question | undefined,
  causeState: CauseState | undefined
): string[] {
  const mergedNote = figure.mergedQuestions?.length
    ? ` (+${figure.mergedQuestions.map((q) => q.title).join(", ")}과 통합)`
    : "";
  return [
    question ? `${question.title} (${question.docName})${mergedNote}` : "",
    figure.verdict,
    figure.conversion ?? formatWon(figure.won),
    figure.actual !== null ? formatWon(figure.actual) : "",
    targetLabelText(figure),
    causeText(figure, causeState),
  ];
}

const RESULT_COLUMNS = ["질의 항목", "판정", "인용값", "원자료값", "근거 위치", "원인"];

/** 대조 대상 계정을 사람이 읽을 수 있는 한 줄로 적는다 (화면 표시 + AI 분석 요청 공용) */
function targetLabelText(figure: Figure): string {
  if (figure.target?.row) {
    const r = figure.target.row;
    return `${r.회계} > ${r.관} > ${r.항} > ${r.목} (엑셀 ${r.rowNumber}행)`;
  }
  if (figure.target?.aggregate) {
    const g = figure.target.aggregate;
    return `${g.label} 합계 (하위 ${g.rows.length}개 목 합산)`;
  }
  return "대상 계정 미특정";
}

type CauseState =
  | { status: "loading" }
  | { status: "done"; result: CauseResult }
  | { status: "error"; message: string };

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** 시연용 더미데이터 — public/sample-data/ 에 있는 파일을 그대로 불러온다 */
const DEMO_PDF = {
  url: "/sample-data/query.pdf",
  name: "국회 예산정책처 2025 회계결산연도 질의사항_샘플.pdf",
};
const DEMO_XLSX = {
  url: "/sample-data/olap.xlsx",
  name: "OLAP 2025회계연도_세입결산자료_더미.xlsx",
};

function toFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt.files;
}

/** 파일 상태에 따른 뱃지 */
function StatusBadge({ status }: { status: LoadedFile<unknown>["status"] }) {
  const style =
    status === "준비 완료"
      ? "bg-green-100 text-green-700"
      : status === "오류"
        ? "bg-red-100 text-brand-red"
        : "bg-zinc-100 text-zinc-500";
  return (
    <span
      className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${style}`}
    >
      {status}
    </span>
  );
}

/** 판정 뱃지 — 불일치만 로고 빨강으로 강조한다 (PRD 5번 디자인) */
function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const style =
    verdict === "일치"
      ? "bg-green-100 text-green-700"
      : verdict === "불일치"
        ? "bg-red-100 text-brand-red font-semibold"
        : "bg-zinc-100 text-zinc-500";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ${style}`}>
      {verdict}
    </span>
  );
}

/** 대조한 계정을 한 줄로 적는다 */
function TargetCell({ figure }: { figure: Figure }) {
  if (figure.target?.row) {
    const r = figure.target.row;
    return (
      <>
        <div className="text-zinc-800">
          {r.회계} &gt; {r.관} &gt; {r.항} &gt; {r.목}
        </div>
        <div className="mt-0.5 text-xs text-brand-gray">
          엑셀 {r.rowNumber}행
        </div>
      </>
    );
  }
  if (figure.target?.aggregate) {
    const g = figure.target.aggregate;
    return (
      <>
        <div className="text-zinc-800">{g.label} 합계</div>
        <div className="mt-0.5 text-xs text-brand-gray">
          하위 {g.rows.length}개 목을 합산해 비교
        </div>
      </>
    );
  }
  if (figure.candidates.length > 0) {
    return (
      <div className="text-xs text-brand-gray">
        후보 {figure.candidates.length}건 —{" "}
        {figure.candidates
          .map((c) => `${c.회계}(${c.rowNumber}행)`)
          .join(", ")}
      </div>
    );
  }
  return <span className="text-xs text-brand-gray">—</span>;
}

/** 불일치 항목의 원인 분석 결과 — PLAN.md 22번 */
function CauseCell({ state }: { state: CauseState | undefined }) {
  if (!state) return <span className="text-xs text-brand-gray">—</span>;
  if (state.status === "loading") {
    return <span className="text-xs text-brand-gray">원인 분석 중…</span>;
  }
  if (state.status === "error") {
    return <span className="text-xs text-brand-red">{state.message}</span>;
  }
  return (
    <>
      <div className="text-xs font-semibold text-brand-blue">
        {state.result.cause}
      </div>
      <div className="mt-0.5 text-xs text-brand-gray">{state.result.reason}</div>
    </>
  );
}

/**
 * "보고서 생성" 버튼이 캡처해 PDF로 만드는 숨은 요약 문서.
 * 화면 밖(fixed left: -9999px)에 그려두고 html2canvas로 캡처만 한다.
 * 사용자가 고른 범위대로 불일치 항목만 담는다.
 */
function MismatchReportTemplate({
  result,
  causes,
  innerRef,
}: {
  result: VerificationResult;
  causes: Record<string, CauseState>;
  innerRef: RefObject<HTMLDivElement | null>;
}) {
  const questionById = new Map(result.questions.map((q) => [q.id, q]));
  const mismatches = result.figures.filter((f) => f.verdict === "불일치");

  return (
    <div
      ref={innerRef}
      className="fixed left-[-9999px] top-0 w-[794px] bg-white p-10 text-zinc-900"
      style={{
        fontFamily:
          '"Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif',
      }}
    >
      <div className="flex items-center gap-3 border-b-2 border-brand-blue pb-4">
        {/* next/image는 화면 밖 요소를 지연 로딩해 캡처 시 비어있을 수 있어 일반 img를 쓴다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/재정경제부.svg" alt="재정경제부 로고" width={32} height={32} />
        <div>
          <div className="text-lg font-bold text-brand-blue">
            Validator — 결산질의 검증 보고서
          </div>
          <div className="text-xs text-zinc-500">
            재정경제부 회계결산과 · 내부 검증 도구
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
        <span>불일치 항목 {mismatches.length}건</span>
        <span>생성일시 {new Date().toLocaleString("ko-KR")}</span>
      </div>
      {mismatches.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600">
          불일치로 판정된 항목이 없습니다.
        </p>
      ) : (
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-300 bg-zinc-50 text-left">
              <th className="p-2">질의 항목</th>
              <th className="p-2">인용값</th>
              <th className="p-2">원자료값</th>
              <th className="p-2">근거 위치</th>
              <th className="p-2">원인</th>
            </tr>
          </thead>
          <tbody>
            {mismatches.map((figure) => {
              const question = questionById.get(figure.questionId);
              return (
                <tr
                  key={figure.id}
                  className="border-b border-zinc-200 align-top"
                >
                  <td className="p-2">
                    {question ? `${question.title} (${question.docName})` : ""}
                  </td>
                  <td className="p-2">
                    {figure.conversion ?? formatWon(figure.won)}
                  </td>
                  <td className="p-2">
                    {figure.actual !== null ? formatWon(figure.actual) : ""}
                  </td>
                  <td className="p-2">{targetLabelText(figure)}</td>
                  <td className="p-2">{causeText(figure, causes[figure.id])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="mt-6 text-[10px] text-zinc-400">
        이 보고서는 실습을 위한 가상 더미데이터를 포함할 수 있으며, 내부
        검증용으로만 사용합니다.
      </p>
    </div>
  );
}

export default function ValidatorPage() {
  const [olap, setOlap] = useState<LoadedFile<OlapData> | null>(null);
  const [docs, setDocs] = useState<LoadedFile<QuestionDoc>[]>([]);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [causes, setCauses] = useState<Record<string, CauseState>>({});
  const [copyStatus, setCopyStatus] = useState<"idle" | "done" | "error">("idle");
  const [reportStatus, setReportStatus] = useState<
    "idle" | "생성 중" | "done" | "error"
  >("idle");
  const [reportErrorMessage, setReportErrorMessage] = useState("");
  const olapInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const readyDocs = docs.filter((d) => d.status === "준비 완료");
  const totalPages = readyDocs.reduce(
    (sum, d) => sum + (d.data?.pageCount ?? 0),
    0
  );
  const olapReady = olap?.status === "준비 완료";
  const canVerify = olapReady && readyDocs.length > 0;

  /** OLAP 엑셀 업로드 — 한 번에 1개만 (PRD 5번 (가)) */
  async function handleOlapFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    const id = newId();
    setOlap({ id, fileName: file.name, status: "처리 중" });

    try {
      const data = await parseOlapFile(file);
      setOlap({ id, fileName: file.name, status: "준비 완료", data });
    } catch (error) {
      const message =
        error instanceof OlapParseError
          ? error.message
          : "엑셀을 읽는 중 알 수 없는 오류가 났습니다.";
      console.error("OLAP 파싱 오류:", error);
      setOlap({
        id,
        fileName: file.name,
        status: "오류",
        errorMessage: message,
      });
    } finally {
      if (olapInputRef.current) olapInputRef.current.value = "";
    }
  }

  /** 질의서 PDF 업로드 — 여러 개 가능, 합계 50페이지까지 (PRD 5번 (가)) */
  async function handlePdfFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList);

    for (const file of files) {
      const id = newId();
      setDocs((prev) => [
        ...prev,
        { id, fileName: file.name, status: "처리 중" },
      ]);

      try {
        const { text, pageCount } = await extractPdfText(file);

        // 이미 준비된 문서들과 합쳐 페이지 상한을 넘는지 확인한다
        setDocs((prev) => {
          const already = prev
            .filter((d) => d.id !== id && d.status === "준비 완료")
            .reduce((sum, d) => sum + (d.data?.pageCount ?? 0), 0);

          if (already + pageCount > MAX_PDF_TOTAL_PAGES) {
            const message =
              `질의서 합계가 ${already + pageCount}페이지가 되어 상한(${MAX_PDF_TOTAL_PAGES}페이지)을 넘습니다. ` +
              `이 파일은 검증에서 제외했습니다.`;
            return prev.map((d) =>
              d.id === id
                ? { ...d, status: "오류" as const, errorMessage: message }
                : d
            );
          }

          return prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: "준비 완료" as const,
                  data: { id, fileName: file.name, pageCount, text },
                }
              : d
          );
        });
      } catch (error) {
        const message =
          error instanceof PdfParseError
            ? error.message
            : "PDF를 읽는 중 알 수 없는 오류가 났습니다.";
        console.error("PDF 파싱 오류:", error);
        setDocs((prev) =>
          prev.map((d) =>
            d.id === id ? { ...d, status: "오류", errorMessage: message } : d
          )
        );
      }
    }

    if (pdfInputRef.current) pdfInputRef.current.value = "";
  }

  function removeDoc(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setResult(null);
  }

  /**
   * 처음 들어온 사람이 바로 시연해볼 수 있도록, 더미 질의서·OLAP 엑셀을 자동으로
   * 채워둔다. ✕로 지우거나 "다른 엑셀로 바꾸기"로 실제 파일로 바꿀 수 있다.
   */
  const demoLoaded = useRef(false);
  useEffect(() => {
    if (demoLoaded.current) return;
    demoLoaded.current = true;

    (async () => {
      try {
        const [pdfBlob, xlsxBlob] = await Promise.all([
          fetch(DEMO_PDF.url).then((r) => r.blob()),
          fetch(DEMO_XLSX.url).then((r) => r.blob()),
        ]);
        const pdfFile = new File([pdfBlob], DEMO_PDF.name, {
          type: "application/pdf",
        });
        const xlsxFile = new File([xlsxBlob], DEMO_XLSX.name, {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        await handlePdfFiles(toFileList([pdfFile]));
        await handleOlapFile(toFileList([xlsxFile]));
      } catch (error) {
        console.error("예시 데이터 자동 로드 오류:", error);
      }
    })();
  }, []);

  /**
   * 불일치 항목의 원인을 분석한다. (PLAN.md 20~22번)
   * 원본 파일이 아니라, 질의 문장(개인 식별 표현 제거) + 대조 결과 수치만 서버로 보낸다. (PRD 7번)
   */
  async function analyzeCauses(verified: VerificationResult) {
    const mismatched = verified.figures.filter(
      (f): f is Figure & { actual: number; difference: number } =>
        f.verdict === "불일치" && f.actual !== null && f.difference !== null
    );
    if (mismatched.length === 0) return;

    setCauses((prev) => {
      const next = { ...prev };
      mismatched.forEach((f) => (next[f.id] = { status: "loading" }));
      return next;
    });

    const questionById = new Map(verified.questions.map((q) => [q.id, q]));
    const items: AnalyzeItem[] = mismatched.map((f) => ({
      id: f.id,
      questionText: redactPersonalNames(questionById.get(f.questionId)?.text ?? ""),
      citedRaw: f.raw,
      citedWon: f.won,
      basis: f.basis,
      basisColumn: f.basisColumn,
      actual: f.actual,
      difference: f.difference,
      targetLabel: targetLabelText(f),
      matchesOtherColumn: f.matchesOtherColumn,
      matchesOtherAccount: f.matchesOtherAccount,
      matchesSubAggregate: f.matchesSubAggregate,
    }));

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();

      if (!res.ok) {
        const message: string = data.error ?? "원인 분석에 실패했습니다.";
        setCauses((prev) => {
          const next = { ...prev };
          mismatched.forEach((f) => (next[f.id] = { status: "error", message }));
          return next;
        });
        return;
      }

      const resultsById = new Map<string, CauseResult>(
        (data.results ?? []).map((r: CauseResult & { id: string }) => [r.id, r])
      );
      setCauses((prev) => {
        const next = { ...prev };
        mismatched.forEach((f) => {
          const found = resultsById.get(f.id);
          next[f.id] = found
            ? { status: "done", result: found }
            : { status: "error", message: "원인 분석 결과를 받지 못했습니다." };
        });
        return next;
      });
    } catch (error) {
      console.error("원인 분석 요청 오류:", error);
      setCauses((prev) => {
        const next = { ...prev };
        mismatched.forEach(
          (f) =>
            (next[f.id] = {
              status: "error",
              message: "네트워크 오류로 원인 분석에 실패했습니다.",
            })
        );
        return next;
      });
    }
  }

  /** 검증 실행 — 판정 자체는 AI 없이 계산만으로 끝낸다 (개발 단위 7~15) */
  function handleVerify() {
    if (!olap?.data) return;
    const ready = docs
      .filter((d) => d.status === "준비 완료" && d.data)
      .map((d) => d.data!);
    if (ready.length === 0) return;
    const verified = verify(olap.data, ready);
    setResult(verified);
    setCauses({});
    setCopyStatus("idle");
    analyzeCauses(verified);
  }

  /** 결과 표를 클립보드에 복사한다 (엑셀·한글 표에 그대로 붙여넣기 가능한 탭 구분 형식). PLAN.md 19번 */
  async function handleCopyResults() {
    if (!result) return;
    const questionById = new Map(result.questions.map((q) => [q.id, q]));
    const lines = [
      RESULT_COLUMNS.join("\t"),
      ...result.figures.map((f) =>
        figureRowValues(f, questionById.get(f.questionId), causes[f.id])
          .map((v) => v.replace(/\t/g, " ").replace(/\n/g, " "))
          .join("\t")
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyStatus("done");
    } catch (error) {
      console.error("결과 복사 오류:", error);
      setCopyStatus("error");
    }
  }

  /** 결과 표를 CSV 파일로 내려받는다. PLAN.md 19번 */
  function handleDownloadCsv() {
    if (!result) return;
    const questionById = new Map(result.questions.map((q) => [q.id, q]));
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      RESULT_COLUMNS.map(escape).join(","),
      ...result.figures.map((f) =>
        figureRowValues(f, questionById.get(f.questionId), causes[f.id])
          .map(escape)
          .join(",")
      ),
    ];
    // 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 붙인다
    const blob = new Blob(["﻿" + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `결산질의_검증결과_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 불일치 항목만 요약한 PDF 보고서를 만들어 내려받는다 */
  async function handleGenerateReport() {
    if (!reportRef.current) return;
    setReportStatus("생성 중");
    try {
      const today = new Date().toISOString().slice(0, 10);
      await downloadReportPdf(
        reportRef.current,
        `결산질의_검증보고서_${today}.pdf`
      );
      setReportStatus("done");
    } catch (error) {
      const message =
        error instanceof ReportGenerationError
          ? error.message
          : "보고서를 만드는 중 알 수 없는 오류가 났습니다.";
      console.error("보고서 생성 오류:", error);
      setReportErrorMessage(message);
      setReportStatus("error");
    }
  }

  return (
    <main className="min-w-[1024px] bg-zinc-50">
      {/* 정부 사이트 관례를 따른 상단 브랜드 바 */}
      <div className="h-1.5 w-full bg-brand-blue" />
      <div className="mx-auto w-full max-w-6xl px-8 py-10">
        {/* 머리말 */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-brand-blue/15 pb-6">
          <div className="flex items-center gap-4">
            <Image
              src="/재정경제부.svg"
              alt="재정경제부 로고"
              width={188}
              height={59}
              priority
              className="h-9 w-auto shrink-0"
            />
            <div className="h-9 w-px bg-zinc-200" aria-hidden />
            <div>
              <Link
                href="/"
                className="text-xs text-brand-gray hover:text-brand-blue hover:underline"
              >
                ← 처음으로
              </Link>
              <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight text-brand-blue">
                Validator
              </h1>
              <p className="mt-1 text-sm text-brand-gray">
                국회 결산 질의서(PDF)와 D-Brain OLAP 자료(엑셀)를 올리면, 질의서에
                인용된 수치를 원자료와 대조해 검증합니다.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-brand-blue-light px-3 py-1.5 text-xs font-medium text-brand-blue">
            재정경제부 회계결산과 · 내부 검증 도구
          </span>
        </header>

        {/* 업로드 영역 */}
        <p className="mb-3 rounded-lg bg-brand-blue-light px-4 py-2.5 text-xs text-brand-blue">
          시연을 위해 예시 질의서·OLAP 자료가 자동으로 채워져 있습니다. ✕로 지우거나
          다른 파일로 바꿔 직접 테스트해볼 수 있습니다.
        </p>
        <div className="grid grid-cols-2 gap-6">
          {/* 질의서 PDF */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-brand-blue">
                ① 국회 질의서 (PDF)
              </h2>
              <span className="text-xs text-brand-gray">
                여러 개 가능 · 합계 {MAX_PDF_TOTAL_PAGES}페이지까지
              </span>
            </div>
            <p className="mb-4 text-xs text-brand-gray">
              한글 파일은 &ldquo;PDF로 저장&rdquo; 후 올려 주세요.
            </p>

            <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-brand-blue/40 bg-brand-blue-light px-4 py-8 text-center text-sm font-medium text-brand-blue hover:bg-brand-blue/10">
              질의서 PDF 선택
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handlePdfFiles(e.target.files)}
              />
            </label>

            {docs.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-zinc-700">
                        {doc.fileName}
                        {doc.data && (
                          <span className="ml-2 text-xs text-brand-gray">
                            {doc.data.pageCount}페이지
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center">
                        <StatusBadge status={doc.status} />
                        <button
                          type="button"
                          onClick={() => removeDoc(doc.id)}
                          className="ml-2 rounded px-1.5 text-xs text-brand-gray hover:text-brand-red"
                          aria-label={`${doc.fileName} 제거`}
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                    {doc.errorMessage && (
                      <p className="mt-1.5 whitespace-pre-line text-xs text-brand-red">
                        {doc.errorMessage}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {readyDocs.length > 0 && (
              <p className="mt-3 text-xs text-brand-gray">
                준비된 질의서 {readyDocs.length}건 · 합계 {totalPages}페이지
              </p>
            )}
          </section>

          {/* OLAP 엑셀 */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-brand-blue">
                ② D-Brain OLAP 자료 (엑셀)
              </h2>
              <span className="text-xs text-brand-gray">1개만</span>
            </div>
            <p className="mb-4 text-xs text-brand-gray">
              첫 행에 회계 · 관 · 항 · 목 열과 금액 열이 있어야 합니다.
            </p>

            <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-brand-blue/40 bg-brand-blue-light px-4 py-8 text-center text-sm font-medium text-brand-blue hover:bg-brand-blue/10">
              {olap ? "다른 엑셀로 바꾸기" : "OLAP 엑셀 선택"}
              <input
                ref={olapInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => handleOlapFile(e.target.files)}
              />
            </label>

            {olap && (
              <div className="mt-4 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="truncate text-zinc-700">
                    {olap.fileName}
                    {olap.data && (
                      <span className="ml-2 text-xs text-brand-gray">
                        {olap.data.rows.length.toLocaleString()}행
                      </span>
                    )}
                  </span>
                  <StatusBadge status={olap.status} />
                </div>
                {olap.errorMessage && (
                  <p className="mt-1.5 whitespace-pre-line text-xs text-brand-red">
                    {olap.errorMessage}
                  </p>
                )}
                {olap.data && (
                  <dl className="mt-2 space-y-1 text-xs text-brand-gray">
                    <div>
                      <dt className="inline font-medium">시트</dt>
                      <dd className="ml-2 inline">{olap.data.sheetName}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">금액 열</dt>
                      <dd className="ml-2 inline">
                        {olap.data.amountColumns.join(" · ")}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            )}
          </section>
        </div>

        {/* 검증 실행 */}
        <div className="mt-8 flex items-center gap-4">
          <button
            type="button"
            disabled={!canVerify}
            onClick={handleVerify}
            className="rounded-xl bg-brand-blue px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-[#002748] disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            검증 실행
          </button>
          {!canVerify && (
            <p className="text-sm text-brand-gray">
              질의서 PDF와 OLAP 엑셀이 모두 &ldquo;준비 완료&rdquo; 상태여야
              검증을 시작할 수 있습니다.
            </p>
          )}
        </div>

        {/* 검증 결과 (PLAN.md 17번 — 판정 결과 표) */}
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-base font-semibold text-brand-blue">검증 결과</h2>

          {!result ? (
            <p className="mt-8 mb-8 text-center text-sm text-brand-gray">
              아직 검증을 실행하지 않았습니다.
            </p>
          ) : (
            <>
              {/* 확인불가 과다 경고 배너 */}
              {result.warning && (
                <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {result.warning}
                </p>
              )}

              {result.figures.length === 0 ? (
                <p className="mt-8 mb-8 text-center text-sm text-brand-gray">
                  검증 대상 수치(금액 표기가 있는 질의)가 없습니다.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left text-xs text-brand-gray">
                        <th className="py-2 pr-4 font-medium">질의 항목</th>
                        <th className="py-2 pr-4 font-medium">판정</th>
                        <th className="py-2 pr-4 font-medium">인용값</th>
                        <th className="py-2 pr-4 font-medium">원자료값</th>
                        <th className="py-2 pr-4 font-medium">근거 위치</th>
                        <th className="py-2 font-medium">원인</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.figures.map((figure) => {
                        const question = result.questions.find(
                          (q) => q.id === figure.questionId
                        );
                        return (
                          <tr
                            key={figure.id}
                            className="border-b border-zinc-100 align-top last:border-0"
                          >
                            <td className="py-3 pr-4">
                              <div className="font-medium text-zinc-800">
                                {question?.title ?? "—"}
                              </div>
                              {question && (
                                <div className="mt-0.5 text-xs text-brand-gray">
                                  {question.docName}
                                </div>
                              )}
                              {figure.mergedQuestions &&
                                figure.mergedQuestions.length > 0 && (
                                  <div className="mt-1 text-xs text-brand-blue">
                                    {figure.mergedQuestions
                                      .map((q) => q.title)
                                      .join(", ")}
                                    과 같은 질의로 통합 (
                                    {figure.mergedQuestions.length + 1}건)
                                  </div>
                                )}
                            </td>
                            <td className="py-3 pr-4">
                              <VerdictBadge verdict={figure.verdict} />
                            </td>
                            <td className="py-3 pr-4">
                              <div className="text-zinc-800">
                                {figure.conversion ?? formatWon(figure.won)}
                              </div>
                              <div className="mt-0.5 text-xs text-brand-gray">
                                {figure.basis}
                                {figure.basisColumn ? ` · ${figure.basisColumn}` : ""}
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              {figure.actual !== null ? (
                                <div className="text-zinc-800">
                                  {formatWon(figure.actual)}
                                </div>
                              ) : (
                                <span className="text-brand-gray">—</span>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <TargetCell figure={figure} />
                              {figure.note && (
                                <div className="mt-1 text-xs text-brand-gray">
                                  {figure.note}
                                </div>
                              )}
                              {(figure.matchesOtherColumn ||
                                figure.matchesOtherAccount ||
                                figure.matchesSubAggregate) && (
                                <div className="mt-1 text-xs text-amber-700">
                                  {figure.matchesOtherColumn &&
                                    `인용값이 같은 계정의 "${figure.matchesOtherColumn}"과 일치`}
                                  {figure.matchesOtherAccount &&
                                    `인용값이 ${figure.matchesOtherAccount}과 일치`}
                                  {figure.matchesSubAggregate &&
                                    `인용값이 ${figure.matchesSubAggregate}와 일치`}
                                </div>
                              )}
                            </td>
                            <td className="py-3">
                              {figure.verdict === "불일치" ? (
                                <CauseCell state={causes[figure.id]} />
                              ) : (
                                <span className="text-xs text-brand-gray">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {result.figures.length > 0 && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyResults}
                    className="rounded-lg border border-brand-blue/30 px-4 py-2 text-xs font-medium text-brand-blue transition-colors hover:bg-brand-blue-light"
                  >
                    결과 복사
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="rounded-lg border border-brand-blue/30 px-4 py-2 text-xs font-medium text-brand-blue transition-colors hover:bg-brand-blue-light"
                  >
                    CSV 다운로드
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateReport}
                    disabled={reportStatus === "생성 중"}
                    className="rounded-lg border border-brand-blue/30 px-4 py-2 text-xs font-medium text-brand-blue transition-colors hover:bg-brand-blue-light disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {reportStatus === "생성 중" ? "보고서 생성 중…" : "보고서 생성"}
                  </button>
                  {copyStatus === "done" && (
                    <span className="text-xs text-brand-gray">
                      결과를 클립보드에 복사했습니다.
                    </span>
                  )}
                  {copyStatus === "error" && (
                    <span className="text-xs text-brand-red">
                      복사에 실패했습니다. 다시 시도해주세요.
                    </span>
                  )}
                  {reportStatus === "done" && (
                    <span className="text-xs text-brand-gray">
                      불일치 항목 보고서를 내려받았습니다.
                    </span>
                  )}
                  {reportStatus === "error" && (
                    <span className="text-xs text-brand-red">
                      {reportErrorMessage}
                    </span>
                  )}
                </div>
              )}

              {/* 검증대상외 질의 목록 */}
              {result.skipped.length > 0 && (
                <div className="mt-8 border-t border-zinc-200 pt-6">
                  <h3 className="text-sm font-semibold text-brand-blue">
                    검증대상외 질의 ({result.skipped.length}건)
                  </h3>
                  <p className="mt-1 text-xs text-brand-gray">
                    금액 수치가 없어 판정에서 제외한 질의입니다. 누락된 항목이
                    없는지 확인해 주세요.
                  </p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {result.skipped.map((q) => (
                      <li
                        key={q.id}
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      >
                        <div className="font-medium text-zinc-800">
                          {q.title}
                          <span className="ml-2 text-xs font-normal text-brand-gray">
                            {q.docName}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-brand-gray">
                          {q.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        {result && (
          <MismatchReportTemplate
            result={result}
            causes={causes}
            innerRef={reportRef}
          />
        )}

        {/* 정부 사이트 관례를 따른 하단 정보 표시 */}
        <footer className="mt-10 border-t border-zinc-200 pt-6 text-center text-xs text-brand-gray">
          재정경제부 회계결산과 · Validator
          <br />
          내부 검증용 도구이며, 화면의 질의서·수치는 실습을 위한 가상 더미데이터입니다.
        </footer>
      </div>
    </main>
  );
}
