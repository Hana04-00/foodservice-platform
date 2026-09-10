"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Pager, StatusPill, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import type { Paginated, SubscriptionListItem } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "cancelled", label: "Terminated" },
] as const;

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

export default function AdminSubscriptions() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<SubscriptionListItem> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (status !== "all") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    setData(await api.get<Paginated<SubscriptionListItem>>(`/admin/subscriptions?${params}`));
  }, [status, q, page]);

  useEffect(() => {
    const t = setTimeout(() => load().catch((e) => setErr(e.message)), 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-chai">Subscriptions</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-masala-50 p-1 text-sm font-semibold">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setPage(1);
                setStatus(f.key);
              }}
              className={`rounded-lg px-3 py-1.5 transition ${
                status === f.key ? "bg-white text-masala-700 shadow" : "text-chai/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="input max-w-xs"
          placeholder="search customer…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
      </div>

      {err && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-masala-50 text-left text-xs uppercase tracking-wide text-chai/60">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Meal</th>
              <th className="px-4 py-2">Plates/day</th>
              <th className="px-4 py-2">Weekdays</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Start</th>
              <th className="px-4 py-2">End</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-masala-100">
            {data?.items.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-medium text-chai">
                  <Link href={`/admin/customers/${s.customer_id}`} className="hover:underline">
                    {s.customer_name}
                  </Link>
                  <div className="text-[11px] text-chai/50">{s.customer_phone}</div>
                </td>
                <td className="px-4 py-2 capitalize">{s.meal_type}</td>
                <td className="px-4 py-2">{s.plates_per_day}</td>
                <td className="px-4 py-2 text-xs text-chai/60">{s.weekday_labels.join(" ")}</td>
                <td className="px-4 py-2">{rupees(s.price)}</td>
                <td className="px-4 py-2">{fmt(s.start_date)}</td>
                <td className="px-4 py-2">{fmt(s.end_date)}</td>
                <td className="px-4 py-2"><StatusPill status={s.status} /></td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-chai/50">
                  No subscriptions match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />}
    </div>
  );
}
