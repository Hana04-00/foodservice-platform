"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Modal, rupees } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { AdHocOrder, MealType, MenuItem } from "@/lib/types";

interface CustomerOpt {
  id: number;
  name: string;
  phone: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Create an admin ad-hoc order. If `customer` is given the picker is locked. */
export function OrderModal({
  customer,
  onClose,
  onSaved,
}: {
  customer?: CustomerOpt;
  onClose: () => void;
  onSaved: (o: AdHocOrder) => void;
}) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [userId, setUserId] = useState<string>(customer ? String(customer.id) : "");
  const [date, setDate] = useState(todayISO());
  const [meal, setMeal] = useState<MealType>("lunch");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ menu_item_id: string; qty: string }[]>([
    { menu_item_id: "", qty: "1" },
  ]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<MenuItem[]>("/menu", false).then(setMenu).catch(() => {});
    if (!customer) {
      api
        .get<{ items: CustomerOpt[] }>("/admin/customers?page_size=200")
        .then((d) => setCustomers(d.items))
        .catch(() => {});
    }
  }, [customer]);

  const items = useMemo(() => menu.filter((m) => m.meal_type === meal && m.is_active), [menu, meal]);
  const total = useMemo(
    () =>
      lines.reduce((s, l) => {
        const it = items.find((i) => String(i.id) === l.menu_item_id);
        return s + (it ? it.price * (Number(l.qty) || 0) : 0);
      }, 0),
    [lines, items],
  );

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        user_id: Number(userId),
        date,
        meal_type: meal,
        notes,
        items: lines
          .filter((l) => l.menu_item_id && Number(l.qty) > 0)
          .map((l) => ({ menu_item_id: Number(l.menu_item_id), qty: Number(l.qty) })),
      };
      if (!payload.user_id || payload.items.length === 0) {
        setErr("Pick a customer and at least one item.");
        setBusy(false);
        return;
      }
      const created = await api.post<AdHocOrder>("/admin/orders", payload);
      onSaved(created);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not create order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New order" onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Customer">
          {customer ? (
            <div className="input bg-masala-50">{customer.name} · {customer.phone}</div>
          ) : (
            <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Meal">
            <select
              className="input"
              value={meal}
              onChange={(e) => {
                setMeal(e.target.value as MealType);
                setLines([{ menu_item_id: "", qty: "1" }]);
              }}
            >
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </Field>
        </div>

        <div>
          <label className="label">Items</label>
          <div className="grid gap-2">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <select
                  className="input flex-1"
                  value={l.menu_item_id}
                  onChange={(e) =>
                    setLines((x) => x.map((y, j) => (j === i ? { ...y, menu_item_id: e.target.value } : y)))
                  }
                >
                  <option value="">Item…</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} · ₹{it.price}
                    </option>
                  ))}
                </select>
                <input
                  className="input w-16"
                  inputMode="numeric"
                  value={l.qty}
                  onChange={(e) =>
                    setLines((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))
                  }
                />
                <button
                  className="text-xl leading-none text-chai/40 hover:text-rose-600"
                  onClick={() => setLines((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : x))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            className="mt-2 text-xs font-semibold text-masala-600 hover:underline"
            onClick={() => setLines((x) => [...x, { menu_item_id: "", qty: "1" }])}
          >
            + Add line
          </button>
        </div>

        <Field label="Notes (optional)">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-chai/70">Total</span>
          <span className="font-display text-xl font-bold text-chai">{rupees(total)}</span>
        </div>

        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Create order"}
        </button>
      </div>
    </Modal>
  );
}
