"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/panel/PanelBits";
import { ErrorBanner, Pager, Spinner, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { FoodRequest, FoodRequestStatus, Paginated } from "@/lib/types";

const STATUSES: FoodRequestStatus[] = ["new", "reviewed", "added_to_menu", "declined"];

export default function AdminFoodRequests() {
  const [data, setData] = useState<Paginated<FoodRequest> | null>(null);
  const [status, setStatus] = useState<"all" | FoodRequestStatus>("all");
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (status !== "all") params.set("status", status);
    const d = await api.get<Paginated<FoodRequest>>(`/admin/food-requests?${params}`);
    setData(d);
  }, [page, status]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function changeStatus(row: FoodRequest, next: FoodRequestStatus) {
    setBusyId(row.id);
    setErr(null);
    try {
      await api.patch(`/admin/food-requests/${row.id}`, { status: next });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update this request");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Food Requests"
        subtitle="Dishes customers have suggested. Review them here — nothing changes on the real menu until you add it yourself in the menu manager."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as typeof status);
            }}
          >
            <option value="all">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <ErrorBanner>{err}</ErrorBanner>}
      {!data && !err && <Spinner />}

      {data && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-brand-100">
                <th className="th">Customer</th>
                <th className="th">Requested item</th>
                <th className="th">Notes</th>
                <th className="th">Date</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td className="td">
                    <div className="font-medium text-ink">{r.customer_name}</div>
                    <div className="text-[11px] text-ink-faint">{r.customer_phone}</div>
                  </td>
                  <td className="td font-medium text-ink">{r.requested_item}</td>
                  <td className="td max-w-[240px] text-ink-soft">{r.notes || "—"}</td>
                  <td className="td text-ink-soft">{fmtDate(r.created_at.slice(0, 10))}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <StatusPill status={r.status} />
                      <select
                        className="input w-auto py-1 text-xs"
                        value={r.status}
                        disabled={busyId === r.id}
                        onChange={(e) => changeStatus(r, e.target.value as FoodRequestStatus)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="td text-center text-ink-faint">
                    No food requests{status !== "all" ? ` with status "${status.replace(/_/g, " ")}"` : ""} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && <Pager page={page} pageSize={data.page_size} total={data.total} onPage={setPage} />}
    </div>
  );
}
