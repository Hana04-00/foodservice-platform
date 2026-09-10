"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { ErrorBanner, Icon, Meter, Spinner, StatCard, StatusPill, rupees } from "@/components/ui";
import { API_BASE, api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import { getToken } from "@/lib/session";
import type { AdminDashboardV2, AdminCustomerRow, Paginated } from "@/lib/types";

export default function AdminDashboardPage() {
  const load = useCallback(() => api.get<AdminDashboardV2>("/admin/dashboard"), []);
  const { data, error, loading } = usePoll(load, [], 15000);

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminCustomerRow[]>([]);
  const loadCustomers = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", page_size: "8" });
    if (q.trim()) params.set("q", q.trim());
    const res = await api.get<Paginated<AdminCustomerRow>>(`/admin/customers?${params}`);
    setRows(res.items);
  }, [q]);
  useEffect(() => {
    const t = setTimeout(() => loadCustomers().catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [loadCustomers]);

  function exportCsv() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
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

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBanner>{error}</ErrorBanner>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle={`${data.weekday} ${fmtDate(data.date)} · updates live as orders and cancellations come in`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Customers" value={data.total_customers} hint={`${data.active_subscriptions} active plans`} />
        <StatCard
          label="Today's Lunch"
          value={`${data.lunch_confirmed}/${data.lunch_capacity}`}
          hint="confirmed / capacity"
        />
        <StatCard
          label="Today's Dinner"
          value={`${data.dinner_confirmed}/${data.dinner_capacity}`}
          hint="confirmed / capacity"
        />
        <StatCard
          label="Cancellations Today"
          value={data.cancelled_today}
          tone={data.cancelled_today > 0 ? "danger" : "brand"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* meal requirement */}
        <section className="card overflow-hidden">
          <div className="border-b border-brand-100 px-5 py-3.5">
            <h2 className="font-semibold text-brand-800">Meal Requirement (Today)</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className="th">Meal type</th>
                <th className="th text-right">Required</th>
                <th className="th text-right">Confirmed</th>
                <th className="th text-right">Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {data.meal_requirement.map((m) => (
                <tr key={m.meal_type}>
                  <td className="td">
                    <span className="inline-flex items-center gap-1.5 capitalize text-ink">
                      <Icon name={m.meal_type} className="h-4 w-4 text-brand-500" />
                      {m.meal_type}
                    </span>
                  </td>
                  <td className="td text-right text-ink">{m.required}</td>
                  <td className="td text-right text-ink">{m.confirmed}</td>
                  <td className={`td text-right font-semibold ${m.gap > 0 ? "text-danger-600" : "text-brand-700"}`}>
                    {m.gap > 0 ? `-${m.gap}` : m.gap}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-brand-100 bg-brand-50 px-5 py-3 text-sm font-semibold text-brand-800">
            Net Meals to Prepare (after cancellations): {data.net_to_prepare}
          </div>
        </section>

        {/* area-wise customers */}
        <section className="card overflow-hidden">
          <div className="border-b border-brand-100 px-5 py-3.5">
            <h2 className="font-semibold text-brand-800">Area-wise Customers</h2>
          </div>
          <div className="divide-y divide-brand-100">
            {data.area_customers.map((a) => (
              <div key={a.name} className="px-5 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{a.name}</span>
                  <span className="text-ink-soft">
                    {a.customers}
                    {a.capacity ? ` / ${a.capacity}` : ""}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Meter pct={a.capacity ? a.pct : Math.min(a.customers * 10, 100)} />
                </div>
              </div>
            ))}
            {data.area_customers.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-ink-faint">No areas configured.</p>
            )}
          </div>
        </section>
      </div>

      {/* customer list */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 px-5 py-3.5">
          <h2 className="font-semibold text-brand-800">Customer List</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon name="search" className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-faint" />
              <input
                className="input py-1.5 pl-8 text-sm"
                placeholder="Search name / phone / area"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={exportCsv}>
              <Icon name="download" className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className="th">Name</th>
                <th className="th">Phone</th>
                <th className="th">Area</th>
                <th className="th">Plan</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td">
                    <Link href={`/admin/customers/${r.id}`} className="font-medium text-ink hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="td">{r.phone}</td>
                  <td className="td">{r.area || "—"}</td>
                  <td className="td">{r.plan_summary}</td>
                  <td className="td">
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="td text-center text-ink-faint">
                    No customers match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-brand-100 px-5 py-2.5 text-right">
          <Link href="/admin/customers" className="text-xs font-semibold text-brand-600 hover:underline">
            All customers →
          </Link>
        </div>
      </section>
    </div>
  );
}
