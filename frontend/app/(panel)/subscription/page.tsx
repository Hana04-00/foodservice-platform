"use client";

import { useCallback, useEffect, useState } from "react";
import { CancelMealModal, type CancelTarget } from "@/components/panel/CancelMealModal";
import { PageHeader } from "@/components/panel/PanelBits";
import { EmptyState, ErrorBanner, Icon, MealImage, Spinner, StatusPill, rupees } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fmtDate, fmtDay } from "@/lib/format";
import type { SubscriptionOut } from "@/lib/types";

export default function SubscriptionPage() {
  const [subs, setSubs] = useState<SubscriptionOut[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<(CancelTarget & { key: string }) | null>(null);

  const load = useCallback(async () => {
    try {
      setSubs(await api.get<SubscriptionOut[]>("/subscriptions/me"));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load your plan");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function unskip(subId: number, date: string) {
    setBusy(`${subId}:${date}`);
    try {
      await api.del(`/subscriptions/${subId}/skip/${date}`);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not restore that day");
    } finally {
      setBusy(null);
    }
  }

  async function cancelPlan(subId: number, meal: string) {
    if (!confirm(`Cancel your ${meal} subscription? The kitchen will stop preparing this meal.`)) return;
    try {
      await api.post(`/subscriptions/${subId}/cancel`);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not cancel the plan");
    }
  }

  if (err && !subs) return <ErrorBanner>{err}</ErrorBanner>;
  if (!subs) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="My Subscription"
        subtitle="Your standing tiffin. Skip any upcoming day before its cutoff and it won't be billed."
      />

      {err && <div className="mb-4"><ErrorBanner>{err}</ErrorBanner></div>}

      {subs.length === 0 && (
        <EmptyState>
          You don&apos;t have a subscription yet. The kitchen owner sets up your daily tiffin — it
          will show up here once it&apos;s active.
        </EmptyState>
      )}

      <div className="space-y-6">
        {subs.map((s) => (
          <section key={s.id} className="card p-5">
            <div className="flex flex-wrap items-start gap-4">
              <MealImage
                src={s.image_url || "/images/hero-tiffin.svg"}
                alt={s.menu_item_name}
                className="h-20 w-20 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-lg font-bold capitalize text-brand-800">
                    <Icon name={s.meal_type} className="h-5 w-5 text-brand-500" />
                    {s.meal_type}
                  </span>
                  <StatusPill status={s.status} />
                </div>
                <div className="mt-0.5 text-sm text-ink-soft">{s.menu_item_name}</div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="stat-label">Days</dt>
                    <dd className="text-ink">{s.weekday_labels.join(" · ")}</dd>
                  </div>
                  <div>
                    <dt className="stat-label">Per plate</dt>
                    <dd className="text-ink">{rupees(s.price)}</dd>
                  </div>
                  <div>
                    <dt className="stat-label">Plates / day</dt>
                    <dd className="text-ink">{s.plates_per_day}</dd>
                  </div>
                  <div>
                    <dt className="stat-label">Started</dt>
                    <dd className="text-ink">{fmtDate(s.start_date)}</dd>
                  </div>
                </dl>
              </div>
              {s.status === "active" && (
                <button
                  className="text-xs font-semibold text-danger-600 hover:underline"
                  onClick={() => cancelPlan(s.id, s.meal_type)}
                >
                  Cancel subscription
                </button>
              )}
            </div>

            {s.status === "active" && s.schedule.length > 0 && (
              <div className="mt-5">
                <div className="stat-label mb-2">Next 14 days</div>
                <div className="divide-y divide-brand-100 overflow-hidden rounded-xl border border-brand-100">
                  {s.schedule.map((d) => (
                    <div
                      key={d.date}
                      className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                        d.skipped ? "bg-danger-50/40" : ""
                      }`}
                    >
                      <span className={d.served || d.skipped ? "text-ink" : "text-ink-faint"}>
                        {fmtDay(d.date)}
                      </span>
                      {!d.served && !d.skipped ? (
                        <span className="text-xs text-ink-faint">not scheduled</span>
                      ) : d.skipped ? (
                        d.locked ? (
                          <span className="text-xs text-ink-faint">cancelled · locked</span>
                        ) : (
                          <button
                            className="text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50"
                            disabled={busy === `${s.id}:${d.date}`}
                            onClick={() => unskip(s.id, d.date)}
                          >
                            Restore
                          </button>
                        )
                      ) : d.locked ? (
                        <span className="text-xs text-ink-faint">locked (past cutoff)</span>
                      ) : (
                        <button
                          className="text-xs font-semibold text-danger-600 hover:underline"
                          onClick={() =>
                            setCancelFor({
                              key: `${s.id}:${d.date}`,
                              subscription_id: s.id,
                              date: d.date,
                              meal_type: s.meal_type,
                              dish: s.menu_item_name,
                              amount: s.price * s.plates_per_day,
                            })
                          }
                        >
                          Cancel meal
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      {cancelFor && (
        <CancelMealModal
          target={cancelFor}
          noticeHours="4"
          onClose={() => setCancelFor(null)}
          onDone={() => {
            setCancelFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
