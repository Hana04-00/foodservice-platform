"use client";

import { useCallback, useEffect, useState } from "react";
import { MealImage, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import type { MenuItem } from "@/lib/types";

type Draft = {
  id?: number;
  meal_type: "lunch" | "dinner";
  name: string;
  dishes: string;
  price: string;
  image_url: string;
  is_active: boolean;
};

const EMPTY: Draft = {
  meal_type: "lunch",
  name: "",
  dishes: "",
  price: "",
  image_url: "/images/",
  is_active: true,
};

export default function AdminMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tab, setTab] = useState<"lunch" | "dinner">("lunch");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => api.get<MenuItem[]>("/menu?include_inactive=true", false).then(setItems),
    [],
  );
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  function edit(i: MenuItem) {
    setDraft({
      id: i.id,
      meal_type: i.meal_type,
      name: i.name,
      dishes: i.dishes.join(", "),
      price: String(i.price),
      image_url: i.image_url,
      is_active: i.is_active,
    });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const payload = {
        meal_type: draft.meal_type,
        name: draft.name,
        dishes: draft.dishes.split(",").map((s) => s.trim()).filter(Boolean),
        price: parseFloat(draft.price),
        image_url: draft.image_url,
        is_active: draft.is_active,
      };
      if (draft.id) await api.patch(`/menu/${draft.id}`, payload);
      else await api.post("/menu", payload);
      setDraft(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(i: MenuItem) {
    if (i.is_active) await api.del(`/menu/${i.id}`);
    else await api.patch(`/menu/${i.id}`, { is_active: true });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-chai">Menu manager</h1>
        <button className="btn-primary" onClick={() => setDraft({ ...EMPTY, meal_type: tab })}>
          + Add item
        </button>
      </div>
      <p className="text-xs text-chai/60">
        Changes take effect immediately. Existing subscriptions keep their snapshotted
        per-plate price. Admin uses this menu when entering ad-hoc orders.
      </p>

      <div className="flex gap-1 rounded-xl bg-masala-50 p-1 text-sm font-semibold">
        {(["lunch", "dinner"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setTab(m)}
            className={`flex-1 rounded-lg py-1.5 capitalize transition ${
              tab === m ? "bg-white text-masala-700 shadow" : "text-chai/60"
            }`}
          >
            {m} menu
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.filter((i) => i.meal_type === tab).map((i) => (
          <div key={i.id} className={`card flex gap-3 p-3 ${i.is_active ? "" : "opacity-60"}`}>
            <MealImage src={i.image_url} alt={i.name} className="h-20 w-20 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="pill bg-masala-100 capitalize text-masala-700">{i.meal_type}</span>
                {!i.is_active && <span className="pill bg-rose-100 text-rose-700">inactive</span>}
              </div>
              <div className="mt-1 truncate font-semibold text-chai">{i.name}</div>
              <div className="line-clamp-2 text-xs text-chai/60">{i.dishes.join(", ")}</div>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-display font-bold text-masala-700">{rupees(i.price)}</span>
                <button className="text-xs font-semibold text-masala-600 hover:underline" onClick={() => edit(i)}>
                  Edit
                </button>
                <button className="text-xs font-semibold text-chai/60 hover:underline" onClick={() => toggle(i)}>
                  {i.is_active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-cream p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-chai">
                {draft.id ? "Edit item" : "New item"}
              </h2>
              <button className="text-2xl leading-none" onClick={() => setDraft(null)}>
                ×
              </button>
            </div>
            <div className="grid gap-3">
              <div>
                <label className="label">Meal</label>
                <select
                  className="input"
                  value={draft.meal_type}
                  onChange={(e) => setDraft({ ...draft, meal_type: e.target.value as "lunch" | "dinner" })}
                >
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                </select>
              </div>
              <div>
                <label className="label">Name</label>
                <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Dishes (comma separated)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={draft.dishes}
                  onChange={(e) => setDraft({ ...draft, dishes: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Price (₹)</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
              </div>
              <div>
                <label className="label">Image URL</label>
                <input
                  className="input"
                  value={draft.image_url}
                  onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                  placeholder="/images/lunch-rajma-chawal.png"
                />
              </div>
              <button className="btn-primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
