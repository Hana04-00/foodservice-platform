"use client";

import { useState } from "react";
import { ErrorBanner, Icon, Modal, rupees } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { MealType } from "@/lib/types";

export type CancelTarget =
  | { kind: "subscription"; subscription_id: number; date: string; meal_type: MealType; dish: string; amount: number }
  | { kind: "order"; order_id: number; date: string; meal_type: MealType; dish: string; amount: number };

export function CancelMealModal({
  target,
  noticeHours,
  onClose,
  onDone,
}: {
  target: CancelTarget;
  noticeHours: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      if (target.kind === "subscription") {
        await api.post(`/subscriptions/${target.subscription_id}/skip`, { date: target.date });
      } else {
        await api.del(`/orders/${target.order_id}`);
      }
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not cancel this meal");
    } finally {
      setBusy(false);
    }
  }

  const title = target.kind === "order" ? "Cancel this order?" : "Cancel this meal?";

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-ink-soft">Are you sure you want to cancel this {target.kind === "order" ? "order" : "meal"}?</p>

      <dl className="mt-4 space-y-2 rounded-xl border border-brand-100 bg-white p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-faint">Date</dt>
          <dd className="font-medium text-ink">{fmtDate(target.date)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-faint">Meal</dt>
          <dd className="flex items-center gap-1.5 font-medium capitalize text-ink">
            <Icon name={target.meal_type} className="h-4 w-4 text-brand-500" />
            {target.meal_type}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-ink-faint">Dish</dt>
          <dd className="text-right font-medium text-ink">{target.dish}</dd>
        </div>
      </dl>

      {target.kind === "subscription" ? (
        <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Icon name="clock" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Cancellation allowed up to {noticeHours} hours before meal time.</p>
            <p className="mt-1">
              You&apos;ll receive <b>{rupees(target.amount)}</b> as carry-forward credit, applied to
              your future meals.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Icon name="clock" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">
              Cancellation allowed until the same cutoff as ordering (lunch 10:00, dinner 18:00).
            </p>
            <p className="mt-1">
              You&apos;ll receive <b>{rupees(target.amount)}</b> as carry-forward credit, applied to
              your future meals.
            </p>
          </div>
        </div>
      )}

      {err && <div className="mt-3"><ErrorBanner>{err}</ErrorBanner></div>}

      <div className="mt-5 flex gap-3">
        <button className="btn-ghost flex-1" onClick={onClose} disabled={busy}>
          {target.kind === "order" ? "Keep order" : "Keep meal"}
        </button>
        <button className="btn-danger flex-1" onClick={confirm} disabled={busy}>
          {busy ? "Cancelling…" : "Confirm Cancellation"}
        </button>
      </div>
    </Modal>
  );
}
