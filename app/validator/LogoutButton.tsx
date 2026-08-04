"use client";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-brand-gray transition-colors hover:border-brand-red hover:text-brand-red"
    >
      로그아웃
    </button>
  );
}
