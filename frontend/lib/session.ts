"use client";

import type { UserOut } from "./types";

// Admin and customer sessions are stored under separate keys so logging in as
// one role in a tab/window never silently clobbers the other's session (both
// used to share a single "gt_token"/"gt_role" pair — logging in as a customer
// while an admin tab was open overwrote the admin's token, and the admin tab
// kept sending that customer token until a request failed with a confusing
// "Admin access required" error). Reads/clears infer which session is "current"
// from the URL — every page in this app lives either under /admin or under the
// customer panel / public site, so the path always matches the role in play.
const PREFIX = "gt_";

function scopeFromPath(): "admin" | "customer" {
  if (typeof window === "undefined") return "customer";
  return window.location.pathname.startsWith("/admin") ? "admin" : "customer";
}

function keysFor(scope: "admin" | "customer") {
  return {
    token: `${PREFIX}token_${scope}`,
    role: `${PREFIX}role_${scope}`,
    user: `${PREFIX}user_${scope}`,
  };
}

export function saveSession(token: string, role: string, user?: UserOut | null) {
  if (typeof window === "undefined") return;
  const k = keysFor(role === "admin" ? "admin" : "customer");
  localStorage.setItem(k.token, token);
  localStorage.setItem(k.role, role);
  if (user) localStorage.setItem(k.user, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(keysFor(scopeFromPath()).token);
}

export function getRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(keysFor(scopeFromPath()).role);
}

export function getUser(): UserOut | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(keysFor(scopeFromPath()).user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserOut;
  } catch {
    return null;
  }
}

export function setUser(user: UserOut) {
  if (typeof window === "undefined") return;
  localStorage.setItem(keysFor(scopeFromPath()).user, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  const k = keysFor(scopeFromPath());
  localStorage.removeItem(k.token);
  localStorage.removeItem(k.role);
  localStorage.removeItem(k.user);
}
