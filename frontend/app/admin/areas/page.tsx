"use client";

import { useCallback } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { EmptyState, ErrorBanner, Meter, Spinner, StatCard } from "@/components/ui";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/hooks";
import type { AreaReportResponse } from "@/lib/types";

export default function AreaReportPage() {
  const load = useCallback(() => api.get<AreaReportResponse>("/admin/area-report"), []);
  const { data, error, loading } = usePoll(load, [], 20000);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBanner>{error}</ErrorBanner>;
  if (!data) return null;

  const maxCount = Math.max(1, ...data.areas.map((a) => a.customers));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Area-wise Report"
        subtitle="Where your customers are — and how full each delivery route is."
      />

      <div className="sm:max-w-xs">
        <StatCard label="Total Customers" value={data.total_customers} />
      </div>

      {data.areas.length === 0 ? (
        <EmptyState>No service areas configured yet.</EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className="th">Area</th>
                <th className="th">Pincode</th>
                <th className="th text-right">Customers</th>
                <th className="th w-1/2">Route fill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {data.areas.map((a) => (
                <tr key={a.name}>
                  <td className="td font-medium text-ink">{a.name}</td>
                  <td className="td">{a.pincode || "—"}</td>
                  <td className="td text-right font-semibold text-ink">
                    {a.customers}
                    {a.capacity ? <span className="font-normal text-ink-faint"> / {a.capacity}</span> : null}
                  </td>
                  <td className="td">
                    <Meter
                      pct={a.capacity ? a.pct : (a.customers / maxCount) * 100}
                      tone={a.capacity && a.pct >= 95 ? "danger" : "brand"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
