"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Field, StatusPill, rupees } from "@/components/ui";
import { OrderModal } from "@/components/OrderModal";
import { RecordPaymentModal } from "@/components/RecordPaymentModal";
import { api, ApiError } from "@/lib/api";
import { WEEKDAY_LABELS } from "@/lib/types";
import type {
  CustomerProfile,
  InvoiceOut,
  MealType,
  MenuItem,
  SubscriptionOut,
} from "@/lib/types";

type Tab = "overview" | "subscription" | "meals" | "orders" | "billing";
const TABS: Tab[] = ["overview", "subscription", "meals", "orders", "billing"];

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const [p, setP] = useState<CustomerProfile | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [payFor, setPayFor] = useState<InvoiceOut | null>(null);

  const load = useCallback(async () => {
    const [prof, m] = await Promise.all([
      api.get<CustomerProfile>(`/admin/customers/${id}`),
      menu.length ? Promise.resolve(menu) : api.get<MenuItem[]>("/menu", false),
    ]);
    setP(prof);
    if (!menu.length) setMenu(m as MenuItem[]);
  }, [id, menu]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function subAction(sub: SubscriptionOut, status: "paused" | "active" | "cancelled") {
    await api.patch(`/admin/subscriptions/${sub.id}`, { status });
    await load();
  }

  if (err) return <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>;
  if (!p) return <p className="text-sm text-chai/60">Loading…</p>;

  const active = p.subscriptions.filter((s) => s.status !== "cancelled");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/customers" className="text-xs font-semibold text-masala-600 hover:underline">
          ← Customers
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-chai">{p.customer.name}</h1>
        <p className="text-sm text-chai/70">
          {p.customer.phone}
          {p.customer.email ? ` · ${p.customer.email}` : ""} · joined {fmtDate(p.customer.created_at.slice(0, 10))}
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-masala-50 p-1 text-sm font-semibold">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 capitalize transition ${
              tab === t ? "bg-white text-masala-700 shadow" : "text-chai/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="font-semibold text-masala-700">Contact</h2>
            <dl className="mt-2 space-y-1 text-sm text-chai/80">
              <div className="flex justify-between"><dt className="text-chai/50">Phone</dt><dd>{p.customer.phone}</dd></div>
              <div className="flex justify-between"><dt className="text-chai/50">Email</dt><dd>{p.customer.email || "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-chai/50">Address</dt><dd className="text-right">{p.customer.address || "—"} {p.customer.pincode}</dd></div>
            </dl>
          </div>

          <div className="card p-4">
            <h2 className="font-semibold text-masala-700">Upcoming changes</h2>
            <div className="mt-2 space-y-1 text-sm">
              {p.upcoming_changes.items.length === 0 && (
                <p className="text-chai/50">Nothing scheduled.</p>
              )}
              {p.upcoming_changes.items.map((c, i) => (
                <div key={i} className="flex justify-between border-b border-masala-100 py-1 text-chai/80">
                  <span>{c.label}</span>
                  <span className="text-xs text-chai/50">{fmtDate(c.date)}</span>
                </div>
              ))}
              {p.upcoming_changes.total > p.upcoming_changes.items.length && (
                <button
                  className="pt-1 text-xs font-semibold text-masala-600 hover:underline"
                  onClick={() => setTab("meals")}
                >
                  View all {p.upcoming_changes.total} →
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 grid gap-3 sm:grid-cols-2">
            {active.length === 0 && (
              <p className="text-sm text-chai/60">No active subscription. Add one on the Subscription tab.</p>
            )}
            {active.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold capitalize text-chai">{s.meal_type}</span>
                  <StatusPill status={s.status} />
                </div>
                <div className="mt-1 text-sm text-chai/70">
                  {s.weekday_labels.join(" · ")} · {s.plates_per_day} plate/day · {rupees(s.price)}/plate
                </div>
                <div className="text-xs text-chai/50">
                  {s.menu_item_name} · from {fmtDate(s.start_date)}
                  {s.end_date ? ` to ${fmtDate(s.end_date)}` : ""}
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setTab("subscription")}>
                    Change
                  </button>
                  {s.status === "active" ? (
                    <button className="btn-ghost px-3 py-1 text-xs" onClick={() => subAction(s, "paused")}>
                      Pause
                    </button>
                  ) : (
                    <button className="btn-ghost px-3 py-1 text-xs" onClick={() => subAction(s, "active")}>
                      Resume
                    </button>
                  )}
                  <button
                    className="px-3 py-1 text-xs font-semibold text-rose-600 hover:underline"
                    onClick={() => {
                      if (confirm(`Terminate this ${s.meal_type} subscription?`)) subAction(s, "cancelled");
                    }}
                  >
                    Terminate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "subscription" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(["lunch", "dinner"] as MealType[]).map((meal) => (
            <SubEditor
              key={meal}
              meal={meal}
              customerId={Number(id)}
              existing={p.subscriptions.find((s) => s.meal_type === meal && s.status !== "cancelled")}
              menu={menu}
              onSaved={load}
            />
          ))}
        </div>
      )}

      {tab === "meals" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-masala-50 text-left text-xs uppercase tracking-wide text-chai/60">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Meal</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Regular</th>
                <th className="px-4 py-2">Adj.</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-masala-100">
              {p.meals.map((m, i) => (
                <tr key={i} className={m.total === 0 ? "opacity-50" : ""}>
                  <td className="px-4 py-2">{m.weekday} {fmtDate(m.date)}</td>
                  <td className="px-4 py-2 capitalize">{m.meal_type}</td>
                  <td className="px-4 py-2">{m.item_name}</td>
                  <td className="px-4 py-2">{m.regular}</td>
                  <td className="px-4 py-2">{m.adjustment > 0 ? `+${m.adjustment}` : m.adjustment}</td>
                  <td className="px-4 py-2 font-semibold">{m.total}</td>
                  <td className="px-4 py-2 text-xs text-chai/60">{m.notes || m.status}</td>
                </tr>
              ))}
              {p.meals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-chai/50">
                    Nothing scheduled in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setOrderOpen(true)}>
              + Add order
            </button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-masala-50 text-left text-xs uppercase tracking-wide text-chai/60">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Meal</th>
                  <th className="px-4 py-2">Items</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-masala-100">
                {p.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2">{fmtDate(o.date)}</td>
                    <td className="px-4 py-2 capitalize">{o.meal_type}</td>
                    <td className="px-4 py-2 text-xs text-chai/70">{o.summary}</td>
                    <td className="px-4 py-2">{rupees(o.amount)}</td>
                    <td className="px-4 py-2"><StatusPill status={o.status} /></td>
                  </tr>
                ))}
                {p.orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-chai/50">No orders.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "billing" && (
        <div className="space-y-3">
          {p.invoices.length === 0 && <p className="text-sm text-chai/60">No invoices yet.</p>}
          {p.invoices.map((inv) => (
            <div key={inv.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-chai">{inv.period_label}</div>
                  <div className="text-xs text-chai/60">
                    {inv.plates} plate(s) · due {inv.due_date ? fmtDate(inv.due_date) : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={inv.effective_status} />
                  <span className="text-sm text-chai/70">
                    {rupees(inv.amount_paid)} / <b className="text-chai">{rupees(inv.amount)}</b>
                  </span>
                  {inv.status !== "paid" && (
                    <button className="btn-gold px-3 py-1.5 text-xs" onClick={() => setPayFor(inv)}>
                      Record payment
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {orderOpen && (
        <OrderModal
          customer={{ id: p.customer.id, name: p.customer.name, phone: p.customer.phone }}
          onClose={() => setOrderOpen(false)}
          onSaved={async () => {
            setOrderOpen(false);
            await load();
          }}
        />
      )}
      {payFor && (
        <RecordPaymentModal
          invoice={payFor}
          onClose={() => setPayFor(null)}
          onSaved={async () => {
            setPayFor(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function SubEditor({
  meal,
  customerId,
  existing,
  menu,
  onSaved,
}: {
  meal: MealType;
  customerId: number;
  existing?: SubscriptionOut;
  menu: MenuItem[];
  onSaved: () => Promise<void>;
}) {
  const items = useMemo(() => menu.filter((m) => m.meal_type === meal && m.is_active), [menu, meal]);
  const [weekdays, setWeekdays] = useState<number[]>(existing?.weekdays ?? [0, 1, 2, 3, 4]);
  const [ppd, setPpd] = useState(String(existing?.plates_per_day ?? 1));
  const [itemId, setItemId] = useState(existing?.menu_item_id ? String(existing.menu_item_id) : "");
  const [price, setPrice] = useState(existing ? String(existing.price) : "");
  const [startDate, setStartDate] = useState(existing?.start_date ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(existing?.end_date ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleDay(d: number) {
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        meal_type: meal,
        weekdays,
        plates_per_day: Number(ppd) || 1,
        menu_item_id: itemId ? Number(itemId) : null,
        start_date: startDate,
        end_date: endDate || null,
      };
      if (price !== "") payload.price = parseFloat(price);
      await api.post(`/admin/customers/${customerId}/subscription`, payload);
      await onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold capitalize text-masala-700">{meal}</h3>
        {existing && <StatusPill status={existing.status} />}
      </div>
      <div className="mt-3 grid gap-3">
        <Field label="Weekdays">
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_LABELS.map((lbl, d) => (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  weekdays.includes(d)
                    ? "border-masala-500 bg-masala-50 text-masala-700"
                    : "border-masala-200 bg-white text-chai/60"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plates / day">
            <input className="input" inputMode="numeric" value={ppd} onChange={(e) => setPpd(e.target.value)} />
          </Field>
          <Field label="Price / plate (₹)">
            <input className="input" inputMode="decimal" placeholder="auto" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>
        <Field label="Menu item">
          <select
            className="input"
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value);
              const it = items.find((i) => String(i.id) === e.target.value);
              if (it && !price) setPrice(String(it.price));
            }}
          >
            <option value="">Kitchen&apos;s choice</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · ₹{i.price}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End (optional)">
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        <button className="btn-primary" onClick={save} disabled={busy || weekdays.length === 0}>
          {busy ? "Saving…" : existing ? "Update subscription" : "Create subscription"}
        </button>
      </div>
    </div>
  );
}
