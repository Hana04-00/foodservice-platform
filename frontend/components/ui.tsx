"use client";

import { useState } from "react";
import { rupees } from "@/lib/format";

export { rupees };

/* ------------------------------------------------------------------ icons */
type IconName =
  | "dashboard"
  | "subscription"
  | "calendar"
  | "history"
  | "cancel"
  | "credit"
  | "profile"
  | "invoice"
  | "logout"
  | "customers"
  | "meals"
  | "demand"
  | "area"
  | "settings"
  | "lunch"
  | "dinner"
  | "check"
  | "clock"
  | "leaf"
  | "sparkle"
  | "shield"
  | "home"
  | "whatsapp"
  | "search"
  | "download"
  | "chevron-left"
  | "chevron-right";

const PATHS: Record<IconName, string> = {
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z",
  subscription: "M4 7h16M4 12h16M4 17h10",
  calendar:
    "M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  history: "M3 12a9 9 0 1 0 9-9 9 9 0 0 0-8 5m-1-5v5h5M12 7v5l3 3",
  cancel: "M18 6 6 18M6 6l12 12",
  credit:
    "M3 7h18v10H3zM3 11h18M7 15h4",
  profile:
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  invoice:
    "M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6",
  logout: "M15 12H4m0 0 4-4m-4 4 4 4M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4",
  customers:
    "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 0a3 3 0 1 0 0-6M3 20a6 6 0 0 1 12 0m2 0a5 5 0 0 0-4-4.9",
  meals: "M4 11h16M4 11a8 8 0 0 1 16 0M6 15h12l-1 5H7l-1-5Z",
  demand: "M4 19h16M7 19V9m5 10V5m5 14v-7",
  area: "M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.2-1.8l2-1.6-2-3.4-2.4 1a8 8 0 0 0-3-1.8L14 0h-4l-.4 2.6a8 8 0 0 0-3 1.8l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .6.1 1.2.2 1.8l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 3 1.8L10 24h4l.4-2.6a8 8 0 0 0 3-1.8l2.4 1 2-3.4-2-1.6c.1-.6.2-1.2.2-1.8Z",
  lunch: "M4 11h16M4 11a8 8 0 0 1 16 0M2 20h20M6 15h12",
  dinner: "M12 3v9m0 0a4 4 0 0 1-4-4V5m4 7a4 4 0 0 0 4-4V5M8 20h8",
  check: "M5 13l4 4L19 7",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  leaf: "M4 20c0-8 6-14 16-14 0 10-6 16-16 14Zm0 0c4-6 8-8 12-9",
  sparkle: "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z",
  shield: "M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6l8-3Z",
  home: "M3 11l9-8 9 8M6 10v10h12V10",
  whatsapp:
    "M20 12a8 8 0 0 1-11.9 7L4 20l1-4a8 8 0 1 1 15-4Zm-5.2 2.6c-.3.8-1.6 1.4-2.2 1.3a7 7 0 0 1-3.2-1.7 7.7 7.7 0 0 1-1.6-2.2c-.3-.6 0-1.5.5-2 .2-.2.4-.2.6-.2h.4c.2 0 .3.1.4.4l.6 1.4c.1.2 0 .4-.1.5l-.3.4c-.1.1-.2.3-.1.5.2.4.6 1 1 1.4.5.4 1 .7 1.4.9.2.1.4 0 .5-.1l.4-.4c.1-.2.3-.2.5-.1l1.3.7c.2.1.3.2.3.4Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm10 3-5-5",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M5 21h14",
  "chevron-left": "M15 18l-6-6 6-6",
  "chevron-right": "M9 6l6 6-6 6",
};

export function Icon({
  name,
  className = "h-5 w-5",
  filled = false,
}: {
  name: IconName;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ------------------------------------------------------------------ stat card */
export function StatCard({
  label,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "brand" | "danger" | "muted";
}) {
  const valueTone =
    tone === "danger" ? "text-danger-600" : tone === "muted" ? "text-ink" : "text-brand-700";
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${valueTone}`}>{value}</div>
      {hint != null && <div className="mt-1 text-xs text-ink-faint">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ meal image */
export function MealImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [stage, setStage] = useState(0);
  const svg = src.replace(/\.(png|jpg|jpeg|webp)$/i, ".svg");
  const current = stage === 0 ? src : svg;
  if (stage > 1) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-300 p-2 text-center text-xs font-semibold text-brand-800 ${className}`}
      >
        {alt}
      </div>
    );
  }
  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setStage((s) => s + 1)}
    />
  );
}

/* ------------------------------------------------------------------ status pill */
const PILL_MAP: Record<string, string> = {
  paid: "bg-brand-100 text-brand-800",
  consumed: "bg-brand-100 text-brand-800",
  confirmed: "bg-brand-100 text-brand-800",
  active: "bg-brand-100 text-brand-800",
  available: "bg-brand-100 text-brand-800",
  scheduled: "bg-brand-50 text-brand-700",
  upcoming: "bg-brand-50 text-brand-700",
  pending: "bg-amber-100 text-amber-800",
  partial: "bg-amber-100 text-amber-800",
  paused: "bg-amber-100 text-amber-800",
  preparing: "bg-amber-100 text-amber-800",
  overdue: "bg-danger-100 text-danger-700",
  cancelled: "bg-danger-100 text-danger-700",
  inactive: "bg-brand-100/60 text-ink-faint",
  consumed_credit: "bg-brand-100/60 text-ink-faint",
  none: "bg-brand-100/60 text-ink-faint",
};

export function StatusPill({ status }: { status?: string | null }) {
  const s = (status || "none").toLowerCase();
  const withIcon = s === "consumed" || s === "paid" || s === "confirmed";
  return (
    <span className={`pill capitalize ${PILL_MAP[s] || PILL_MAP.none}`}>
      {withIcon && <Icon name="check" className="h-3 w-3" />}
      {s}
    </span>
  );
}

/* ------------------------------------------------------------------ modal */
export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-cream-50 p-5 shadow-card sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-brand-800">{title}</h2>
          <button
            className="-m-1 rounded-lg p-1 text-2xl leading-none text-ink-faint hover:bg-brand-50"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ misc */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="card px-6 py-10 text-center text-sm text-ink-faint">{children}</div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-ink-faint">{label}</p>;
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
      {children}
    </div>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-ink-faint">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          className="btn-ghost px-3 py-1 text-xs disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ← Prev
        </button>
        <button
          className="btn-ghost px-3 py-1 text-xs disabled:opacity-40"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/** Small horizontal progress bar for area capacity etc. */
export function Meter({ pct, tone = "brand" }: { pct: number; tone?: "brand" | "danger" }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const bar = tone === "danger" ? "bg-danger-500" : "bg-brand-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-brand-100">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function MealTypeTag({ meal }: { meal: "lunch" | "dinner" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
      <Icon name={meal} className="h-4 w-4 text-brand-500" />
      <span className="capitalize">{meal}</span>
    </span>
  );
}
