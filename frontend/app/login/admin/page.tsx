"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { ErrorBanner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/session";
import type { TokenOut } from "@/lib/types";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await api.post<TokenOut>("/auth/admin/login", { username, password }, false);
      saveSession(res.access_token, res.role, null);
      router.push("/admin");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-8 self-start">
        <Logo className="text-lg" />
      </Link>
      <div className="card p-6">
        <h1 className="text-xl font-bold text-brand-800">Kitchen owner sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">Admin dashboard, demand &amp; reports.</p>
        <form onSubmit={submit} className="mt-5 grid gap-3">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err && <ErrorBanner>{err}</ErrorBanner>}
          <button className="btn-primary mt-1" disabled={busy}>
            {busy ? "Please wait…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-faint">
          Demo: <b>admin</b> / <b>admin123</b>
        </p>
      </div>
      <Link href="/login/customer" className="mt-6 text-center text-sm text-brand-600 hover:underline">
        ← Customer login
      </Link>
    </main>
  );
}
