"use client";

import { useEffect, useState } from "react";

/**
 * 카카오톡 인앱 브라우저는 웹 워커·파일 API 등 여러 기능을 제한해
 * PDF 파싱(pdfjs-dist)이 실패하는 경우가 많다. 카카오톡 안에서 열렸으면
 * 기기의 기본 브라우저(크롬·사파리)로 자동으로 열어준다.
 */
export function KakaoEscape() {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (!/KAKAOTALK/i.test(ua)) return;

    const url = window.location.href;
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;

    // 자동 이동이 안 될 수도 있으니, 잠시 후에도 여전히 카카오톡 안이면 안내 배너를 보여준다
    const timer = window.setTimeout(() => setShowFallback(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  if (!showFallback) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 shadow">
      카카오톡 안에서는 일부 기능(PDF 업로드 등)이 제대로 동작하지 않을 수 있습니다.
      오른쪽 위 <strong>&lsquo;⋯&rsquo;</strong> 메뉴에서{" "}
      <strong>&lsquo;다른 브라우저로 열기&rsquo;</strong>를 눌러주세요.
    </div>
  );
}
