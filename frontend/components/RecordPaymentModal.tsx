"use client";

import { useState } from "react";
import { Field, Modal, rupees } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { InvoiceOut, PayMethod } from "@/lib/types";

const METHODS: PayMethod[] = ["cash", "upi", "card", "netbanking"];

interface InvoiceLite {
  id: number;
  period_label: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
}

/** Admin records a payment (full or partial) against an invoice. */
export function RecordPaymentModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: InvoiceLite;
  onClose: () => void;
  onSaved: (inv: InvoiceOut) => void;
}) {
  const [amount, setAmount] = useState(String(invoice.amount_due));
  const [method, setMethod] = useState<PayMethod>("cash");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const val = parseFloat(amount);
      const inv = await api.post<InvoiceOut>(
        `/admin/invoices/${invoice.id}/record-payment`,
        { amount: val, method },
      );
      onSaved(inv);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not record payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Record payment — ${invoice.period_label}`} onClose={onClose}>
      <div className="grid gap-3">
        <div className="rounded-xl bg-masala-50 px-3 py-2 text-sm text-chai/70">
          Billed {rupees(invoice.amount)} · paid {rupees(invoice.amount_paid)} · due{" "}
          <b>{rupees(invoice.amount_due)}</b>
        </div>
        <Field label="Amount received (₹)">
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Method">
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            {METHODS.map((m) => (
              <option key={m} value={m} className="capitalize">
                {m}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-[11px] text-chai/50">
          Non-cash methods run through the simulated gateway — no real money moves.
        </p>
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        <button className="btn-primary" onClick={save} disabled={busy || !(parseFloat(amount) > 0)}>
          {busy ? "Recording…" : "Record payment"}
        </button>
      </div>
    </Modal>
  );
}
