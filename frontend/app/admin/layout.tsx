"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { ClockControl } from "@/components/ClockControl";
import { clearSession, getRole, getToken } from "@/lib/session";

const TABS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/payments", label: "Billing" },
  { href: "/admin/plate-report", label: "Plate Report" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken() || getRole() !== "admin") {
      router.replace("/login/admin");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-masala-100 bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo />
            <span className="pill bg-masala-100 text-masala-700">owner</span>
          </Link>
          <div className="flex items-center gap-3">
            <ClockControl />
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
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                pathname === t.href ? "bg-masala-600 text-white" : "text-chai/70 hover:bg-masala-50"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
