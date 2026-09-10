"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface ClockStatus {
  real_now: string;
  effective_now: string;
  override_active: boolean;
}

export function ClockControl() {
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get<ClockStatus>("/admin/clock").then(setStatus).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  async function apply(iso: string | null) {
    setBusy(true);
    try {
      const s = await api.put<ClockStatus>("/admin/clock", { simulated_now: iso });
      setStatus(s);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  function shift(hours: number) {
    const base = status ? new Date(status.effective_now) : new Date();
    base.setHours(base.getHours() + hours);
    apply(base.toISOString());
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
          status?.override_active
            ? "border-curry-400 bg-curry-100 text-curry-800"
            : "border-masala-200 bg-white text-chai/70"
        }`}
        title="Demo clock override — move time to test cutoffs"
      >
        🕒 {status ? new Date(status.effective_now).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "clock"}
        {status?.override_active ? " (sim)" : ""}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-masala-100 bg-cream p-3 shadow-card">
          <p className="text-xs text-chai/70">
            Move the kitchen clock to demo the 10 AM / 6 PM cutoffs without waiting.
          </p>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {[1, 3, 6, 12].map((h) => (
              <button key={h} className="btn-ghost px-2 py-1 text-xs" onClick={() => shift(h)} disabled={busy}>
                +{h}h
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            className="input mt-2"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              className="btn-primary flex-1 px-2 py-1.5 text-xs"
              disabled={busy || !value}
              onClick={() => apply(new Date(value).toISOString())}
            >
              Set
            </button>
            <button
              className="btn-ghost flex-1 px-2 py-1.5 text-xs"
              disabled={busy}
              onClick={() => apply(null)}
            >
              Reset to real time
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
