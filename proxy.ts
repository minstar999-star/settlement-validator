import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "./app/lib/session";

/**
 * /validator만 로그인 보호 대상이다. (요청 범위 — 그 외 경로는 건드리지 않는다)
 * Next.js 16부터 middleware.ts는 proxy.ts로 이름이 바뀌었다 (node_modules/next/dist/docs 확인).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/validator") && !authed) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && authed) {
    return NextResponse.redirect(new URL("/validator", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/validator/:path*", "/login"],
};
