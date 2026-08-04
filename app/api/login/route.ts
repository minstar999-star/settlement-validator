import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getAuthEmail, SESSION_COOKIE } from "../../lib/session";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7일

export async function POST(req: NextRequest) {
  const authEmail = getAuthEmail();
  const authPassword = process.env.AUTH_PASSWORD;
  if (!authEmail || !authPassword) {
    return NextResponse.json(
      { error: "서버에 로그인 계정이 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const ok =
    email.toLowerCase() === authEmail.toLowerCase() && password === authPassword;

  if (!ok) {
    return NextResponse.json(
      { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
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
