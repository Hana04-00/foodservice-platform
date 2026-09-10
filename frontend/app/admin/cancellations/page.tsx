"use client";

import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { EmptyState, ErrorBanner, Icon, Spinner, StatCard, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import type { CancellationsResponse } from "@/lib/types";

function monthAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function monthAheadISO() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function CancellationsPage() {
  const [from, setFrom] = useState(monthAgoISO());
  const [to, setTo] = useState(monthAheadISO());
  const [q, setQ] = useState("");

  const load = useCallback(
    () => api.get<CancellationsResponse>(`/admin/cancellations?date_from=${from}&date_to=${to}`),
    [from, to],
  );
  const { data, error, loading } = usePoll(load, [from, to], 15000);

  const items = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    if (!t) return data.items;
    return data.items.filter(
      (r) =>
        r.customer_name.toLowerCase().includes(t) ||
        r.customer_phone.includes(t) ||
        r.area.toLowerCase().includes(t),
    );
  }, [data, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cancellations"
        subtitle="Every cancelled meal with the exact time it was cancelled and the credit it generated."
        action={
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        }
      />

      {loading && !data && <Spinner />}
      {error && !data && <ErrorBanner>{error}</ErrorBanner>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <StatCard label="Cancellations" value={data.total} tone={data.total > 0 ? "danger" : "brand"} />
            <StatCard label="Carry-forward Credit" value={rupees(data.total_credit)} tone="muted" />
          </div>

          <div className="relative max-w-sm">
            <Icon name="search" className="absolute left-3 top-3 h-5 w-5 text-ink-faint" />
            <input
              className="input pl-10"
              placeholder="Filter by customer, phone or area"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {items.length === 0 ? (
            <EmptyState>No cancellations in this range.</EmptyState>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-brand-100">
                    <th className="th">Meal date</th>
                    <th className="th">Cancelled on</th>
                    <th className="th">Customer</th>
                    <th className="th">Area</th>
                    <th className="th">Meal</th>
                    <th className="th">Dish</th>
                    <th className="th">By</th>
                    <th className="th text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100">
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td className="td whitespace-nowrap text-ink">
                        {r.weekday} {fmtDate(r.meal_date)}
                      </td>
                      <td className="td whitespace-nowrap">
                        {r.cancelled_at ? fmtDateTime(r.cancelled_at) : "—"}
                      </td>
                      <td className="td">
                        <div className="font-medium text-ink">{r.customer_name}</div>
                        <div className="text-[11px] text-ink-faint">{r.customer_phone}</div>
                      </td>
                      <td className="td">{r.area}</td>
                      <td className="td">
                        <span className="inline-flex items-center gap-1.5 capitalize text-ink">
                          <Icon name={r.meal_type} className="h-4 w-4 text-brand-500" />
                          {r.meal_type}
                        </span>
                      </td>
                      <td className="td text-ink">{r.dish}</td>
                      <td className="td capitalize">{r.cancelled_by}</td>
                      <td className="td text-right font-semibold text-brand-700">+{rupees(r.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
