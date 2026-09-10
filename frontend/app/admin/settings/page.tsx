"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { ErrorBanner, Field, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { AdminSettings } from "@/lib/types";

const FIELDS: { key: keyof AdminSettings; label: string; hint?: string; wide?: boolean }[] = [
  { key: "business_name", label: "Business name" },
  { key: "tagline", label: "Tagline", wide: true },
  { key: "whatsapp_number", label: "WhatsApp number", hint: "Digits with country code, e.g. 919812345678" },
  { key: "contact_phone", label: "Contact phone" },
  { key: "contact_email", label: "Contact email" },
  { key: "service_hours", label: "Service hours", wide: true },
  { key: "cancellation_notice_hours", label: "Cancellation notice (hours)" },
  { key: "lunch_capacity", label: "Lunch capacity (plates/day)" },
  { key: "dinner_capacity", label: "Dinner capacity (plates/day)" },
];

export default function SettingsPage() {
  const [form, setForm] = useState<AdminSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      setForm(await api.get<AdminSettings>("/admin/settings"));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load settings");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await api.put<AdminSettings>("/admin/settings", form);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  if (err && !form) return <ErrorBanner>{err}</ErrorBanner>;
  if (!form) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Business details shown on the public site, plus daily kitchen capacity."
      />

      {err && <div className="mb-4"><ErrorBanner>{err}</ErrorBanner></div>}
      {saved && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Settings saved.
        </div>
      )}

      <div className="card max-w-3xl p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
              <Field label={f.label} hint={f.hint}>
                <input
                  className="input"
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((s) => (s ? { ...s, [f.key]: e.target.value } : s))}
                />
              </Field>
            </div>
          ))}
        </div>
        <button className="btn-primary mt-6" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
