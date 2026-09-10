"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatButton, Section, SectionHead } from "@/components/site/SiteBits";
import { Icon } from "@/components/ui";
import { api } from "@/lib/api";
import type { ServiceArea } from "@/lib/types";

export default function AreasPage() {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get<ServiceArea[]>("/service-areas", false).then(setAreas).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return areas;
    return areas.filter(
      (a) => a.name.toLowerCase().includes(t) || a.pincode.includes(t),
    );
  }, [areas, q]);

  return (
    <div>
      <Section>
        <SectionHead
          eyebrow="Areas We Serve"
          title="Do we deliver to you?"
          sub="Search your neighbourhood or pincode. Not listed yet? Message us — we add new routes every month."
        />

        <div className="mx-auto mt-8 max-w-md">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-3 h-5 w-5 text-ink-faint" />
            <input
              className="input pl-10"
              placeholder="Area name or pincode"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <div key={a.id} className="card flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Icon name="area" className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-brand-800">{a.name}</div>
                <div className="text-xs text-ink-faint">{a.pincode || "Serviceable"}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-ink-faint">
              No match. Message us on WhatsApp — we may still be able to help.
            </p>
          )}
        </div>

        <div className="mt-12 rounded-2xl bg-brand-50 p-8 text-center">
          <h3 className="text-xl font-bold text-brand-800">Don&apos;t see your area?</h3>
          <p className="mt-2 text-ink-soft">Tell us where you are and we&apos;ll see what we can do.</p>
          <div className="mt-5 flex justify-center">
            <ChatButton className="btn-primary" />
          </div>
        </div>
      </Section>
    </div>
  );
}
