"use client";

import Link from "next/link";
import { useCallback } from "react";
import { CalendarLegend } from "@/components/panel/PanelBits";
import { EmptyState, ErrorBanner, Icon, Spinner, StatCard, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDay, fmtDateTime } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import type { PanelDashboard } from "@/lib/types";

const ACTIVITY_STYLE: Record<string, { icon: Parameters<typeof Icon>[0]["name"]; cls: string }> = {
  cancelled: { icon: "cancel", cls: "bg-danger-100 text-danger-600" },
  consumed: { icon: "check", cls: "bg-brand-100 text-brand-700" },
  renewed: { icon: "invoice", cls: "bg-amber-100 text-amber-700" },
};

export default function DashboardPage() {
  const load = useCallback(() => api.get<PanelDashboard>("/panel/dashboard"), []);
  const { data, error, loading } = usePoll(load, [], 20000);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBanner>{error}</ErrorBanner>;
  if (!data) return null;

  const s = data.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">
          {data.greeting}, {data.name.split(" ")[0]}!
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {data.has_subscription
            ? `Here's your meal summary for ${data.month_label}.`
            : "You don't have a subscription yet — the kitchen will set one up for you."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Meals" value={s.total_meals} hint={`${data.month_label}`} />
        <StatCard label="Meals Consumed" value={s.meals_consumed} hint="this month" />
        <StatCard label="Meals Remaining" value={s.meals_remaining} hint="this month" />
        <StatCard
          label="Carry Forward Credit"
          value={rupees(s.carry_forward_credit)}
          hint="available balance"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* upcoming meals */}
        <section className="card">
          <div className="flex items-center justify-between border-b border-brand-100 px-5 py-3.5">
            <h2 className="font-semibold text-brand-800">Upcoming Meals</h2>
            <Link href="/calendar" className="text-xs font-semibold text-brand-600 hover:underline">
              View Calendar →
            </Link>
          </div>
          <div className="divide-y divide-brand-100">
            {data.upcoming_meals.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-ink-faint">No upcoming meals.</p>
            )}
            {data.upcoming_meals.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <Icon name={m.meal_type} className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {fmtDay(m.date)} · <span className="capitalize">{m.meal_type}</span>
                    </div>
                    <div className="text-xs text-ink-faint">{m.dish}</div>
                  </div>
                </div>
                {m.status === "cancelled" ? (
                  <span className="pill bg-danger-100 text-danger-700">Cancelled</span>
                ) : (
                  <span className="pill bg-brand-50 text-brand-700">Scheduled</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* recent activity */}
        <section className="card">
          <div className="flex items-center justify-between border-b border-brand-100 px-5 py-3.5">
            <h2 className="font-semibold text-brand-800">Recent Activity</h2>
            <Link href="/history" className="text-xs font-semibold text-brand-600 hover:underline">
              View All →
            </Link>
          </div>
          <div className="divide-y divide-brand-100">
            {data.recent_activity.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-ink-faint">Nothing yet.</p>
            )}
            {data.recent_activity.map((a, i) => {
              const st = ACTIVITY_STYLE[a.type] ?? ACTIVITY_STYLE.consumed;
              return (
                <div key={i} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${st.cls}`}>
                      <Icon name={st.icon} className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm text-ink">{a.detail}</div>
                      <div className="text-xs text-ink-faint">{fmtDateTime(a.when)}</div>
                    </div>
                  </div>
                  {a.credit_impact > 0 && (
                    <span className="pill bg-brand-100 text-brand-800">+{rupees(a.credit_impact)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {!data.has_subscription && (
        <EmptyState>
          Once the kitchen activates your plan, your calendar, history and credits appear here.
        </EmptyState>
      )}

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-brand-800">Meal Calendar</h2>
          <Link href="/calendar" className="text-xs font-semibold text-brand-600 hover:underline">
            Open full calendar →
          </Link>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Your month at a glance. Open the full calendar to cancel a specific meal.
        </p>
        <div className="mt-4">
          <CalendarLegend />
        </div>
      </section>
    </div>
  );
}
