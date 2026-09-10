"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { ErrorBanner, Field, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { setUser } from "@/lib/session";
import type { UserOut } from "@/lib/types";

export default function ProfilePage() {
  const [me, setMe] = useState<UserOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ address: "", area: "", pincode: "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await api.get<UserOut>("/auth/me");
      setMe(u);
      setForm({ address: u.address || "", area: u.area || "", pincode: u.pincode || "" });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load your profile");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const u = await api.patch<UserOut>("/auth/me/address", form);
      setMe(u);
      setUser(u);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save your address");
    } finally {
      setBusy(false);
    }
  }

  if (err && !me) return <ErrorBanner>{err}</ErrorBanner>;
  if (!me) return <Spinner />;

  return (
    <div>
      <PageHeader title="Profile & Address" subtitle="Your login details and delivery address." />

      {err && <div className="mb-4"><ErrorBanner>{err}</ErrorBanner></div>}
      {saved && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Address updated.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold text-brand-800">Profile / login</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-faint">Name</dt>
              <dd className="font-medium text-ink">{me.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-faint">Phone (login)</dt>
              <dd className="font-medium text-ink">{me.phone}</dd>
            </div>
            {me.email ? (
              <div className="flex justify-between">
                <dt className="text-ink-faint">Email</dt>
                <dd className="font-medium text-ink">{me.email}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-ink-faint">Member since</dt>
              <dd className="font-medium text-ink">{fmtDate(me.created_at.slice(0, 10))}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-ink-faint">
            To change your name, phone or PIN, contact the kitchen.
          </p>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-brand-800">Delivery address</h2>
            {!editing && (
              <button
                className="text-sm font-semibold text-brand-600 hover:underline"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-3 grid gap-3">
              <Field label="Address">
                <textarea
                  className="input"
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Area">
                  <input
                    className="input"
                    value={form.area}
                    onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                  />
                </Field>
                <Field label="Pincode">
                  <input
                    className="input"
                    value={form.pincode}
                    onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={save} disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setEditing(false);
                    setForm({ address: me.address || "", area: me.area || "", pincode: me.pincode || "" });
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-1 text-sm text-ink">
              <p>{me.address || "No address on file yet."}</p>
              <p className="text-ink-faint">
                {[me.area, me.pincode].filter(Boolean).join(" · ") || "Area / pincode not set"}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
