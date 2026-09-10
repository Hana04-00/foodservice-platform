"use client";

import { PanelShell, type NavItem } from "@/components/panel/PanelShell";
import { useAuthGuard } from "@/lib/hooks";

const NAV: NavItem[] = [
  { href: "/admin", label: "Admin Dashboard", icon: "dashboard" },
  { href: "/admin/total-meals", label: "Total Meals", icon: "meals" },
  { href: "/admin/cancellations", label: "Cancellations", icon: "cancel" },
  { href: "/admin/customers", label: "Customers", icon: "customers" },
  { href: "/admin/meal-demand", label: "Meal Demand", icon: "demand" },
  { href: "/admin/areas", label: "Area-wise Report", icon: "area" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const ready = useAuthGuard("admin");
  if (!ready) return null;
  return (
    <PanelShell nav={NAV} badge="Kitchen Owner">
      {children}
    </PanelShell>
  );
}
