"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/ui";
import { clearSession } from "@/lib/session";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  count?: number;
}

export function PanelShell({
  nav,
  badge,
  children,
  footer,
}: {
  nav: NavItem[];
  badge?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // longest matching href wins, so "/admin" doesn't stay lit on "/admin/customers"
  const activeHref = nav
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const isActive = (href: string) => href === activeHref;

  function logout() {
    clearSession();
    router.replace("/");
  }

  const navList = (
    <nav className="flex flex-1 flex-col gap-1">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          className={`sidebar-link ${isActive(item.href) ? "sidebar-link-active" : ""}`}
        >
          <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1 truncate">{item.label}</span>
          {!!item.count && (
            <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-danger-500 px-1.5 text-[11px] font-semibold text-white">
              {item.count > 99 ? "99+" : item.count}
            </span>
          )}
        </Link>
      ))}
      <button onClick={logout} className="sidebar-link mt-1 text-left">
        <Icon name="logout" className="h-[18px] w-[18px] shrink-0" />
        <span>Logout</span>
      </button>
      {footer && <div className="mt-auto pt-4">{footer}</div>}
    </nav>
  );

  return (
    <div className="min-h-screen bg-cream-100 lg:flex">
      {/* desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col gap-6 bg-brand-800 px-4 py-6 lg:flex lg:sticky lg:top-0 lg:h-screen">
        <Link href="/" className="px-2">
          <Logo tone="light" className="text-lg" />
          {badge && (
            <span className="mt-1 block px-0 text-[11px] font-semibold uppercase tracking-widest text-brand-200">
              {badge}
            </span>
          )}
        </Link>
        {navList}
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-brand-800 px-4 py-3 lg:hidden">
        <Link href="/">
          <Logo tone="light" className="text-base" />
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-white hover:bg-white/10"
          aria-label="Menu"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d={open ? "M6 6l12 12M6 18L18 6" : "M4 7h16M4 12h16M4 17h16"} strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink/40" />
          <aside
            className="absolute left-0 top-0 flex h-full w-72 flex-col gap-6 bg-brand-800 px-4 py-6"
            onClick={(e) => e.stopPropagation()}
          >
            <Logo tone="light" className="px-2 text-lg" />
            {navList}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
