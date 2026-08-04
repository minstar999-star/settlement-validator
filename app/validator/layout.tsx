import { cookies } from "next/headers";
import { getAuthEmail, isValidSessionToken, SESSION_COOKIE } from "../lib/session";
import { LogoutButton } from "./LogoutButton";

export default async function ValidatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const authed = isValidSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  const email = authed ? getAuthEmail() : null;

  return (
    <div className="relative">
      {email && (
        <div className="absolute right-8 top-4 z-10 flex items-center gap-3 rounded-full bg-white/90 px-3 py-1.5 text-xs text-brand-gray shadow-sm">
          <span className="hidden truncate sm:inline">{email}</span>
          <LogoutButton />
        </div>
      )}
      {children}
    </div>
  );
}
