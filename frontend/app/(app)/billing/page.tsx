"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusPill, rupees } from "@/components/ui";
import { printInvoice } from "@/components/invoice";
import { api } from "@/lib/api";
import { getUser } from "@/lib/session";
import type { InvoiceOut } from "@/lib/types";

const monthLabel = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function BillingPage() {
  const [invoices, setInvoices] = useState<InvoiceOut[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const user = getUser();

  const load = useCallback(async () => {
    setInvoices(await api.get<InvoiceOut[]>("/billing/me"));
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const outstanding = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount_due, 0);
  const paidTotal = invoices.reduce((s, i) => s + i.amount_paid, 0);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-chai">Billing history</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-chai/60">Outstanding</div>
          <div className="mt-1 font-display text-3xl font-bold text-masala-700">{rupees(outstanding)}</div>
          <div className="text-xs text-chai/60">
            {invoices.filter((i) => i.status !== "paid").length} open invoice(s)
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-chai/60">Paid to date</div>
          <div className="mt-1 font-display text-3xl font-bold text-emerald-700">{rupees(paidTotal)}</div>
        </div>
      </div>

      <p className="rounded-xl bg-curry-50 px-4 py-2 text-xs text-curry-800">
        Invoices are prepared monthly by the kitchen from the plates you were actually
        served. Payments are recorded by the kitchen — reach out to settle a bill.
      </p>

      {invoices.length === 0 && <p className="text-sm text-chai/60">No invoices yet.</p>}

      <div className="space-y-3">
        {invoices.map((inv) => (
          <section key={inv.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-chai">{monthLabel(inv.period_year, inv.period_month)}</div>
                <div className="text-xs text-chai/60">
                  {inv.plates} plate(s) · due {inv.due_date ? fmtDate(inv.due_date) : "—"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={inv.effective_status} />
                <span className="text-sm text-chai/70">
                  {rupees(inv.amount_paid)} / <b className="text-chai">{rupees(inv.amount)}</b>
                </span>
              </div>
            </div>

            <div className="mt-2 flex gap-3 text-xs font-semibold">
              <button
                className="text-masala-600 hover:underline"
                onClick={() => setOpen(open === inv.id ? null : inv.id)}
              >
                {open === inv.id ? "Hide details" : "View details"}
              </button>
              <button className="text-masala-600 hover:underline" onClick={() => printInvoice(inv, user)}>
                Print
              </button>
            </div>

            {open === inv.id && (
              <div className="mt-3 space-y-3 border-t border-masala-100 pt-3 text-sm">
                {(["subscription", "adhoc"] as const).map((kind) => {
                  const rows = inv.lines.filter((l) => l.kind === kind);
                  if (rows.length === 0) return null;
                  return (
                    <div key={kind}>
                      <div className="mb-1 text-[11px] uppercase tracking-wide text-chai/50">
                        {kind === "adhoc" ? "One-off orders" : "Subscription"}
                      </div>
                      {rows.map((l, i) => (
                        <div key={i} className="flex justify-between py-1 text-chai/70">
                          <span className="capitalize">
                            {l.meal_type} · {l.item_name}
                          </span>
                          <span>
                            {l.plates} × {rupees(l.unit_price)} = {rupees(l.line_total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div className="flex justify-between border-t border-masala-100 pt-2 font-semibold text-chai">
                  <span>Amount due</span>
                  <span>{rupees(inv.amount_due)}</span>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
