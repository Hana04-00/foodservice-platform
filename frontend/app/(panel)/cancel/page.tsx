"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CancelMealModal, type CancelTarget } from "@/components/panel/CancelMealModal";
import { PageHeader } from "@/components/panel/PanelBits";
import { EmptyState, ErrorBanner, Icon, Spinner, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDay } from "@/lib/format";
import type { SubscriptionOut } from "@/lib/types";

interface Row extends CancelTarget {
  weekday: string;
  locked: boolean;
  skipped: boolean;
}

export default function CancelMealsPage() {
  const [subs, setSubs] = useState<SubscriptionOut[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [target, setTarget] = useState<CancelTarget | null>(null);

  const load = useCallback(async () => {
    try {
      setSubs(await api.get<SubscriptionOut[]>("/subscriptions/me"));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load your meals");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo<Row[]>(() => {
    if (!subs) return [];
    const out: Row[] = [];
    for (const s of subs) {
      if (s.status !== "active") continue;
      for (const d of s.schedule) {
        if (!d.served && !d.skipped) continue;
        out.push({
          subscription_id: s.id,
          date: d.date,
          meal_type: s.meal_type,
          dish: s.menu_item_name,
          amount: s.price * s.plates_per_day,
          weekday: d.weekday,
          locked: d.locked,
          skipped: d.skipped,
        });
      }
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.meal_type.localeCompare(b.meal_type)));
  }, [subs]);

  if (err && !subs) return <ErrorBanner>{err}</ErrorBanner>;
  if (!subs) return <Spinner />;

  const cancellable = rows.filter((r) => !r.skipped && !r.locked);

  return (
    <div>
      <PageHeader
        title="Cancel Meals"
        subtitle="Cancel an upcoming meal before its cutoff and its value becomes carry-forward credit."
      />

      <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Icon name="clock" className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Cancellation allowed up to <b>4 hours</b> before meal time (lunch closes 10:00, dinner
          18:00). After the cutoff a meal locks and can&apos;t be cancelled.
        </p>
      </div>

      {cancellable.length === 0 && (
        <EmptyState>No upcoming meals are open for cancellation right now.</EmptyState>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={`${r.subscription_id}:${r.date}`}
            className={`card flex items-center justify-between gap-3 px-4 py-3 ${
              r.skipped ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Icon name={r.meal_type} className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium text-ink">
                  {fmtDay(r.date)} · <span className="capitalize">{r.meal_type}</span>
                </div>
                <div className="text-xs text-ink-faint">
                  {r.dish} · {rupees(r.amount)}
                </div>
              </div>
            </div>
            {r.skipped ? (
              <span className="pill bg-danger-100 text-danger-700">Cancelled</span>
            ) : r.locked ? (
              <span className="text-xs text-ink-faint">Locked</span>
            ) : (
              <button
                className="btn-danger-ghost px-3 py-1.5 text-xs"
                onClick={() =>
                  setTarget({
                    subscription_id: r.subscription_id,
                    date: r.date,
                    meal_type: r.meal_type,
                    dish: r.dish,
                    amount: r.amount,
                  })
                }
              >
                Cancel Meal
              </button>
            )}
          </div>
        ))}
      </div>

      {target && (
        <CancelMealModal
          target={target}
          noticeHours="4"
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}
