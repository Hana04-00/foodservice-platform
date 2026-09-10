"use client";

import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { ErrorBanner, Field, Spinner, StatCard } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import type { TotalMealsResponse } from "@/lib/types";

function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function TotalMealsPage() {
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(
    () => api.get<TotalMealsResponse>(`/admin/total-meals?date_from=${from}&date_to=${to}`),
    [from, to],
  );
  const { data, error, loading } = usePoll(load, [from, to], 20000);

  const maxTotal = useMemo(
    () => (data ? Math.max(1, ...data.days.map((d) => d.total)) : 1),
    [data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Total Meals"
        subtitle="Plates prepared per day across a date range, net of cancellations."
        action={
          <div className="flex gap-3">
            <Field label="From">
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        }
      />

      {loading && !data && <Spinner />}
      {error && !data && <ErrorBanner>{error}</ErrorBanner>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Meals" value={data.total_meals} hint={`${fmtDate(data.date_from)} – ${fmtDate(data.date_to)}`} />
            <StatCard label="Lunch Plates" value={data.total_lunch} tone="muted" />
            <StatCard label="Dinner Plates" value={data.total_dinner} tone="muted" />
            <StatCard label="Cancellations" value={data.total_cancelled} tone={data.total_cancelled > 0 ? "danger" : "brand"} />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-brand-100">
                  <th className="th">Date</th>
                  <th className="th text-right">Lunch</th>
                  <th className="th text-right">Dinner</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Cancelled</th>
                  <th className="th w-1/3">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {data.days.map((d) => (
                  <tr key={d.date}>
                    <td className="td whitespace-nowrap text-ink">
                      {d.weekday} {fmtDate(d.date)}
                    </td>
                    <td className="td text-right">{d.lunch}</td>
                    <td className="td text-right">{d.dinner}</td>
                    <td className="td text-right font-semibold text-ink">{d.total}</td>
                    <td className={`td text-right ${d.cancelled > 0 ? "text-danger-600" : ""}`}>
                      {d.cancelled || "—"}
                    </td>
                    <td className="td">
                      <div className="h-2 rounded-full bg-brand-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${(d.total / maxTotal) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {data.days.length === 0 && (
                  <tr>
                    <td colSpan={6} className="td text-center text-ink-faint">
                      No days in range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
