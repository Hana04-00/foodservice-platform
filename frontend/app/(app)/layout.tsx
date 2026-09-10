"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { clearSession, getRole, getToken } from "@/lib/session";

const TABS = [
  { href: "/subscription", label: "My Plan" },
  { href: "/billing", label: "Billing" },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken() || getRole() !== "customer") {
      router.replace("/login/customer");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-masala-100 bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/subscription">
            <Logo />
          </Link>
          <nav className="hidden gap-1 sm:flex">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  pathname === t.href
                    ? "bg-masala-600 text-white"
                    : "text-chai/70 hover:bg-masala-50"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <button
            className="text-sm font-semibold text-masala-600 hover:underline"
            onClick={() => {
              clearSession();
              router.replace("/");
            }}
          >
            Log out
          </button>
        </div>
        <nav className="flex gap-1 border-t border-masala-100 px-4 py-2 sm:hidden">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold ${
                pathname === t.href ? "bg-masala-600 text-white" : "text-chai/70"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
