"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBanner, Field, Icon, Spinner, StatusPill, rupees } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { WEEKDAY_LABELS } from "@/lib/types";
import type { CustomerProfile, MealType, MenuItem, SubscriptionOut } from "@/lib/types";

type Tab = "overview" | "subscription" | "meals" | "cancellations" | "invoices" | "orders";
const TABS: Tab[] = ["overview", "subscription", "meals", "cancellations", "invoices", "orders"];

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const [p, setP] = useState<CustomerProfile | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

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

  if (err) return <ErrorBanner>{err}</ErrorBanner>;
  if (!p) return <Spinner />;

  const active = p.subscriptions.filter((s) => s.status !== "cancelled");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/customers" className="text-xs font-semibold text-brand-600 hover:underline">
          ← Customers
        </Link>
        <h1 className="mt-1 section-title">{p.customer.name}</h1>
        <p className="text-sm text-ink-soft">
          {p.customer.phone}
          {p.customer.email ? ` · ${p.customer.email}` : ""}
          {p.customer.area ? ` · ${p.customer.area}` : ""} · joined{" "}
          {fmtDate(p.customer.created_at.slice(0, 10))}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <div className="stat-label">Carry-forward credit</div>
          <div className="stat-value">{rupees(p.customer.credit_balance)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active plans</div>
          <div className="stat-value">{active.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Invoices</div>
          <div className="stat-value">{p.invoices.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cancellations</div>
          <div className="stat-value">{p.skips.length}</div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-brand-50 p-1 text-sm font-semibold">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 capitalize transition ${
              tab === t ? "bg-white text-brand-700 shadow-soft" : "text-ink-faint"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="font-semibold text-brand-800">Contact</h2>
            <dl className="mt-2 space-y-1 text-sm text-ink-soft">
              <Row k="Phone" v={p.customer.phone} />
              <Row k="Email" v={p.customer.email || "—"} />
              <Row k="Area" v={p.customer.area || "—"} />
              <Row k="Address" v={`${p.customer.address || "—"} ${p.customer.pincode}`} />
            </dl>
          </div>
          <div className="card p-4">
            <h2 className="font-semibold text-brand-800">Upcoming changes</h2>
            <div className="mt-2 space-y-1 text-sm">
              {p.upcoming_changes.items.length === 0 && (
                <p className="text-ink-faint">Nothing scheduled.</p>
              )}
              {p.upcoming_changes.items.map((c, i) => (
                <div key={i} className="flex justify-between border-b border-brand-100 py-1 text-ink-soft">
                  <span>{c.label}</span>
                  <span className="text-xs text-ink-faint">{fmtDate(c.date)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
            {active.length === 0 && (
              <p className="text-sm text-ink-faint">No active subscription. Add one on the Subscription tab.</p>
            )}
            {active.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-semibold capitalize text-brand-800">
                    <Icon name={s.meal_type} className="h-4 w-4 text-brand-500" />
                    {s.meal_type}
                  </span>
                  <StatusPill status={s.status} />
                </div>
                <div className="mt-1 text-sm text-ink-soft">
                  {s.weekday_labels.join(" · ")} · {s.plates_per_day}/day · {rupees(s.price)}/plate
                </div>
                <div className="text-xs text-ink-faint">
                  {s.menu_item_name} · from {fmtDate(s.start_date)}
                  {s.end_date ? ` to ${fmtDate(s.end_date)}` : ""}
                </div>
                <div className="mt-3 flex gap-2">
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
                    className="px-3 py-1 text-xs font-semibold text-danger-600 hover:underline"
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
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className="th">Date</th>
                <th className="th">Meal</th>
                <th className="th">Item</th>
                <th className="th text-right">Regular</th>
                <th className="th text-right">Adj.</th>
                <th className="th text-right">Total</th>
                <th className="th">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {p.meals.map((m, i) => (
                <tr key={i} className={m.total === 0 ? "opacity-50" : ""}>
                  <td className="td whitespace-nowrap">
                    {m.weekday} {fmtDate(m.date)}
                  </td>
                  <td className="td capitalize">{m.meal_type}</td>
                  <td className="td">{m.item_name}</td>
                  <td className="td text-right">{m.regular}</td>
                  <td className="td text-right">{m.adjustment > 0 ? `+${m.adjustment}` : m.adjustment}</td>
                  <td className="td text-right font-semibold text-ink">{m.total}</td>
                  <td className="td text-ink-faint">{m.notes || m.status}</td>
                </tr>
              ))}
              {p.meals.length === 0 && (
                <tr>
                  <td colSpan={7} className="td text-center text-ink-faint">
                    Nothing scheduled in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "cancellations" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className="th">Meal date</th>
                <th className="th">Meal</th>
                <th className="th">Cancelled by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {p.skips.map((sk, i) => (
                <tr key={i}>
                  <td className="td">{fmtDate(sk.date)}</td>
                  <td className="td capitalize">{sk.meal_type}</td>
                  <td className="td capitalize">{sk.by}</td>
                </tr>
              ))}
              {p.skips.length === 0 && (
                <tr>
                  <td colSpan={3} className="td text-center text-ink-faint">
                    No cancellations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "invoices" && (
        <div className="space-y-3">
          {p.invoices.length === 0 && <p className="text-sm text-ink-faint">No invoices yet.</p>}
          {p.invoices.map((inv) => (
            <div key={inv.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-ink">{inv.period_label}</div>
                  <div className="text-xs text-ink-faint">
                    {inv.plates} plate(s) · due {inv.due_date ? fmtDate(inv.due_date) : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={inv.effective_status} />
                  <span className="text-sm text-ink-soft">
                    {rupees(inv.amount_paid)} / <b className="text-ink">{rupees(inv.amount)}</b>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "orders" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className="th">Order date</th>
                <th className="th">Meal</th>
                <th className="th">Items</th>
                <th className="th text-right">Amount</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {p.orders.map((o) => (
                <tr key={o.id}>
                  <td className="td">{fmtDate(o.date)}</td>
                  <td className="td capitalize">{o.meal_type}</td>
                  <td className="td text-ink-soft">{o.summary}</td>
                  <td className="td text-right text-ink">{rupees(o.amount)}</td>
                  <td className="td">
                    <StatusPill status={o.status} />
                  </td>
                </tr>
              ))}
              {p.orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="td text-center text-ink-faint">
                    No orders.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-faint">{k}</dt>
      <dd className="text-right text-ink">{v}</dd>
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
        <h3 className="font-semibold capitalize text-brand-800">{meal}</h3>
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
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-brand-200 bg-white text-ink-faint"
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
        {err && <ErrorBanner>{err}</ErrorBanner>}
        <button className="btn-primary" onClick={save} disabled={busy || weekdays.length === 0}>
          {busy ? "Saving…" : existing ? "Update subscription" : "Create subscription"}
        </button>
      </div>
    </div>
  );
}
