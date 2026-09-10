"use client";

import { ChatButton, Section, SectionHead } from "@/components/site/SiteBits";
import { Icon } from "@/components/ui";
import { useSiteSettings } from "@/lib/hooks";

export default function ContactPage() {
  const s = useSiteSettings();
  return (
    <Section>
      <SectionHead
        eyebrow="Contact"
        title="Talk to the kitchen"
        sub="The fastest way to start, change or pause a plan is a WhatsApp message. We usually reply within the hour during service times."
      />

      <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-3">
        {[
          { icon: "whatsapp" as const, label: "WhatsApp", value: s.contact_phone },
          { icon: "invoice" as const, label: "Email", value: s.contact_email },
          { icon: "clock" as const, label: "Service hours", value: s.service_hours },
        ].map((c) => (
          <div key={c.label} className="card p-5 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Icon name={c.icon} className="h-6 w-6" />
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {c.label}
            </div>
            <div className="mt-1 text-sm font-medium text-brand-800">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <ChatButton className="btn-primary" label="Enquire on WhatsApp" />
      </div>

      <p className="mt-6 text-center text-xs text-ink-faint">
        Cancellation window: up to {s.cancellation_notice_hours} hours before the meal. Cancelled meals
        become carry-forward credit on your account.
      </p>
    </Section>
  );
}
