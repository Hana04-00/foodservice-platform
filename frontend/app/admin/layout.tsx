"use client";

import { useCallback } from "react";
import { PanelShell, type NavItem } from "@/components/panel/PanelShell";
import { api } from "@/lib/api";
import { useAuthGuard, usePoll } from "@/lib/hooks";
import type { AdminDashboardV2 } from "@/lib/types";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const ready = useAuthGuard("admin");
  const load = useCallback(() => api.get<AdminDashboardV2>("/admin/dashboard"), []);
  const { data } = usePoll(load, [], 15000);

  const nav: NavItem[] = [
    { href: "/admin", label: "Admin Dashboard", icon: "dashboard" },
    { href: "/admin/total-meals", label: "Total Meals", icon: "meals" },
    { href: "/admin/cancellations", label: "Cancellations", icon: "cancel" },
    { href: "/admin/customers", label: "Customers", icon: "customers" },
    { href: "/admin/orders", label: "Orders", icon: "leaf", count: data?.new_orders },
    { href: "/admin/meal-demand", label: "Meal Demand", icon: "demand" },
    { href: "/admin/food-requests", label: "Food Requests", icon: "sparkle", count: data?.new_food_requests },
    { href: "/admin/areas", label: "Area-wise Report", icon: "area" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
  ];

  if (!ready) return null;
  return (
    <PanelShell nav={nav} badge="Kitchen Owner">
      {children}
    </PanelShell>
  );
}
