"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { ErrorBanner, Icon, Meter, Spinner, StatCard } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import type { MealDemandResponse } from "@/lib/types";

export default function MealDemandPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const load = useCallback(
    () => api.get<MealDemandResponse>(`/admin/meal-demand?date=${date}`),
    [date],
  );
  const { data, error, loading } = usePoll(load, [date], 15000);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meal Demand"
        subtitle="What the kitchen needs to cook — required vs confirmed, plus the per-dish prep list."
        action={
          <div>
            <label className="label">Day</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        }
      />

      {loading && !data && <Spinner />}
      {error && !data && <ErrorBanner>{error}</ErrorBanner>}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <StatCard
              label="Net Meals to Prepare"
              value={data.net_to_prepare}
              hint={`${data.weekday} ${fmtDate(data.date)} · after cancellations`}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {data.meals.map((m) => (
              <section key={m.meal_type} className="card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="inline-flex items-center gap-2 font-semibold capitalize text-brand-800">
                    <Icon name={m.meal_type} className="h-5 w-5 text-brand-500" />
                    {m.meal_type}
                  </h2>
                  <span className="text-sm text-ink-faint">capacity {m.capacity}</span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="stat-label">Required</div>
                    <div className="text-2xl font-bold text-ink">{m.required}</div>
                  </div>
                  <div>
                    <div className="stat-label">Confirmed</div>
                    <div className="text-2xl font-bold text-brand-700">{m.confirmed}</div>
                  </div>
                  <div>
                    <div className="stat-label">Gap</div>
                    <div className={`text-2xl font-bold ${m.gap > 0 ? "text-danger-600" : "text-brand-700"}`}>
                      {m.gap > 0 ? `-${m.gap}` : m.gap}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <Meter pct={m.capacity ? (m.confirmed / m.capacity) * 100 : 0} />
                  <div className="mt-1 text-xs text-ink-faint">
                    {m.confirmed} of {m.capacity} capacity confirmed
                  </div>
                </div>

                <div className="mt-5">
                  <div className="stat-label mb-2">Prep list</div>
                  <div className="divide-y divide-brand-100 rounded-xl border border-brand-100">
                    {m.prep.length === 0 && (
                      <div className="px-3 py-3 text-sm text-ink-faint">Nothing to prep.</div>
                    )}
                    {m.prep.map((p) => (
                      <div key={p.item_name} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-ink">{p.item_name}</span>
                        <span className="font-semibold text-brand-700">{p.plates}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
