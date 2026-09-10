"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatButton, Section, SectionHead } from "@/components/site/SiteBits";
import { MealImage, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import type { MenuItem } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

const GROUPS: { key: string; label: string }[] = [
  { key: "lunch", label: "Lunch thalis" },
  { key: "dinner", label: "Dinner bowls" },
];

export default function MenuPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(() => {
    setState("loading");
    api
      .get<MenuItem[]>("/menu", false)
      .then((items) => {
        setMenu(Array.isArray(items) ? items : []);
        setState("ready");
      })
      .catch((err) => {
        console.error("Failed to load menu:", err);
        setState("error");
      });
  }, []);

  useEffect(load, [load]);

  // Bucket items by meal_type, but never drop one because of an unexpected value.
  const norm = (m: MenuItem) => (m.meal_type ?? "").toString().trim().toLowerCase();
  const known = new Set(GROUPS.map((g) => g.key));
  const sections = [
    ...GROUPS.map((g) => ({
      label: g.label,
      items: menu.filter((m) => norm(m) === g.key),
    })),
    { label: "More from the kitchen", items: menu.filter((m) => !known.has(norm(m))) },
  ].filter((s) => s.items.length > 0);

  return (
    <div>
      <Section>
        <SectionHead
          eyebrow="Menu"
          title="This is what home tastes like"
          sub="A fixed weekly rotation. Every thali comes with roti, rice, a sabzi, dal and a little something extra."
        />

        {state === "loading" && (
          <p className="mt-12 text-center text-ink-soft">Loading this week&apos;s menu…</p>
        )}

        {state === "error" && (
          <div className="mt-12 rounded-2xl bg-danger-100 p-6 text-center">
            <p className="font-semibold text-danger-700">
              We couldn&apos;t load the menu just now.
            </p>
            <button onClick={load} className="btn-ghost mt-4">
              Try again
            </button>
          </div>
        )}

        {state === "ready" && sections.length === 0 && (
          <p className="mt-12 text-center text-ink-soft">
            The menu is being updated — message us on WhatsApp for this week&apos;s thalis.
          </p>
        )}

        {sections.map((section) => (
          <div key={section.label} className="mt-12">
            <h3 className="text-xl font-bold text-brand-800">{section.label}</h3>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((m) => (
                <div key={m.id} className="card overflow-hidden">
                  <MealImage src={m.image_url} alt={m.name} className="h-44 w-full object-cover" />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-brand-800">{m.name}</div>
                      <div className="shrink-0 text-sm font-semibold text-brand-600">
                        {rupees(m.price)}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {(m.dishes ?? []).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-14 rounded-2xl bg-brand-50 p-8 text-center">
          <h3 className="text-xl font-bold text-brand-800">Like what you see?</h3>
          <p className="mt-2 text-ink-soft">Message us to start a plan around this menu.</p>
          <div className="mt-5 flex justify-center">
            <ChatButton className="btn-primary" />
          </div>
        </div>
      </Section>
    </div>
  );
}
