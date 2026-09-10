"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { ErrorBanner, Field, Icon, Modal, Pager, Spinner, StatusPill, rupees } from "@/components/ui";
import { API_BASE, api, ApiError } from "@/lib/api";
import { getToken } from "@/lib/session";
import { WEEKDAY_LABELS } from "@/lib/types";
import { todayISO } from "@/lib/format";
import type { AdminCustomerRow, MealType, MenuItem, Paginated } from "@/lib/types";

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

  function exportCsv() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status !== "all") params.set("status", status);
    fetch(`${API_BASE}/admin/customers/export?${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "customers.csv";
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle="Every customer, their plan, their area and their outstanding balance."
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={exportCsv}>
              <Icon name="download" className="h-4 w-4" />
              Export
            </button>
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              + Add customer
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="label">Search</label>
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-3 h-5 w-5 text-ink-faint" />
            <input
              className="input pl-10"
              placeholder="name, phone, email or area"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
          </div>
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

      {err && <ErrorBanner>{err}</ErrorBanner>}
      {!data && <Spinner />}

      {data && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className="th">Name</th>
                <th className="th">Phone</th>
                <th className="th">Area</th>
                <th className="th">Plan</th>
                <th className="th">Status</th>
                <th className="th text-right">Credit</th>
                <th className="th text-right">Due</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td className="td">
                    <Link href={`/admin/customers/${r.id}`} className="font-medium text-ink hover:underline">
                      {r.name}
                    </Link>
                    {r.email && <div className="text-[11px] text-ink-faint">{r.email}</div>}
                  </td>
                  <td className="td">{r.phone}</td>
                  <td className="td">{r.area || "—"}</td>
                  <td className="td text-ink-soft">{r.plan_summary}</td>
                  <td className="td">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="td text-right text-brand-700">
                    {r.credit_balance > 0 ? rupees(r.credit_balance) : "—"}
                  </td>
                  <td className="td text-right font-semibold text-ink">{rupees(r.amount_due)}</td>
                  <td className="td text-right">
                    <button
                      className="text-xs font-semibold text-brand-600 hover:underline"
                      onClick={() => setSubFor(r)}
                    >
                      Set subscription
                    </button>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="td text-center text-ink-faint">
                    No customers match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />}

      {addOpen && (
        <AddCustomerModal
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

function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", pin: "", email: "", area: "", pincode: "", address: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await api.post("/admin/customers", f);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not create customer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add customer" onClose={onClose}>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Area">
            <input className="input" value={f.area} onChange={(e) => set("area", e.target.value)} />
          </Field>
          <Field label="Pincode">
            <input className="input" value={f.pincode} onChange={(e) => set("pincode", e.target.value)} />
          </Field>
        </div>
        <Field label="Address">
          <textarea className="input" rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        {err && <ErrorBanner>{err}</ErrorBanner>}
        <button
          className="btn-primary mt-1"
          onClick={save}
          disabled={busy || !f.name || f.pin.length !== 4 || f.phone.length < 6}
        >
          {busy ? "Saving…" : "Create customer"}
        </button>
        <p className="text-xs text-ink-faint">
          Set the customer&apos;s daily tiffin from their profile once they&apos;re created.
        </p>
      </div>
    </Modal>
  );
}

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
  const existing = customer.subscriptions.find((s) => s.meal_type === meal && s.status !== "cancelled");
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
      <div className="mb-3 flex gap-1 rounded-xl bg-brand-50 p-1 text-sm font-semibold">
        {(["lunch", "dinner"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMeal(m)}
            className={`flex-1 rounded-lg py-1.5 capitalize transition ${
              meal === m ? "bg-white text-brand-700 shadow-soft" : "text-ink-faint"
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
          <Field label="Start date">
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End date (optional)">
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        {existing && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
            Updates the existing {meal} subscription (#{existing.id}).
          </p>
        )}
        {err && <ErrorBanner>{err}</ErrorBanner>}
        <button className="btn-primary" onClick={save} disabled={busy || weekdays.length === 0}>
          {busy ? "Saving…" : existing ? "Update subscription" : "Create subscription"}
        </button>
      </div>
    </Modal>
  );
}
