"use client";

import { getToken } from "./session";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export const api = {
  get: <T>(p: string, auth = true) => request<T>(p, { auth }),
  post: <T>(p: string, body?: unknown, auth = true) =>
    request<T>(p, { method: "POST", body, auth }),
  patch: <T>(p: string, body?: unknown, auth = true) =>
    request<T>(p, { method: "PATCH", body, auth }),
  put: <T>(p: string, body?: unknown, auth = true) =>
    request<T>(p, { method: "PUT", body, auth }),
  del: <T>(p: string, auth = true) => request<T>(p, { method: "DELETE", auth }),
};
