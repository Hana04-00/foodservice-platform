"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import { getRole } from "@/lib/session";
import type { Meta } from "@/lib/types";

export default function LandingPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(getRole());
    api.get<Meta>("/meta", false).then(setMeta).catch(() => {});
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="flex items-center justify-between">
        <Logo className="text-xl" />
        {role && (
          <Link
            href={role === "admin" ? "/admin" : "/subscription"}
            className="btn-ghost"
          >
            Continue as {role} →
          </Link>
        )}
      </header>

      <section className="mt-10 grid items-center gap-10 md:grid-cols-2">
        <div>
          <p className="pill bg-curry-100 text-curry-800">Fresh · Homestyle · Daily</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-chai md:text-5xl">
            Ghar ka khana,
            <br />
            <span className="text-masala-600">delivered to your desk.</span>
          </h1>
          <p className="mt-4 max-w-md text-chai/80">
            Subscribe to a daily lunch or dinner tiffin on the weekdays you choose.
            Skip any day before the cutoff, and pay one simple monthly invoice.
          </p>

          <div className="mt-8 grid max-w-md gap-3">
            <p className="label">Choose how you&apos;re signing in</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/login/customer" className="card group p-5 transition hover:-translate-y-0.5">
                <div className="text-2xl">🍱</div>
                <div className="mt-2 font-semibold text-chai">I&apos;m a Customer</div>
                <div className="text-xs text-chai/70">Phone + 4-digit PIN</div>
                <div className="mt-3 text-sm font-semibold text-masala-600 group-hover:underline">
                  Order meals →
                </div>
              </Link>
              <Link href="/login/admin" className="card group p-5 transition hover:-translate-y-0.5">
                <div className="text-2xl">👩‍🍳</div>
                <div className="mt-2 font-semibold text-chai">I&apos;m the Owner</div>
                <div className="text-xs text-chai/70">Admin dashboard</div>
                <div className="mt-3 text-sm font-semibold text-masala-600 group-hover:underline">
                  Manage kitchen →
                </div>
              </Link>
            </div>
          </div>

          <p className="mt-6 text-xs text-chai/60">
            💳 Demo payments — no real money moves. Cutoffs are enforced on the server clock.
          </p>
        </div>

        <div className="relative">
          <img
            src="/images/hero-tiffin.svg"
            alt="A spread of freshly cooked Indian tiffin dishes"
            className="w-full rounded-3xl border border-masala-100 object-cover shadow-card"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/images/hero-tiffin.png";
            }}
          />
          <div className="card absolute -bottom-5 -left-5 hidden p-4 sm:block">
            <div className="text-xs text-chai/70">Lunch cutoff</div>
            <div className="font-display text-lg font-bold text-masala-700">
              {meta?.cutoffs.lunch ?? "10:00"} AM
            </div>
          </div>
          <div className="card absolute -right-4 -top-4 hidden p-4 sm:block">
            <div className="text-xs text-chai/70">Dinner cutoff</div>
            <div className="font-display text-lg font-bold text-masala-700">
              {meta?.cutoffs.dinner ?? "18:00"}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          ["Set it once", "Pick your meals and weekdays — the kitchen cooks your plate every scheduled day."],
          ["Strict, fair cutoffs", "Lunch 10 AM, dinner 6 PM — enforced on the server clock."],
          ["One monthly invoice", "Billed only for the plates actually served. Skips never cost you."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <div className="font-semibold text-chai">{t}</div>
            <div className="mt-1 text-sm text-chai/70">{d}</div>
          </div>
        ))}
      </section>

      <footer className="mt-16 border-t border-masala-100 py-6 text-center text-xs text-chai/50">
        GharSe Tiffin · a demo build · payments simulated · placeholder food images
      </footer>
    </main>
  );
}
