"use client";

import Link from "next/link";
import { Icon, MealImage, rupees } from "@/components/ui";
import { useSiteSettings } from "@/lib/hooks";
import type { Plan } from "@/lib/types";
import { DEFAULT_WA_MESSAGE, waLink } from "@/lib/wa";

export function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`mx-auto max-w-6xl px-4 py-14 sm:px-6 ${className}`}>
      {children}
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
  center = true,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-500">{eyebrow}</div>
      )}
      <h2 className="mt-2 text-3xl font-bold text-brand-800">{title}</h2>
      {sub && <p className="mt-3 text-ink-soft">{sub}</p>}
    </div>
  );
}

export function TrustIcon({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <Icon name={icon as never} className="h-7 w-7" />
      </div>
      <div className="text-sm font-semibold text-brand-800">{label}</div>
    </div>
  );
}

export function MealCard({
  slug,
  name,
  price,
}: {
  slug: string;
  name: string;
  price: number;
}) {
  return (
    <div className="card overflow-hidden">
      <MealImage src={`/images/${slug}.svg`} alt={name} className="h-40 w-full object-cover" />
      <div className="p-4">
        <div className="font-semibold text-brand-800">{name}</div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm text-ink-soft">{rupees(price)} / plate</span>
          <Link href="/menu" className="text-sm font-semibold text-brand-600 hover:underline">
            View Full Menu →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PlanCard({ plan }: { plan: Plan }) {
  const settings = useSiteSettings();
  const featured = plan.badge.toLowerCase().includes("popular");
  const wa = waLink(
    settings.whatsapp_number,
    `Hi Food Dose Tiffin Service! I'd like to start the ${plan.name} plan.`,
  );
  return (
    <div
      className={`card relative flex flex-col p-6 ${
        featured ? "border-brand-500 ring-1 ring-brand-500" : ""
      }`}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
          {plan.badge}
        </span>
      )}
      <div className="text-lg font-bold text-brand-800">{plan.name}</div>
      <div className="mt-1 text-sm capitalize text-ink-faint">{plan.meal_type} meals</div>
      <div className="mt-4 flex items-end gap-1">
        <span className="text-4xl font-bold text-brand-700">{rupees(plan.price)}</span>
        <span className="pb-1 text-sm text-ink-faint">/ month</span>
      </div>
      <div className="mt-1 text-sm text-ink-soft">
        {plan.meals_per_month} meals · {rupees(plan.price_per_meal)} per meal
      </div>
      <p className="mt-4 flex-1 text-sm text-ink-soft">{plan.description}</p>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-6 ${featured ? "btn-primary" : "btn-ghost"} w-full`}
      >
        Choose Plan
      </a>
    </div>
  );
}

export function ChatButton({
  className = "btn-ghost",
  label = "Chat on WhatsApp",
  message = DEFAULT_WA_MESSAGE,
}: {
  className?: string;
  label?: string;
  message?: string;
}) {
  const settings = useSiteSettings();
  return (
    <a
      href={waLink(settings.whatsapp_number, message)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <Icon name="whatsapp" className="h-4 w-4" />
      {label}
    </a>
  );
}
