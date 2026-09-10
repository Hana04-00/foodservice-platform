"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OrderModal } from "@/components/OrderModal";
import { Pager, StatusPill, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import type { AdHocOrder, AdHocStatus, Paginated } from "@/lib/types";

const STATUSES: AdHocStatus[] = ["confirmed", "preparing", "delivered", "cancelled"];
const fmt = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function AdminOrders() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdHocOrder> | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (q.trim()) params.set("q", q.trim());
    if (status !== "all") params.set("status", status);
    if (from) params.set("date_from", from);
    if (to) params.set("date_to", to);
    setData(await api.get<Paginated<AdHocOrder>>(`/admin/orders?${params}`));
  }, [q, status, from, to, page]);

  useEffect(() => {
    const t = setTimeout(() => load().catch((e) => setErr(e.message)), 200);
    return () => clearTimeout(t);
  }, [load]);

  async function setStatusFor(id: number, s: AdHocStatus) {
    await api.patch(`/admin/orders/${id}`, { status: s });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-chai">Orders</h1>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          + Add order
        </button>
      </div>
      <p className="text-xs text-chai/60">
        One-off orders you enter for a customer, outside their subscription. Billed into
        that month&apos;s invoice and added to the kitchen plate count.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <input
          className="input max-w-[14rem]"
          placeholder="search customer…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="all">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
        </div>
      </div>

      {err && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-masala-50 text-left text-xs uppercase tracking-wide text-chai/60">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Meal</th>
              <th className="px-4 py-2">Items</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-masala-100">
            {data?.items.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2 text-chai/50">{o.id}</td>
                <td className="px-4 py-2 font-medium text-chai">
                  <Link href={`/admin/customers/${o.user_id}`} className="hover:underline">
                    {o.customer_name}
                  </Link>
                  <div className="text-[11px] text-chai/50">{o.customer_phone}</div>
                </td>
                <td className="px-4 py-2">
                  <span className="pill bg-curry-100 text-curry-800">Order</span>
                </td>
                <td className="px-4 py-2">{fmt(o.date)}</td>
                <td className="px-4 py-2 capitalize">{o.meal_type}</td>
                <td className="px-4 py-2 text-xs text-chai/70">
                  {o.summary}
                  {o.notes ? <span className="text-chai/40"> — {o.notes}</span> : null}
                </td>
                <td className="px-4 py-2 font-semibold text-masala-700">{rupees(o.amount)}</td>
                <td className="px-4 py-2"><StatusPill status={o.status} /></td>
                <td className="px-4 py-2">
                  <select
                    className="rounded-lg border border-masala-200 bg-white px-2 py-1 text-xs"
                    value={o.status}
                    onChange={(e) => setStatusFor(o.id, e.target.value as AdHocStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="capitalize">
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-chai/50">
                  No orders match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />}

      {addOpen && (
        <OrderModal
          onClose={() => setAddOpen(false)}
          onSaved={async () => {
            setAddOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
