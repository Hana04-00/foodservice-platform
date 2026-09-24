"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { ErrorBanner, Icon, Pager, Spinner, StatusPill, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDay } from "@/lib/format";
import type { AdHocOrder, AdHocStatus, Paginated } from "@/lib/types";

const STATUSES: AdHocStatus[] = ["confirmed", "preparing", "delivered", "cancelled"];

export default function AdminOrders() {
  const [data, setData] = useState<Paginated<AdHocOrder> | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | AdHocStatus>("all");
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (q.trim()) params.set("q", q.trim());
    if (status !== "all") params.set("status", status);
    const d = await api.get<Paginated<AdHocOrder>>(`/admin/orders?${params}`);
    setData(d);
  }, [page, q, status]);

  useEffect(() => {
    const t = setTimeout(() => load().catch((e) => setErr(e.message)), 200);
    return () => clearTimeout(t);
  }, [load]);

  async function changeStatus(row: AdHocOrder, next: AdHocStatus) {
    setBusyId(row.id);
    setErr(null);
    try {
      await api.patch(`/admin/orders/${row.id}`, { status: next });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update this order");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        subtitle="One-off orders customers placed outside their subscription, plus any you've entered yourself."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="label">Search</label>
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-3 h-5 w-5 text-ink-faint" />
            <input
              className="input pl-10"
              placeholder="customer name or phone"
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
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <ErrorBanner>{err}</ErrorBanner>}
      {!data && !err && <Spinner />}

      {data && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className="th">Customer</th>
                <th className="th">Date</th>
                <th className="th">Meal</th>
                <th className="th">Order</th>
                <th className="th text-right">Amount</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {data.items.map((o) => (
                <tr key={o.id}>
                  <td className="td">
                    <div className="font-medium text-ink">{o.customer_name}</div>
                    <div className="text-[11px] text-ink-faint">{o.customer_phone}</div>
                  </td>
                  <td className="td">{fmtDay(o.date)}</td>
                  <td className="td capitalize">{o.meal_type}</td>
                  <td className="td max-w-[240px] text-ink-soft">{o.summary}</td>
                  <td className="td text-right font-semibold text-ink">{rupees(o.amount)}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <StatusPill status={o.status} />
                      <select
                        className="input w-auto py-1 text-xs"
                        value={o.status}
                        disabled={busyId === o.id}
                        onChange={(e) => changeStatus(o, e.target.value as AdHocStatus)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="td text-center text-ink-faint">
                    No orders{status !== "all" ? ` with status "${status}"` : ""} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && <Pager page={page} pageSize={data.page_size} total={data.total} onPage={setPage} />}
    </div>
  );
}
