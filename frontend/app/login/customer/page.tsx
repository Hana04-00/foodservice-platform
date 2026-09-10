"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { api, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/session";
import type { TokenOut } from "@/lib/types";

export default function CustomerLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    pin: "",
    pincode: "",
    address: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const path =
        mode === "login" ? "/auth/customer/login" : "/auth/customer/register";
      const payload =
        mode === "login"
          ? { phone: form.phone, pin: form.pin }
          : form;
      const res = await api.post<TokenOut>(path, payload, false);
      saveSession(res.access_token, res.role, res.user);
      router.push("/subscription");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Something went wrong");
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
        <div className="mb-5 flex gap-1 rounded-xl bg-masala-50 p-1 text-sm font-semibold">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setErr(null);
              }}
              className={`flex-1 rounded-lg py-2 capitalize transition ${
                mode === m ? "bg-white text-masala-700 shadow" : "text-chai/60"
              }`}
            >
              {m === "login" ? "Log in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="grid gap-3">
          {mode === "register" && (
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Aarti Sharma"
              />
            </div>
          )}
          <div>
            <label className="label">Phone number</label>
            <input
              className="input"
              required
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="9000000001"
            />
          </div>
          <div>
            <label className="label">4-digit PIN</label>
            <input
              className="input tracking-[0.5em]"
              required
              inputMode="numeric"
              maxLength={4}
              type="password"
              value={form.pin}
              onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
            />
          </div>
          {mode === "register" && (
            <>
              <div>
                <label className="label">Pincode</label>
                <input
                  className="input"
                  value={form.pincode}
                  onChange={(e) => set("pincode", e.target.value)}
                  placeholder="560001"
                />
              </div>
              <div>
                <label className="label">Address</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Flat, street, area"
                />
              </div>
            </>
          )}

          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
          )}

          <button className="btn-primary mt-1" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account & continue"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-chai/60">
          Demo customers: phone <b>9000000001</b>–<b>9000000005</b>, PIN <b>1234</b>
        </p>
      </div>

      <Link href="/login/admin" className="mt-6 text-center text-sm text-masala-600 hover:underline">
        Owner? Go to admin login →
      </Link>
    </main>
  );
}
