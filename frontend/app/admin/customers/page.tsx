"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Field, Modal, Pager, StatusPill, rupees } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { WEEKDAY_LABELS } from "@/lib/types";
import type { AdminCustomerRow, MealType, MenuItem, Paginated } from "@/lib/types";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AdminCustomers() {
  const [data, setData] = useState<Paginated<AdminCustomerRow> | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [subFor, setSubFor] = useState<AdminCustomerRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (q.trim()) params.set("q", q.trim());
    if (status !== "all") params.set("status", status);
    const [d, m] = await Promise.all([
      api.get<Paginated<AdminCustomerRow>>(`/admin/customers?${params}`),
      menu.length ? Promise.resolve(menu) : api.get<MenuItem[]>("/menu", false),
    ]);
    setData(d);
    if (!menu.length) setMenu(m as MenuItem[]);
  }, [page, q, status, menu]);

  useEffect(() => {
    const t = setTimeout(() => load().catch((e) => setErr(e.message)), 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-chai">Customers</h1>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          + Add customer
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]">
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="name, phone or email"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as typeof status);
            }}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {err && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-masala-50 text-left text-xs uppercase tracking-wide text-chai/60">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Lunch</th>
              <th className="px-4 py-2">Dinner</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Due</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-masala-100">
            {data?.items.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium text-chai">
                  <Link href={`/admin/customers/${r.id}`} className="hover:underline">
                    {r.name}
                  </Link>
                  {r.email && <div className="text-[11px] text-chai/50">{r.email}</div>}
                </td>
                <td className="px-4 py-2">{r.phone}</td>
                <td className="px-4 py-2 text-xs text-chai/70">{r.plan_summary}</td>
                <td className="px-4 py-2">{r.lunch_qty || "—"}</td>
                <td className="px-4 py-2">{r.dinner_qty || "—"}</td>
                <td className="px-4 py-2">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-4 py-2 font-semibold text-masala-700">{rupees(r.amount_due)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    className="text-xs font-semibold text-masala-600 hover:underline"
                    onClick={() => setSubFor(r)}
                  >
                    Set subscription
                  </button>
                  <span className="px-1 text-chai/30">·</span>
                  <Link
                    href={`/admin/customers/${r.id}`}
                    className="text-xs font-semibold text-masala-600 hover:underline"
                  >
                    Profile
                  </Link>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-chai/50">
                  No customers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
      )}

      {addOpen && (
        <AddCustomerModal
          menu={menu}
          onClose={() => setAddOpen(false)}
          onSaved={async () => {
            setAddOpen(false);
            await load();
          }}
        />
      )}

      {subFor && (
        <SubscriptionModal
          customer={subFor}
          menu={menu}
          onClose={() => setSubFor(null)}
          onSaved={async () => {
            setSubFor(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ add (tabbed)
type SubDraft = {
  on: boolean;
  weekdays: number[];
  plates_per_day: string;
  menu_item_id: string;
  price: string;
};
const emptySub = (): SubDraft => ({
  on: false,
  weekdays: [0, 1, 2, 3, 4],
  plates_per_day: "1",
  menu_item_id: "",
  price: "",
});

function AddCustomerModal({
  menu,
  onClose,
  onSaved,
}: {
  menu: MenuItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<"basic" | "subscription" | "billing">("basic");
  const [f, setF] = useState({ name: "", phone: "", pin: "", email: "", pincode: "", address: "" });
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState("");
  const [subs, setSubs] = useState<Record<MealType, SubDraft>>({
    lunch: emptySub(),
    dinner: emptySub(),
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function toggleDay(meal: MealType, d: number) {
    setSubs((s) => {
      const wd = s[meal].weekdays;
      return {
        ...s,
        [meal]: {
          ...s[meal],
          weekdays: wd.includes(d) ? wd.filter((x) => x !== d) : [...wd, d].sort(),
        },
      };
    });
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const created = await api.post<{ id: number }>("/admin/customers", f);
      for (const meal of ["lunch", "dinner"] as MealType[]) {
        const s = subs[meal];
        if (!s.on) continue;
        await api.post(`/admin/customers/${created.id}/subscription`, {
          meal_type: meal,
          weekdays: s.weekdays,
          plates_per_day: Number(s.plates_per_day) || 1,
          menu_item_id: s.menu_item_id ? Number(s.menu_item_id) : null,
          price: s.price !== "" ? parseFloat(s.price) : undefined,
          start_date: start,
          end_date: end || null,
        });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not create customer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add customer" onClose={onClose}>
      <div className="mb-4 flex gap-1 rounded-xl bg-masala-50 p-1 text-sm font-semibold">
        {(["basic", "subscription", "billing"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-1.5 capitalize transition ${
              tab === t ? "bg-white text-masala-700 shadow" : "text-chai/60"
            }`}
          >
            {t === "basic" ? "Basic details" : t}
          </button>
        ))}
      </div>

      {tab === "basic" && (
        <div className="grid gap-3">
          <Field label="Full name">
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input className="input" inputMode="numeric" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="4-digit PIN">
              <input
                className="input tracking-[0.4em]"
                inputMode="numeric"
                maxLength={4}
                value={f.pin}
                onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </div>
          <Field label="Email">
            <input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Pincode">
            <input className="input" value={f.pincode} onChange={(e) => set("pincode", e.target.value)} />
          </Field>
          <Field label="Address">
            <textarea className="input" rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
      )}

      {tab === "subscription" && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="End date (optional)">
              <input type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          {(["lunch", "dinner"] as MealType[]).map((meal) => {
            const s = subs[meal];
            const items = menu.filter((m) => m.meal_type === meal && m.is_active);
            return (
              <div key={meal} className="rounded-xl border border-masala-100 p-3">
                <label className="flex items-center gap-2 text-sm font-semibold capitalize text-chai">
                  <input
                    type="checkbox"
                    checked={s.on}
                    onChange={(e) => setSubs((x) => ({ ...x, [meal]: { ...x[meal], on: e.target.checked } }))}
                  />
                  {meal} subscription
                </label>
                {s.on && (
                  <div className="mt-3 grid gap-3">
                    <div className="flex flex-wrap gap-1">
                      {WEEKDAY_LABELS.map((lbl, d) => (
                        <button
                          key={d}
                          onClick={() => toggleDay(meal, d)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                            s.weekdays.includes(d)
                              ? "border-masala-500 bg-masala-50 text-masala-700"
                              : "border-masala-200 bg-white text-chai/60"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Plates / day">
                        <input
                          className="input"
                          inputMode="numeric"
                          value={s.plates_per_day}
                          onChange={(e) =>
                            setSubs((x) => ({ ...x, [meal]: { ...x[meal], plates_per_day: e.target.value } }))
                          }
                        />
                      </Field>
                      <Field label="Price / plate (₹)">
                        <input
                          className="input"
                          inputMode="decimal"
                          placeholder="auto from item"
                          value={s.price}
                          onChange={(e) =>
                            setSubs((x) => ({ ...x, [meal]: { ...x[meal], price: e.target.value } }))
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Menu item">
                      <select
                        className="input"
                        value={s.menu_item_id}
                        onChange={(e) => {
                          const id = e.target.value;
                          const it = items.find((i) => String(i.id) === id);
                          setSubs((x) => ({
                            ...x,
                            [meal]: {
                              ...x[meal],
                              menu_item_id: id,
                              price: it && !x[meal].price ? String(it.price) : x[meal].price,
                            },
                          }));
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "billing" && (
        <p className="rounded-lg bg-curry-50 px-3 py-3 text-sm text-curry-800">
          Billing is generated monthly from the plates actually served, on the{" "}
          <b>Billing</b> screen. Nothing to set up front — once this customer has a
          subscription or an ad-hoc order, their invoice will appear there and on their
          profile.
        </p>
      )}

      {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
      <button className="btn-primary mt-4 w-full" onClick={save} disabled={busy || !f.name || f.pin.length !== 4}>
        {busy ? "Saving…" : "Create customer"}
      </button>
    </Modal>
  );
}

// ------------------------------------------------------------------ quick set subscription
function SubscriptionModal({
  customer,
  menu,
  onClose,
  onSaved,
}: {
  customer: AdminCustomerRow;
  menu: MenuItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [meal, setMeal] = useState<MealType>("lunch");
  const existing = customer.subscriptions.find(
    (s) => s.meal_type === meal && s.status !== "cancelled",
  );
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [ppd, setPpd] = useState("1");
  const [itemId, setItemId] = useState("");
  const [price, setPrice] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => menu.filter((m) => m.meal_type === meal && m.is_active), [menu, meal]);

  useEffect(() => {
    if (existing) {
      setWeekdays(existing.weekdays);
      setPpd(String(existing.plates_per_day));
      setItemId(existing.menu_item_id ? String(existing.menu_item_id) : "");
      setPrice(String(existing.price));
      setStartDate(existing.start_date);
      setEndDate(existing.end_date ?? "");
    } else {
      setWeekdays([0, 1, 2, 3, 4]);
      setPpd("1");
      setItemId("");
      setPrice("");
      setStartDate(todayISO());
      setEndDate("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal, customer.id]);

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
      await api.post(`/admin/customers/${customer.id}/subscription`, payload);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save subscription");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Subscription — ${customer.name}`} onClose={onClose}>
      <div className="mb-3 flex gap-1 rounded-xl bg-masala-50 p-1 text-sm font-semibold">
        {(["lunch", "dinner"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMeal(m)}
            className={`flex-1 rounded-lg py-1.5 capitalize transition ${
              meal === m ? "bg-white text-masala-700 shadow" : "text-chai/60"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
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
            <input
              className="input"
              inputMode="decimal"
              placeholder="auto from item"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Menu item">
          <select
            className="input"
            value={itemId}
            onChange={(e) => {
              const id = e.target.value;
              setItemId(id);
              const it = items.find((i) => String(i.id) === id);
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
          <Field label="Start date">
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End date (optional)">
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>

        {existing && (
          <p className="rounded-lg bg-curry-50 px-3 py-2 text-xs text-curry-800">
            Updates the existing {meal} subscription (#{existing.id}).
          </p>
        )}
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        <button className="btn-primary" onClick={save} disabled={busy || weekdays.length === 0}>
          {busy ? "Saving…" : existing ? "Update subscription" : "Create subscription"}
        </button>
      </div>
    </Modal>
  );
}
