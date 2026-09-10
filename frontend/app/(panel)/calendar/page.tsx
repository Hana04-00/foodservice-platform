"use client";

import { useCallback, useEffect, useState } from "react";
import { CancelMealModal, type CancelTarget } from "@/components/panel/CancelMealModal";
import { CalendarLegend, DayDetailPanel, MonthCalendar, PageHeader } from "@/components/panel/PanelBits";
import { ErrorBanner, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { CalendarDay, CalendarResponse } from "@/lib/types";

export default function CalendarPage() {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarDay | null>(null);
  const [cancelFor, setCancelFor] = useState<CancelTarget | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<CalendarResponse>(
        `/panel/meals/calendar?year=${ym.year}&month=${ym.month}`,
      );
      setData(res);
      setErr(null);
      setSelected((prev) => {
        if (prev) {
          const match = res.days.find((d) => d.date === prev.date);
          if (match) return match;
        }
        return res.days.find((d) => d.is_today) ?? res.days[0] ?? null;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load the calendar");
    }
  }, [ym]);

  useEffect(() => {
    load();
  }, [load]);

  if (err && !data) return <ErrorBanner>{err}</ErrorBanner>;
  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Meal Calendar"
        subtitle="Green means the plate is coming. Pick a day to cancel a specific meal."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <MonthCalendar
            data={data}
            selected={selected?.date}
            onSelect={setSelected}
            onPrev={() => setYm(data.prev)}
            onNext={() => setYm(data.next)}
          />
          <CalendarLegend />
        </div>

        <DayDetailPanel
          day={selected}
          noticeHours={data.cancellation_notice_hours}
          onCancel={(mealType) => {
            const meal = selected?.meals[mealType];
            if (!selected || !meal) return;
            setCancelFor({
              subscription_id: meal.subscription_id,
              date: selected.date,
              meal_type: mealType,
              dish: meal.dish,
              amount: meal.amount,
            });
          }}
        />
      </div>

      {cancelFor && (
        <CancelMealModal
          target={cancelFor}
          noticeHours={data.cancellation_notice_hours}
          onClose={() => setCancelFor(null)}
          onDone={() => {
            setCancelFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
