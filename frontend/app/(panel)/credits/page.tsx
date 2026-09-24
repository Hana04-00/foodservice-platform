"use client";

import { useCallback } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { EmptyState, ErrorBanner, Icon, Spinner, StatCard, StatusPill, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import type { CreditsResponse } from "@/lib/types";

export default function CreditsPage() {
  const load = useCallback(() => api.get<CreditsResponse>("/panel/credits"), []);
  const { data, error, loading } = usePoll(load, [], 20000);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBanner>{error}</ErrorBanner>;
  if (!data) return null;

  return (
    <div>
      <PageHeader
        title="Credits & Carry Forward"
        subtitle="Every meal you cancel before its cutoff is credited here and carried forward to future meals."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Available Balance" value={rupees(data.balance)} hint="carried forward" />
        <StatCard label="Total Earned" value={rupees(data.total_earned)} hint="all time" tone="muted" />
        <StatCard label="Credit Entries" value={data.count} tone="muted" />
      </div>

      <div className="mt-6 flex gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800">
        <Icon name="credit" className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <p>
          Credit is applied automatically against your upcoming meals and monthly invoice. There is
          nothing to redeem — the balance simply reduces what you pay next.
        </p>
      </div>

      {data.items.length === 0 ? (
        <div className="mt-6">
          <EmptyState>No credits yet. Cancel a meal before its cutoff to earn carry-forward credit.</EmptyState>
        </div>
      ) : (
        <div className="mt-6 card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className="th">Issued</th>
                <th className="th">Meal cancelled</th>
                <th className="th">Reason</th>
                <th className="th">Status</th>
                <th className="th text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td className="td whitespace-nowrap">{c.issued_on ? fmtDateTime(c.issued_on) : "—"}</td>
                  <td className="td">
                    <span className="inline-flex items-center gap-1.5 capitalize text-ink">
                      <Icon name={c.meal_type} className="h-4 w-4 text-brand-500" />
                      {c.meal_type} · {fmtDate(c.meal_date)}
                    </span>
                    {c.source === "order" && (
                      <span className="pill ml-1.5 bg-purple-50 text-purple-700">One-off</span>
                    )}
                    <div className="mt-0.5 text-[11px] text-ink-faint">{c.note}</div>
                  </td>
                  <td className="td capitalize">{c.reason}</td>
                  <td className="td">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="td text-right font-semibold text-brand-700">+{rupees(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
