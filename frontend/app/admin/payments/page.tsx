"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RecordPaymentModal } from "@/components/RecordPaymentModal";
import { StatusPill, rupees } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { AdminBilling, Meta } from "@/lib/types";

type Row = AdminBilling["per_customer"][number];

export default function AdminBillingPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [b, setB] = useState<AdminBilling | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<Row | null>(null);

  useEffect(() => {
    api
      .get<Meta>("/meta", false)
      .then((m) => {
        const [y, mo] = m.today.split("-").map(Number);
        setYear(y);
        setMonth(mo);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    setB(await api.get<AdminBilling>(`/admin/billing?year=${year}&month=${month}`));
  }, [year, month]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/admin/invoices/generate?year=${year}&month=${month}`, {});
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not generate invoices");
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(id: number) {
    setErr(null);
    try {
      await api.post(`/admin/invoices/${id}/mark-paid`, { method: "cash" });
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not mark paid");
    }
  }

  const cards: [string, number, string][] = b
    ? [
        ["Collected", b.collected_total, "text-emerald-700"],
        ["Outstanding", b.outstanding_total, "text-masala-700"],
        ["Overdue", b.overdue_total, "text-rose-600"],
      ]
    : [];

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-chai">Billing</h1>
      <p className="rounded-xl bg-curry-50 px-4 py-2 text-xs text-curry-800">
        Invoices bill the plates each customer was actually served that month, plus any
        ad-hoc orders. Generate or refresh them here, then record payments (cash or
        simulated online). Overdue = unpaid or partial past the due date.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Year</label>
          <input
            type="number"
            className="input w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Month</label>
          <select className="input w-36" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1, 1).toLocaleDateString("en-IN", { month: "long" })}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={generate} disabled={busy}>
          {busy ? "Working…" : "Generate / refresh invoices"}
        </button>
      </div>

      {err && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(([label, val, cls]) => (
          <div key={label} className="card p-4">
            <div className="text-xs uppercase tracking-wide text-chai/60">
              {label} ({b?.period_label})
            </div>
            <div className={`mt-1 font-display text-2xl font-bold ${cls}`}>{rupees(val)}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-masala-50 text-left text-xs uppercase tracking-wide text-chai/60">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Plates</th>
              <th className="px-4 py-2">Bill</th>
              <th className="px-4 py-2">Paid</th>
              <th className="px-4 py-2">Due</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-masala-100">
            {b?.per_customer.map((r) => (
              <tr key={r.user_id}>
                <td className="px-4 py-2 font-medium text-chai">
                  <Link href={`/admin/customers/${r.user_id}`} className="hover:underline">
                    {r.name}
                  </Link>
                  <div className="text-[11px] text-chai/50">{r.phone}</div>
                </td>
                <td className="px-4 py-2">{r.plates}</td>
                <td className="px-4 py-2">{rupees(r.amount)}</td>
                <td className="px-4 py-2 text-emerald-700">{rupees(r.amount_paid)}</td>
                <td className="px-4 py-2 font-semibold text-masala-700">{rupees(r.amount_due)}</td>
                <td className="px-4 py-2">
                  <StatusPill status={r.status === "none" ? "none" : r.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  {r.invoice_id && r.status !== "paid" && r.status !== "none" && (
                    <>
                      <button
                        className="text-xs font-semibold text-masala-600 hover:underline"
                        onClick={() => setPayFor(r)}
                      >
                        Record payment
                      </button>
                      <span className="px-1 text-chai/30">·</span>
                      <button
                        className="text-xs font-semibold text-masala-600 hover:underline"
                        onClick={() => markPaid(r.invoice_id!)}
                      >
                        Mark paid
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {b && b.per_customer.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-chai/50">
                  No customers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {payFor && payFor.invoice_id && (
        <RecordPaymentModal
          invoice={{
            id: payFor.invoice_id,
            period_label: b?.period_label ?? "",
            amount: payFor.amount,
            amount_paid: payFor.amount_paid,
            amount_due: payFor.amount_due,
          }}
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
