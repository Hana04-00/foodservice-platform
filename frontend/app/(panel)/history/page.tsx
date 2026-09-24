"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { EmptyState, ErrorBanner, Icon, Spinner, StatusPill, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import type { MealHistoryResponse } from "@/lib/types";

const TABS = [
  { key: "all", label: "All" },
  { key: "consumed", label: "Consumed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "credits", label: "Credits" },
] as const;

export default function HistoryPage() {
  const [filter, setFilter] = useState<(typeof TABS)[number]["key"]>("all");
  const load = useCallback(
    () => api.get<MealHistoryResponse>(`/panel/meals/history?filter=${filter}`),
    [filter],
  );
  const { data, error, loading } = usePoll(load, [filter], 20000);

  return (
    <div>
      <PageHeader
        title="Meal History"
        subtitle="Every meal on your plan — served, cancelled, and the credit each cancellation earned."
      />

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-brand-50 p-1 text-sm font-semibold">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`rounded-lg px-3 py-1.5 transition ${
              filter === t.key ? "bg-white text-brand-700 shadow-soft" : "text-ink-faint"
            }`}
          >
            {t.label}
            {data && (
              <span className="ml-1.5 text-xs text-ink-faint">{data.counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {loading && !data && <Spinner />}
      {error && !data && <ErrorBanner>{error}</ErrorBanner>}

      {data && data.items.length === 0 && <EmptyState>No records in this view.</EmptyState>}

      {data && data.items.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className="th">Date</th>
                <th className="th">Meal</th>
                <th className="th">Order details / dish</th>
                <th className="th">Order date</th>
                <th className="th">Start date</th>
                <th className="th">Amount</th>
                <th className="th">Status</th>
                <th className="th text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {data.items.map((r, i) => (
                <tr key={i}>
                  <td className="td whitespace-nowrap text-ink">
                    {r.weekday} {fmtDate(r.date)}
                  </td>
                  <td className="td">
                    <span className="inline-flex items-center gap-1.5 capitalize text-ink">
                      <Icon name={r.meal_type} className="h-4 w-4 text-brand-500" />
                      {r.meal_type}
                    </span>
                  </td>
                  <td className="td text-ink">
                    {r.dish}
                    {r.source === "order" && (
                      <span className="pill ml-1.5 bg-purple-50 text-purple-700">One-off</span>
                    )}
                  </td>
                  <td className="td whitespace-nowrap">{fmtDate(r.order_date)}</td>
                  <td className="td whitespace-nowrap">{fmtDate(r.start_date)}</td>
                  <td className="td whitespace-nowrap text-ink">{rupees(r.amount)}</td>
                  <td className="td">
                    <StatusPill status={r.status} />
                    {r.status === "cancelled" && r.cancelled_at && (
                      <div className="mt-1 text-[11px] text-ink-faint">
                        cancelled {fmtDateTime(r.cancelled_at)}
                      </div>
                    )}
                  </td>
                  <td className="td text-right font-semibold">
                    {r.credit > 0 ? (
                      <span className="text-brand-700">+{rupees(r.credit)}</span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
