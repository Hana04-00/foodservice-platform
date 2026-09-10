"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/ui";
import { useSiteSettings } from "@/lib/hooks";
import { DEFAULT_WA_MESSAGE, waLink } from "@/lib/wa";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/plans", label: "Plans" },
  { href: "/about", label: "About" },
  { href: "/areas", label: "Areas We Serve" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const settings = useSiteSettings();
  const [open, setOpen] = useState(false);
  const wa = waLink(settings.whatsapp_number, DEFAULT_WA_MESSAGE);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-cream-100/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex flex-col leading-tight">
          <Logo className="text-lg" />
          <span className="pl-8 text-[11px] font-medium text-ink-faint">{settings.tagline}</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isActive(l.href) ? "bg-brand-100 text-brand-800" : "text-ink-soft hover:bg-brand-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 sm:inline-flex"
          >
            <Icon name="whatsapp" className="h-4 w-4" />
            Enquire on WhatsApp
          </a>
          <Link href="/login/customer" className="hidden text-sm font-semibold text-brand-700 hover:underline sm:inline">
            Log in
          </Link>
          <button
            className="rounded-lg p-2 text-brand-800 hover:bg-brand-50 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d={open ? "M6 6l12 12M6 18L18 6" : "M4 7h16M4 12h16M4 17h16"} strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-brand-100 bg-cream-50 px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive(l.href) ? "bg-brand-100 text-brand-800" : "text-ink-soft"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
            >
              <Icon name="whatsapp" className="h-4 w-4" />
              Enquire on WhatsApp
            </a>
            <Link href="/login/customer" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700">
              Log in
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const settings = useSiteSettings();
  return (
    <footer className="mt-20 border-t border-brand-100 bg-brand-800 text-brand-100">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo tone="light" className="text-lg" />
          <p className="mt-3 max-w-sm text-sm text-brand-200">{settings.tagline}</p>
          <p className="mt-2 text-sm text-brand-200">{settings.service_hours}</p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-300">Explore</div>
          <ul className="mt-3 space-y-2 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-300">Get in touch</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li>{settings.contact_phone}</li>
            <li>{settings.contact_email}</li>
            <li>
              <Link href="/login/admin" className="hover:text-white">
                Kitchen owner login
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-brand-300">
        © {new Date().getFullYear()} {settings.business_name}. Home-style cooking, hygienic kitchen, no preservatives.
      </div>
    </footer>
  );
}

export function WhatsAppFab() {
  const settings = useSiteSettings();
  return (
    <a
      href={waLink(settings.whatsapp_number, DEFAULT_WA_MESSAGE)}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-card hover:bg-brand-700 sm:hidden"
      aria-label="Enquire on WhatsApp"
    >
      <Icon name="whatsapp" className="h-5 w-5" />
      WhatsApp
    </a>
  );
}
