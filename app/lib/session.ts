import { createHmac, timingSafeEqual } from "crypto";

/** 로그인 세션 쿠키 이름 */
export const SESSION_COOKIE = "auth_session";

/**
 * 계정이 하나뿐인 도구라 별도 DB 없이, env의 이메일·비밀번호로 서명한 값을
 * 쿠키로 쓴다. 비밀번호를 모르면 이 값을 다시 만들 수 없다.
 */
export function createSessionToken(email: string): string | null {
  const password = process.env.AUTH_PASSWORD;
  if (!password) return null;
  return createHmac("sha256", password).update(email).digest("hex");
}

/** 로그인한 계정의 이메일 (env에 설정된 그 계정 하나뿐이다) */
export function getAuthEmail(): string | null {
  return process.env.AUTH_EMAIL ?? null;
}

/** 요청에 담긴 세션 쿠키가 유효한지 확인한다 */
export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const email = getAuthEmail();
  const expected = email ? createSessionToken(email) : null;
  if (!expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
