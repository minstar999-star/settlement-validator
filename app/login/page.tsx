"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  function goToNext() {
    const next = searchParams.get("next") ?? "/validator";
    // 로그인 직후 서버가 내려준 쿠키를 확실히 반영하도록 전체 이동한다
    window.location.href = next;
  }

  async function handleDemoEnter() {
    setDemoLoading(true);
    try {
      const res = await fetch("/api/demo-login", { method: "POST" });
      if (res.ok) {
        goToNext();
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "체험 입장에 실패했습니다.");
    } catch {
      setError("네트워크 오류로 체험 입장에 실패했습니다.");
    } finally {
      setDemoLoading(false);
    }
  }

  function validate(): string | null {
    if (!email.trim()) return "이메일을 입력해 주세요.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "이메일 형식이 올바르지 않습니다.";
    }
    if (!password) return "비밀번호를 입력해 주세요.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했습니다.");
        setSubmitting(false);
        return;
      }
      goToNext();
    } catch {
      setError("네트워크 오류로 로그인하지 못했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="mb-4 text-lg font-bold text-zinc-800">로그인</h1>

      <button
        type="button"
        onClick={handleDemoEnter}
        disabled={demoLoading}
        className="w-full rounded-xl bg-brand-blue px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#002748] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
      >
        {demoLoading ? "입장 중…" : "바로 체험하기"}
      </button>
      <p className="mt-2 text-center text-xs text-brand-gray">
        예시 데이터로 채워진 화면을 로그인 없이 바로 둘러볼 수 있습니다.
      </p>

      <div className="my-6 flex items-center gap-3 text-xs text-zinc-400">
        <div className="h-px flex-1 bg-zinc-200" />
        또는
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-medium text-brand-gray"
          >
            이메일
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/30"
            placeholder="example@moef.go.kr"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-medium text-brand-gray"
          >
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/30"
            placeholder="비밀번호 입력"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-brand-red">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#002748] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
        >
          {submitting ? "확인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-full items-center justify-center bg-zinc-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image
            src="/재정경제부.svg"
            alt="재정경제부 로고"
            width={188}
            height={59}
            priority
            className="h-8 w-auto"
          />
          <p className="text-lg font-extrabold tracking-tight text-brand-blue">
            Validator
          </p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs text-brand-gray hover:text-brand-blue hover:underline"
          >
            ← 처음으로
          </Link>
        </div>
      </div>
    </main>
  );
}
