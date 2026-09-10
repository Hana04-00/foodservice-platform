"use client";

import { useState } from "react";

export const rupees = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** Menu / order photo with graceful fallback: .png → .svg → gradient block. */
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
        className={`flex items-center justify-center bg-gradient-to-br from-curry-200 to-masala-300 text-center text-xs font-semibold text-masala-800 ${className}`}
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

export function StatusPill({ status }: { status?: string | null }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-800",
    pending: "bg-amber-100 text-amber-800",
    partial: "bg-sky-100 text-sky-800",
    unpaid: "bg-amber-100 text-amber-800",
    overdue: "bg-rose-100 text-rose-700",
    refunded: "bg-slate-200 text-slate-700",
    ordered: "bg-masala-100 text-masala-800",
    confirmed: "bg-masala-100 text-masala-800",
    preparing: "bg-amber-100 text-amber-800",
    delivered: "bg-emerald-100 text-emerald-800",
    active: "bg-emerald-100 text-emerald-800",
    paused: "bg-amber-100 text-amber-800",
    cancelled: "bg-rose-100 text-rose-700",
    inactive: "bg-slate-200 text-slate-600",
    none: "bg-slate-100 text-slate-500",
  };
  const s = status || "none";
  return <span className={`pill ${map[s] || map.none}`}>{s}</span>;
}

/** Centered overlay dialog. `wide` widens it for tables/detail views. */
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`max-h-[88vh] w-full overflow-y-auto rounded-2xl bg-cream p-5 shadow-card ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-chai">{title}</h2>
          <button className="text-2xl leading-none" onClick={onClose}>
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

/** Simple prev / next pager. Hidden when everything fits on one page. */
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
    <div className="flex items-center justify-between text-sm text-chai/70">
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
