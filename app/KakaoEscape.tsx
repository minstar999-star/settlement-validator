"use client";

import { useEffect, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** navigator.userAgent는 세션 중 안 바뀌므로 구독은 없고 스냅샷만 읽는다 */
function getIsKakaoSnapshot(): boolean {
  // 최신 카카오톡 일부 버전은 UA에서 "KAKAOTALK"을 뺀다는 보고가 있어, 최대한 넓게 잡는다
  return /kakao/i.test(navigator.userAgent || "");
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * 카카오톡 인앱 브라우저는 웹 워커·파일 API 등 여러 기능을 제한해
 * PDF 파싱(pdfjs-dist)이 실패하는 경우가 많다. 카카오톡 안에서 열렸으면
 * 기기의 기본 브라우저(크롬·사파리)로 자동으로 열어준다.
 */
export function KakaoEscape() {
  const isKakao = useSyncExternalStore(noSubscribe, getIsKakaoSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!isKakao) return;
    const url = window.location.href;
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  }, [isKakao]);

  if (!isKakao) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 shadow">
      카카오톡 안에서는 일부 기능(PDF 업로드 등)이 제대로 동작하지 않을 수 있습니다.
      오른쪽 위 <strong>&lsquo;⋯&rsquo;</strong> 메뉴에서{" "}
      <strong>&lsquo;다른 브라우저로 열기&rsquo;</strong>를 눌러주세요.
    </div>
  );
}
