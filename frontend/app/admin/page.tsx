"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/components/ui";
import { api } from "@/lib/api";
import type { AdminDashboard } from "@/lib/types";

export default function AdminDashboardPage() {
  const [date, setDate] = useState("");
  const [d, setD] = useState<AdminDashboard | null>(null);

  const load = useCallback((on: string) => {
    const q = on ? `?date=${on}` : "";
    return api.get<AdminDashboard>(`/admin/dashboard${q}`).then((r) => {
      setD(r);
      if (!on) setDate(r.date);
    });
  }, []);

  useEffect(() => {
    load("").catch(() => {});
  }, [load]);

  const stats = d
    ? [
        ["Active customers", d.total_customers],
        ["Active plans", d.active_subscriptions],
        ["Lunch plates", d.lunch_plates],
        ["Dinner plates", d.dinner_plates],
        ["Orders", d.orders_today],
        ["Cancelled", d.cancelled_today],
        ["Extra plates", d.extra_plates_today],
        ["Collected (mo.)", rupees(d.collected_period)],
        ["Pending (mo.)", rupees(d.pending_period)],
        ["Outstanding", rupees(d.outstanding_total)],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-chai">Dashboard</h1>
          <p className="text-sm text-chai/70">
            {d ? `${d.weekday} ${new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : "…"}
          </p>
        </div>
        <div>
          <label className="label">Day</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              load(e.target.value).catch(() => {});
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(([label, val]) => (
          <div key={label as string} className="card p-3">
            <div className="text-[11px] uppercase tracking-wide text-chai/60">{label}</div>
            <div className="mt-1 font-display text-lg font-bold text-masala-700">{val}</div>
          </div>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-masala-100 px-4 py-3">
          <h2 className="font-semibold text-masala-700">Today&apos;s meals</h2>
          <Link href="/admin/plate-report" className="text-xs font-semibold text-masala-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-masala-50 text-left text-xs uppercase tracking-wide text-chai/60">
              <tr>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Meal</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-masala-100">
              {d?.todays_meals.map((r, i) => (
                <tr key={i} className={r.qty === 0 ? "opacity-50" : ""}>
                  <td className="px-4 py-2 font-medium text-chai">{r.customer_name}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`pill ${
                        r.type === "Subscription"
                          ? "bg-masala-100 text-masala-700"
                          : "bg-curry-100 text-curry-800"
                      }`}
                    >
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 capitalize">{r.meal}</td>
                  <td className="px-4 py-2">{r.qty}</td>
                  <td className="px-4 py-2 text-chai/70">{r.status}</td>
                </tr>
              ))}
              {d && d.todays_meals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-chai/50">
                    No scheduled meals.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
