"use client";

import { PanelShell, type NavItem } from "@/components/panel/PanelShell";
import { useAuthGuard } from "@/lib/hooks";

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/subscription", label: "My Subscription", icon: "subscription" },
  { href: "/calendar", label: "Meal Calendar", icon: "calendar" },
  { href: "/history", label: "Meal History", icon: "history" },
  { href: "/cancel", label: "Cancel Meals", icon: "cancel" },
  { href: "/credits", label: "Credits & Carry Forward", icon: "credit" },
  { href: "/profile", label: "Profile & Address", icon: "profile" },
  { href: "/invoices", label: "Invoices", icon: "invoice" },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const ready = useAuthGuard("customer");
  if (!ready) return null;
  return (
    <PanelShell nav={NAV} badge="Customer">
      {children}
    </PanelShell>
  );
}
