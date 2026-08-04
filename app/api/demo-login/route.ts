import { NextResponse } from "next/server";
import { createSessionToken, getAuthEmail, SESSION_COOKIE } from "../../lib/session";

const SESSION_MAX_AGE = 60 * 60 * 24; // 체험 입장은 1일만 유지

/**
 * 시연용 무료 입장 — 비밀번호 확인 없이 누구나 눌러서 들어올 수 있게 한다.
 * (사용자 요청: "로그인은 그냥 버튼 누르면 다 들어갈 수 있게")
 */
export async function POST() {
  const authEmail = getAuthEmail();
  if (!authEmail) {
    return NextResponse.json(
      { error: "서버에 로그인 계정이 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  const token = createSessionToken(authEmail);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token!, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
