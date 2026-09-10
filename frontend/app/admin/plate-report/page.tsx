"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE, api } from "@/lib/api";
import { getToken } from "@/lib/session";
import type { MealType, PlateMeal, PlateReport } from "@/lib/types";

function Breakdown({ meal }: { meal: PlateMeal }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Regular" value={meal.regular_total} />
        <Stat label="Adjustments" value={meal.adjustment_total >= 0 ? `+${meal.adjustment_total}` : meal.adjustment_total} />
        <Stat label="Total plates" value={meal.count} accent />
      </div>

      <div className="mt-4 card p-3">
        <p className="label">Prep</p>
        <div className="divide-y divide-masala-100 text-sm">
          {meal.prep.length === 0 && <p className="py-2 text-chai/50">Nothing scheduled.</p>}
          {meal.prep.map((p) => (
            <div key={p.item_name} className="flex justify-between py-1.5 text-chai/80">
              <span>{p.item_name}</span>
              <span className="font-semibold">×{p.plates}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-masala-50 text-left text-xs uppercase tracking-wide text-chai/60">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Regular</th>
              <th className="px-3 py-2">Adjustment</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-masala-100">
            {meal.rows.map((r) => (
              <tr key={r.user_id} className={r.total === 0 ? "opacity-50" : ""}>
                <td className="px-3 py-2">
                  <div className="font-medium text-chai">{r.name}</div>
                  <div className="text-[11px] text-chai/50">{r.phone}</div>
                </td>
                <td className="px-3 py-2 capitalize">{r.type}</td>
                <td className="px-3 py-2">{r.item_name}</td>
                <td className="px-3 py-2">{r.regular}</td>
                <td className="px-3 py-2">{r.adjustment > 0 ? `+${r.adjustment}` : r.adjustment}</td>
                <td className="px-3 py-2 font-semibold">{r.total}</td>
                <td className="px-3 py-2 text-xs text-chai/60">{r.notes}</td>
              </tr>
            ))}
            {meal.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-chai/50">
                  No plates for this meal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="card p-3">
      <div className={`font-display text-2xl font-bold ${accent ? "text-masala-700" : "text-chai"}`}>{value}</div>
      <div className="text-[11px] text-chai/60">{label}</div>
    </div>
  );
}

export default function AdminPlateReport() {
  const [date, setDate] = useState("");
  const [meal, setMeal] = useState<MealType>("lunch");
  const [report, setReport] = useState<PlateReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setErr(null);
    const q = d ? `?date=${d}` : "";
    const r = await api.get<PlateReport>(`/admin/plate-report${q}`);
    setReport(r);
    if (!d) setDate(r.date);
  }, []);

  useEffect(() => {
    load("").catch((e) => setErr(e.message));
  }, [load]);

  async function exportCsv() {
    const d = date || report?.date;
    if (!d) return;
    const res = await fetch(`${API_BASE}/admin/plate-report/export?date=${d}&meal=${meal}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      setErr("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kitchen-${meal}-${d}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold text-chai">Today&apos;s meals — kitchen list</h1>
          <p className="text-sm text-chai/70">
            Subscription plates, minus cancellations, plus ad-hoc orders.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                load(e.target.value).catch((x) => setErr(x.message));
              }}
            />
          </div>
          <button className="btn-ghost px-3 py-2 text-xs" onClick={() => window.print()}>
            Print
          </button>
          <button className="btn-ghost px-3 py-2 text-xs" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      {report && (
        <>
          <div className="rounded-xl bg-masala-50 px-4 py-2 text-sm text-chai/70">
            {new Date(report.date + "T00:00:00").toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            · <b>{report.total}</b> plates total ({report.lunch.count} lunch · {report.dinner.count} dinner)
          </div>

          <div className="flex gap-1 rounded-xl bg-masala-50 p-1 text-sm font-semibold print:hidden">
            {(["lunch", "dinner"] as MealType[]).map((m) => (
              <button
                key={m}
                onClick={() => setMeal(m)}
                className={`flex-1 rounded-lg py-1.5 capitalize transition ${
                  meal === m ? "bg-white text-masala-700 shadow" : "text-chai/60"
                }`}
              >
                {m} ({report[m].count})
              </button>
            ))}
          </div>

          <div>
            <h2 className="mb-2 font-display text-lg font-bold capitalize text-masala-700">{meal}</h2>
            <Breakdown meal={report[meal]} />
          </div>
        </>
      )}
    </div>
  );
}
