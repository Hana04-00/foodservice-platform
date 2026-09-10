"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { getUser, setUser } from "@/lib/session";
import type { UserOut } from "@/lib/types";

export function AddressCard({ onSaved }: { onSaved?: (u: UserOut) => void }) {
  const [user, setLocalUser] = useState<UserOut | null>(getUser());
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState(user?.address ?? "");
  const [pincode, setPincode] = useState(user?.pincode ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const updated = await api.patch<UserOut>("/auth/me/address", { address, pincode });
      setUser(updated);
      setLocalUser(updated);
      setEditing(false);
      onSaved?.(updated);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="label mb-0">Address</div>
          <div className="text-xs text-chai/60">Your profile &amp; contact details</div>
        </div>
        {!editing && (
          <button className="text-sm font-semibold text-masala-600 hover:underline" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 grid gap-2">
          <textarea className="input" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          <input className="input" placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setEditing(false);
                setAddress(user?.address ?? "");
                setPincode(user?.pincode ?? "");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-chai">
          {user?.address || "No address on file yet — add one before ordering."}
          {user?.pincode ? ` · ${user.pincode}` : ""}
        </p>
      )}
    </div>
  );
}
