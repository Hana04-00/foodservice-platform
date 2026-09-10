"use client";

import type { UserOut } from "./types";

const TOKEN_KEY = "gt_token";
const ROLE_KEY = "gt_role";
const USER_KEY = "gt_user";

export function saveSession(token: string, role: string, user?: UserOut | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ROLE_KEY);
}

export function getUser(): UserOut | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserOut;
  } catch {
    return null;
  }
}

export function setUser(user: UserOut) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_KEY);
}
