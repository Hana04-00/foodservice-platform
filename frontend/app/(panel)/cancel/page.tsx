"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CancelMealModal, type CancelTarget } from "@/components/panel/CancelMealModal";
import { PageHeader } from "@/components/panel/PanelBits";
import { EmptyState, ErrorBanner, Icon, Spinner, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDay, todayISO } from "@/lib/format";
import type { AdHocOrder, MealSource, MealType, SubscriptionOut } from "@/lib/types";

interface Row {
  key: string;
  source: MealSource;
  date: string;
  meal_type: MealType;
  dish: string;
  amount: number;
  locked: boolean;
  cancelled: boolean;
  nonCancellableReason?: string;
  target: CancelTarget;
}

export default function CancelMealsPage() {
  const [subs, setSubs] = useState<SubscriptionOut[] | null>(null);
  const [orders, setOrders] = useState<AdHocOrder[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [target, setTarget] = useState<CancelTarget | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([
        api.get<SubscriptionOut[]>("/subscriptions/me"),
        api.get<AdHocOrder[]>("/orders"),
      ]);
      setSubs(s);
      setOrders(o);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load your meals");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const s of subs || []) {
      if (s.status !== "active") continue;
      for (const d of s.schedule) {
        if (!d.served && !d.skipped) continue;
        out.push({
          key: `sub:${s.id}:${d.date}`,
          source: "subscription",
          date: d.date,
          meal_type: s.meal_type,
          dish: s.menu_item_name,
          amount: s.price * s.plates_per_day,
          locked: d.locked,
          cancelled: d.skipped,
          target: {
            kind: "subscription",
            subscription_id: s.id,
            date: d.date,
            meal_type: s.meal_type,
            dish: s.menu_item_name,
            amount: s.price * s.plates_per_day,
          },
        });
      }
    }
    const today = todayISO();
    for (const o of orders || []) {
      if (o.date < today) continue;
      out.push({
        key: `order:${o.id}`,
        source: "order",
        date: o.date,
        meal_type: o.meal_type,
        dish: o.summary,
        amount: o.amount,
        locked: false,
        cancelled: o.status === "cancelled",
        nonCancellableReason: o.status === "delivered" ? "Delivered" : undefined,
        target: {
          kind: "order",
          order_id: o.id,
          date: o.date,
          meal_type: o.meal_type,
          dish: o.summary,
          amount: o.amount,
        },
      });
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.meal_type.localeCompare(b.meal_type)));
  }, [subs, orders]);

  if (err && !subs) return <ErrorBanner>{err}</ErrorBanner>;
  if (!subs || !orders) return <Spinner />;

  const cancellable = rows.filter((r) => !r.cancelled && !r.locked && !r.nonCancellableReason);

  return (
    <div>
      <PageHeader
        title="Cancel Meals"
        subtitle="Cancel an upcoming subscription meal or one-off order before its cutoff."
      />

      <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Icon name="clock" className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Cancellation allowed up to <b>4 hours</b> before meal time (lunch closes 10:00, dinner
          18:00). After the cutoff a meal locks and can&apos;t be cancelled. Subscription meals earn
          carry-forward credit when cancelled; one-off orders don&apos;t (you simply aren&apos;t
          charged).
        </p>
      </div>

      {cancellable.length === 0 && (
        <EmptyState>No upcoming meals are open for cancellation right now.</EmptyState>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className={`card flex items-center justify-between gap-3 px-4 py-3 ${
              r.cancelled ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Icon name={r.meal_type} className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium text-ink">
                  {fmtDay(r.date)} · <span className="capitalize">{r.meal_type}</span>
                  {r.source === "order" && (
                    <span className="pill ml-1.5 bg-purple-50 text-purple-700">One-off</span>
                  )}
                </div>
                <div className="text-xs text-ink-faint">
                  {r.dish} · {rupees(r.amount)}
                </div>
              </div>
            </div>
            {r.cancelled ? (
              <span className="pill bg-danger-100 text-danger-700">Cancelled</span>
            ) : r.nonCancellableReason ? (
              <span className="text-xs text-ink-faint">{r.nonCancellableReason}</span>
            ) : r.locked ? (
              <span className="text-xs text-ink-faint">Locked</span>
            ) : (
              <button
                className="btn-danger-ghost px-3 py-1.5 text-xs"
                onClick={() => setTarget(r.target)}
              >
                {r.source === "order" ? "Cancel Order" : "Cancel Meal"}
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
