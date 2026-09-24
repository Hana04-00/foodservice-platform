"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { EmptyState, ErrorBanner, Field, Icon, MealImage, Spinner, StatusPill, rupees } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fmtDay, todayISO } from "@/lib/format";
import type { AdHocOrder, MealType, MenuItem } from "@/lib/types";

export default function PlaceOrderPage() {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [orders, setOrders] = useState<AdHocOrder[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [date, setDate] = useState(todayISO());
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loadOrders = useCallback(() => api.get<AdHocOrder[]>("/orders"), []);

  useEffect(() => {
    Promise.all([api.get<MenuItem[]>("/menu", false), loadOrders()])
      .then(([m, o]) => {
        setMenu(Array.isArray(m) ? m : []);
        setOrders(o);
      })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : "Could not load the menu"));
  }, [loadOrders]);

  const itemsForMeal = useMemo(
    () => (menu || []).filter((m) => m.meal_type === mealType && m.is_active),
    [menu, mealType],
  );

  useEffect(() => {
    if (itemsForMeal.length && !itemsForMeal.some((m) => String(m.id) === itemId)) {
      setItemId(String(itemsForMeal[0].id));
    }
  }, [itemsForMeal, itemId]);

  const selected = itemsForMeal.find((m) => String(m.id) === itemId);

  async function submit() {
    if (!itemId) {
      setErr("Pick a dish first.");
      return;
    }
    setBusy(true);
    setErr(null);
    setDone(false);
    try {
      await api.post("/orders", {
        date,
        meal_type: mealType,
        menu_item_id: Number(itemId),
        qty,
        notes: notes.trim() || undefined,
      });
      setDone(true);
      setNotes("");
      setQty(1);
      setOrders(await loadOrders());
      setTimeout(() => setDone(false), 3000);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not place your order. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loadErr) return <ErrorBanner>{loadErr}</ErrorBanner>;
  if (!menu || !orders) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Place an Order"
        subtitle="A one-off plate outside your subscription — pick a date, a meal and a dish."
      />

      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Date">
          <input
            type="date"
            className="input"
            min={todayISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Meal">
          <div className="flex gap-2">
            {(["lunch", "dinner"] as MealType[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMealType(m)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition ${
                  mealType === m
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-brand-100 text-ink-soft hover:bg-brand-50"
                }`}
              >
                <Icon name={m} className="mr-1.5 inline h-4 w-4" />
                {m}
              </button>
            ))}
          </div>
        </Field>

        <div className="sm:col-span-2">
          <label className="label">Dish</label>
          {itemsForMeal.length === 0 ? (
            <p className="text-sm text-ink-faint">No {mealType} items are available right now.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {itemsForMeal.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setItemId(String(m.id))}
                  className={`card flex items-center gap-3 overflow-hidden p-2 text-left transition ${
                    String(m.id) === itemId ? "ring-2 ring-brand-500" : ""
                  }`}
                >
                  <MealImage src={m.image_url} alt={m.name} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-brand-800">{m.name}</div>
                    <div className="text-xs text-ink-faint">{rupees(m.price)} / plate</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Field label="Plates">
          <input
            className="input"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value.replace(/\D/g, "")) || 1)))}
          />
        </Field>
        <Field label="Notes (optional)">
          <input
            className="input"
            placeholder="e.g. extra spicy, guests over"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
          />
        </Field>

        {selected && (
          <div className="sm:col-span-2 text-sm text-ink-soft">
            Total: <span className="font-semibold text-brand-700">{rupees(selected.price * qty)}</span>
          </div>
        )}

        {err && (
          <div className="sm:col-span-2">
            <ErrorBanner>{err}</ErrorBanner>
          </div>
        )}
        {done && (
          <div className="sm:col-span-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
            Order placed! It&apos;ll show up in your orders below and with the kitchen right away.
          </div>
        )}

        <div className="sm:col-span-2">
          <button className="btn-primary" onClick={submit} disabled={busy || itemsForMeal.length === 0}>
            {busy ? "Placing order…" : "Place order"}
          </button>
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-semibold text-brand-800">Your Orders</h2>
        {orders.length === 0 ? (
          <EmptyState>No orders yet — place one above.</EmptyState>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-brand-100">
                  <th className="th">Date</th>
                  <th className="th">Meal</th>
                  <th className="th">Order</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="td">{fmtDay(o.date)}</td>
                    <td className="td capitalize">{o.meal_type}</td>
                    <td className="td text-ink-soft">{o.summary}</td>
                    <td className="td text-right font-semibold text-ink">{rupees(o.amount)}</td>
                    <td className="td">
                      <StatusPill status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
