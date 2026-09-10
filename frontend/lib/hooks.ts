"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { getRole, getToken } from "./session";
import type { SiteSettings } from "./types";

const SITE_FALLBACK: SiteSettings = {
  business_name: "Ghar Se Tiffin",
  tagline: "Home-style meals, delivered fresh every day.",
  whatsapp_number: "919000000000",
  contact_phone: "+91 90000 00000",
  contact_email: "hello@gharsetiffin.example",
  service_hours: "Mon-Sat | Lunch 12-2 PM, Dinner 7-9 PM",
  cancellation_notice_hours: "4",
};

let _siteCache: SiteSettings | null = null;

/** Public business settings (WhatsApp number, contact, tagline). Cached per load. */
export function useSiteSettings(): SiteSettings {
  const [s, setS] = useState<SiteSettings>(_siteCache || SITE_FALLBACK);
  useEffect(() => {
    if (_siteCache) return;
    api
      .get<SiteSettings>("/site/settings", false)
      .then((res) => {
        _siteCache = { ...SITE_FALLBACK, ...res };
        setS(_siteCache);
      })
      .catch(() => {});
  }, []);
  return s;
}

/**
 * Poll a loader on an interval and whenever the tab regains focus. This is how
 * the admin views stay live — every order/cancel anywhere hits the same DB, so a
 * short poll surfaces it with no manual refresh.
 */
export function usePoll<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  intervalMs = 15000,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const savedLoader = useRef(loader);
  savedLoader.current = loader;

  const run = useCallback(async () => {
    try {
      const d = await savedLoader.current();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    const id = setInterval(run, intervalMs);
    const onFocus = () => run();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs]);

  return { data, error, loading, reload: run };
}

/** Client-side route guard. Returns true once the correct role is confirmed. */
export function useAuthGuard(role: "customer" | "admin") {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getToken() || getRole() !== role) {
      router.replace(role === "admin" ? "/login/admin" : "/login/customer");
    } else {
      setReady(true);
    }
  }, [router, role]);
  return ready;
}
