"use client";

import Link from "next/link";
import { useState } from "react";
import { ErrorBanner, Field, Icon, Modal } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { getRole, getToken } from "@/lib/session";

export function SuggestDishForm() {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loggedInAsCustomer = getToken() && getRole() === "customer";

  function openForm() {
    setErr(null);
    setDone(false);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setItem("");
    setNotes("");
  }

  async function submit() {
    if (!item.trim()) {
      setErr("Tell us the dish name first.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.post("/food-requests", {
        requested_item: item.trim(),
        notes: notes.trim() || undefined,
      });
      setDone(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not send your suggestion. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn-ghost" onClick={openForm}>
        <Icon name="sparkle" className="h-4 w-4" />
        Suggest a dish
      </button>

      {open && (
        <Modal title="Suggest a dish" onClose={close}>
          {!loggedInAsCustomer ? (
            <div className="space-y-3 text-sm text-ink-soft">
              <p>Log in as a customer to suggest a dish — the kitchen will see it in their review inbox.</p>
              <Link href="/login/customer" className="btn-primary inline-flex w-full justify-center">
                Log in
              </Link>
            </div>
          ) : done ? (
            <div className="space-y-3 text-center">
              <p className="font-semibold text-brand-800">Thanks, we&apos;ll take a look!</p>
              <p className="text-sm text-ink-soft">
                Your suggestion has been sent to the kitchen for review.
              </p>
              <button className="btn-ghost mx-auto" onClick={close}>
                Close
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <Field label="Dish name">
                <input
                  className="input"
                  placeholder="e.g. Chicken Biryani"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  maxLength={160}
                />
              </Field>
              <Field label="Notes (optional)">
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Anything you'd like us to know — how often, spice level, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                />
              </Field>
              {err && <ErrorBanner>{err}</ErrorBanner>}
              <button className="btn-primary" onClick={submit} disabled={busy}>
                {busy ? "Sending…" : "Send suggestion"}
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
