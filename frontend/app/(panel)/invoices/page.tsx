"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { EmptyState, ErrorBanner, Spinner, StatCard, StatusPill, rupees } from "@/components/ui";
import { printInvoice } from "@/components/invoice";
import { api } from "@/lib/api";
import { fmtDate, monthName } from "@/lib/format";
import { getUser } from "@/lib/session";
import type { InvoiceOut } from "@/lib/types";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceOut[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const user = getUser();

  const load = useCallback(async () => {
    try {
      setInvoices(await api.get<InvoiceOut[]>("/billing/me"));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load invoices");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (err && !invoices) return <ErrorBanner>{err}</ErrorBanner>;
  if (!invoices) return <Spinner />;

  const outstanding = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount_due, 0);
  const paidTotal = invoices.reduce((s, i) => s + i.amount_paid, 0);

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Monthly bills, prepared from the plates you were actually served."
      />

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <StatCard
          label="Outstanding"
          value={rupees(outstanding)}
          tone={outstanding > 0 ? "danger" : "brand"}
          hint={`${invoices.filter((i) => i.status !== "paid").length} open`}
        />
        <StatCard label="Paid to date" value={rupees(paidTotal)} tone="muted" />
      </div>

      {invoices.length === 0 && (
        <div className="mt-6">
          <EmptyState>No invoices yet.</EmptyState>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {invoices.map((inv) => (
          <section key={inv.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-brand-800">
                  {monthName(inv.period_year, inv.period_month)}
                </div>
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

            <div className="mt-2 flex gap-4 text-xs font-semibold">
              <button
                className="text-brand-600 hover:underline"
                onClick={() => setOpen(open === inv.id ? null : inv.id)}
              >
                {open === inv.id ? "Hide details" : "View details"}
              </button>
              <button className="text-brand-600 hover:underline" onClick={() => printInvoice(inv, user)}>
                Print
              </button>
            </div>

            {open === inv.id && (
              <div className="mt-3 space-y-3 border-t border-brand-100 pt-3 text-sm">
                {(["subscription", "adhoc"] as const).map((kind) => {
                  const rows = inv.lines.filter((l) => l.kind === kind);
                  if (rows.length === 0) return null;
                  return (
                    <div key={kind}>
                      <div className="stat-label mb-1">
                        {kind === "adhoc" ? "One-off orders" : "Subscription"}
                      </div>
                      {rows.map((l, i) => (
                        <div key={i} className="flex justify-between py-1 text-ink-soft">
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
                <div className="flex justify-between border-t border-brand-100 pt-2 font-semibold text-ink">
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
