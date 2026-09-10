"use client";

import { useCallback, useEffect, useState } from "react";
import { AddressCard } from "@/components/AddressCard";
import { MealImage, StatusPill, rupees } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { ScheduleDay, SubscriptionOut } from "@/lib/types";

const dayLabel = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export default function SubscriptionPage() {
  const [subs, setSubs] = useState<SubscriptionOut[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setSubs(await api.get<SubscriptionOut[]>("/subscriptions/me"));
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function skip(subId: number, date: string, undo: boolean) {
    setBusy(`${subId}:${date}`);
    setErr(null);
    try {
      if (undo) await api.del(`/subscriptions/${subId}/skip/${date}`);
      else await api.post(`/subscriptions/${subId}/skip`, { date });
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not update that day");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(subId: number) {
    if (!confirm("Cancel this subscription? The kitchen will stop preparing this meal.")) return;
    setErr(null);
    try {
      await api.post(`/subscriptions/${subId}/cancel`);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not cancel");
    }
  }

  function dayState(subId: number, d: ScheduleDay) {
    if (!d.served && !d.skipped)
      return <span className="text-[11px] text-chai/40">not scheduled</span>;
    if (d.skipped)
      return d.locked ? (
        <span className="text-[11px] text-chai/40">skipped · locked</span>
      ) : (
        <button
          className="text-xs font-semibold text-masala-600 hover:underline disabled:opacity-50"
          disabled={busy === `${subId}:${d.date}`}
          onClick={() => skip(subId, d.date, true)}
        >
          Un-skip
        </button>
      );
    return d.locked ? (
      <span className="text-[11px] text-chai/40">locked (past cutoff)</span>
    ) : (
      <button
        className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
        disabled={busy === `${subId}:${d.date}`}
        onClick={() => skip(subId, d.date, false)}
      >
        Skip
      </button>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-chai">My plan</h1>
          <p className="text-sm text-chai/70">
            Your standing tiffin. Skip any upcoming day before its cutoff (lunch 10:00,
            dinner 18:00) and you won&apos;t be billed for it.
          </p>
        </div>

        {err && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
        )}

        {subs.length === 0 && (
          <div className="card p-6 text-sm text-chai/70">
            You don&apos;t have a subscription yet. The kitchen owner sets up your daily
            tiffin — get in touch and it&apos;ll show up here.
          </div>
        )}

        {subs.map((s) => (
          <section key={s.id} className="card p-4">
            <div className="flex items-start gap-3">
              <MealImage
                src={s.image_url || "/images/hero-tiffin.svg"}
                alt={s.menu_item_name}
                className="h-16 w-16 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold capitalize text-chai">{s.meal_type}</span>
                  <StatusPill status={s.status} />
                </div>
                <div className="text-sm text-chai/70">{s.menu_item_name}</div>
                <div className="mt-1 text-xs text-chai/60">
                  {s.weekday_labels.join(" · ")} · {rupees(s.price)} per plate
                </div>
                <div className="text-xs text-chai/50">
                  From {dayLabel(s.start_date)}
                  {s.end_date ? ` until ${dayLabel(s.end_date)}` : ""}
                </div>
              </div>
              {s.status === "active" && (
                <button
                  className="shrink-0 text-xs font-semibold text-rose-600 hover:underline"
                  onClick={() => cancel(s.id)}
                >
                  Cancel plan
                </button>
              )}
            </div>

            {s.status === "active" && s.schedule.length > 0 && (
              <div className="mt-4">
                <p className="label">Next 14 days</p>
                <div className="divide-y divide-masala-100 rounded-xl border border-masala-100">
                  {s.schedule.map((d) => (
                    <div
                      key={d.date}
                      className={`flex items-center justify-between px-3 py-2 text-sm ${
                        d.skipped ? "bg-masala-50/50" : ""
                      }`}
                    >
                      <span className={d.served ? "text-chai" : "text-chai/45"}>
                        {dayLabel(d.date)}
                      </span>
                      {dayState(s.id, d)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <AddressCard onSaved={() => load()} />
        <div className="card p-4 text-xs text-chai/60">
          <p className="font-semibold text-chai">How your plan works</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>The kitchen prepares your plate on every scheduled weekday.</li>
            <li>Skip a day before its cutoff to drop it from your bill.</li>
            <li>Billing is a monthly invoice for the plates actually served.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
