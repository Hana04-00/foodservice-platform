"use client";

import { useEffect, useState } from "react";
import { ChatButton, Section, SectionHead } from "@/components/site/SiteBits";
import { MealImage, rupees } from "@/components/ui";
import { api } from "@/lib/api";
import type { MenuItem } from "@/lib/types";

export default function MenuPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);

  useEffect(() => {
    api.get<MenuItem[]>("/menu", false).then(setMenu).catch(() => {});
  }, []);

  const groups: { key: "lunch" | "dinner"; label: string }[] = [
    { key: "lunch", label: "Lunch thalis" },
    { key: "dinner", label: "Dinner bowls" },
  ];

  return (
    <div>
      <Section>
        <SectionHead
          eyebrow="Menu"
          title="This is what home tastes like"
          sub="A fixed weekly rotation. Every thali comes with roti, rice, a sabzi, dal and a little something extra."
        />

        {groups.map((g) => {
          const items = menu.filter((m) => m.meal_type === g.key);
          if (items.length === 0) return null;
          return (
            <div key={g.key} className="mt-12">
              <h3 className="text-xl font-bold text-brand-800">{g.label}</h3>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((m) => (
                  <div key={m.id} className="card overflow-hidden">
                    <MealImage src={m.image_url} alt={m.name} className="h-44 w-full object-cover" />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-brand-800">{m.name}</div>
                        <div className="shrink-0 text-sm font-semibold text-brand-600">
                          {rupees(m.price)}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-ink-soft">{m.dishes.join(" · ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

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
