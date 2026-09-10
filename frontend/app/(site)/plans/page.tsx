"use client";

import { useEffect, useState } from "react";
import { ChatButton, PlanCard, Section, SectionHead } from "@/components/site/SiteBits";
import { Icon } from "@/components/ui";
import { api } from "@/lib/api";
import { WHY_CHOOSE_US } from "@/lib/siteContent";
import type { Plan } from "@/lib/types";

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    api.get<Plan[]>("/plans", false).then(setPlans).catch(() => {});
  }, []);

  return (
    <div>
      <Section>
        <SectionHead
          eyebrow="Plans & Pricing"
          title="Simple monthly plans"
          sub="Billed for meals actually served. Cancel before the cutoff and the value is carried forward as credit."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
      </Section>

      <div className="bg-cream-50">
        <Section>
          <SectionHead title="Every plan includes" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {WHY_CHOOSE_US.map((f) => (
              <div key={f.title} className="flex gap-3">
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                <div>
                  <div className="font-semibold text-brand-800">{f.title}</div>
                  <p className="text-sm text-ink-soft">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <ChatButton className="btn-primary" label="Enquire on WhatsApp" />
          </div>
        </Section>
      </div>
    </div>
  );
}
