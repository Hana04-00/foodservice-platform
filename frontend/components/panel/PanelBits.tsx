"use client";

import { Icon, rupees } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import type { CalendarDay, CalendarResponse } from "@/lib/types";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="section-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CalendarLegend() {
  const items = [
    { label: "Meal Included", cls: "bg-brand-500" },
    { label: "Cancelled", cls: "bg-danger-500" },
    { label: "Credit Used", cls: "bg-amber-400" },
    { label: "One-off Order", cls: "bg-purple-500" },
  ];
  return (
    <div className="flex flex-wrap gap-4 text-xs text-ink-soft">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${i.cls}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function dayDot(meal?: { cancelled: boolean; credit: boolean; scheduled: boolean }) {
  if (!meal) return "bg-transparent";
  if (meal.cancelled && meal.credit) return "bg-amber-400";
  if (meal.cancelled) return "bg-danger-500";
  return "bg-brand-500";
}

export function MonthCalendar({
  data,
  selected,
  onSelect,
  onPrev,
  onNext,
}: {
  data: CalendarResponse;
  selected?: string;
  onSelect?: (d: CalendarDay) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const blanks = Array.from({ length: data.first_weekday });
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <button className="rounded-lg p-1.5 text-ink-soft hover:bg-brand-50" onClick={onPrev} aria-label="Previous month">
          <Icon name="chevron-left" className="h-5 w-5" />
        </button>
        <div className="text-sm font-bold text-brand-800">{data.month_label}</div>
        <button className="rounded-lg p-1.5 text-ink-soft hover:bg-brand-50" onClick={onNext} aria-label="Next month">
          <Icon name="chevron-right" className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-ink-faint">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {data.days.map((day) => {
          const isSel = selected === day.date;
          const hasAny = Object.keys(day.meals).length > 0 || day.orders.length > 0;
          return (
            <button
              key={day.date}
              onClick={() => onSelect?.(day)}
              disabled={!onSelect}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition ${
                isSel
                  ? "border-brand-500 bg-brand-50"
                  : day.is_today
                    ? "border-brand-300 bg-white"
                    : "border-transparent hover:bg-brand-50"
              } ${onSelect ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`leading-none ${
                  day.is_today ? "font-bold text-brand-700" : "text-ink"
                }`}
              >
                {Number(day.date.slice(8, 10))}
              </span>
              <span className="mt-1 flex h-2 gap-0.5">
                {hasAny && (
                  <>
                    <span className={`h-1.5 w-1.5 rounded-full ${dayDot(day.meals.lunch)}`} />
                    {day.meals.dinner && (
                      <span className={`h-1.5 w-1.5 rounded-full ${dayDot(day.meals.dinner)}`} />
                    )}
                    {day.orders.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                    )}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DayDetailPanel({
  day,
  noticeHours,
  onCancel,
  onCancelOrder,
}: {
  day: CalendarDay | null;
  noticeHours: string;
  onCancel: (mealType: "lunch" | "dinner") => void;
  onCancelOrder?: (orderId: number) => void;
}) {
  if (!day) {
    return (
      <div className="card p-5 text-sm text-ink-faint">Pick a day on the calendar to see its meals.</div>
    );
  }
  const meals = (["lunch", "dinner"] as const).filter((m) => day.meals[m]);
  const orders = day.orders ?? [];
  return (
    <div className="card p-5">
      <div className="text-sm font-bold text-brand-800">{fmtDate(day.date)}</div>
      {meals.length === 0 && orders.length === 0 && (
        <p className="mt-3 text-sm text-ink-faint">No meals scheduled for this day.</p>
      )}
      <div className="mt-3 space-y-3">
        {meals.map((m) => {
          const meal = day.meals[m]!;
          return (
            <div key={m} className="rounded-xl border border-brand-100 p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold capitalize text-ink">
                  <Icon name={m} className="h-4 w-4 text-brand-500" />
                  {m}
                </span>
                {meal.cancelled ? (
                  <span className="pill bg-danger-100 text-danger-700">Cancelled</span>
                ) : (
                  <span className="pill bg-brand-100 text-brand-800">Included</span>
                )}
              </div>
              <div className="mt-1 text-sm text-ink-soft">{meal.dish}</div>
              {!meal.cancelled && (
                <button
                  className="btn-danger-ghost mt-3 w-full py-1.5 text-xs disabled:opacity-40"
                  disabled={meal.locked}
                  onClick={() => onCancel(m)}
                >
                  {meal.locked ? "Past cutoff — locked" : "Cancel Meal"}
                </button>
              )}
            </div>
          );
        })}
        {orders.map((o) => (
          <div key={o.id} className="rounded-xl border border-purple-200 bg-purple-50/40 p-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold capitalize text-ink">
                <Icon name={o.meal_type} className="h-4 w-4 text-brand-500" />
                {o.meal_type}
                <span className="pill bg-purple-100 text-purple-800">One-off order</span>
              </span>
              {o.cancelled ? (
                <span className="pill bg-danger-100 text-danger-700">Cancelled</span>
              ) : (
                <span className="pill capitalize bg-brand-100 text-brand-800">{o.status}</span>
              )}
            </div>
            <div className="mt-1 text-sm text-ink-soft">
              {o.dish} · {rupees(o.amount)}
            </div>
            {!o.cancelled && o.status !== "delivered" && onCancelOrder && (
              <button
                className="btn-danger-ghost mt-3 w-full py-1.5 text-xs disabled:opacity-40"
                disabled={o.locked}
                onClick={() => onCancelOrder(o.id)}
              >
                {o.locked ? "Past cutoff — locked" : "Cancel Order"}
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        Cancellation allowed up to {noticeHours} hours before meal time.
      </p>
    </div>
  );
}
