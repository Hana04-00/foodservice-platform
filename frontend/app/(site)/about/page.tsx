"use client";

import { ChatButton, Section, SectionHead, TrustIcon } from "@/components/site/SiteBits";
import { MealImage } from "@/components/ui";
import { ABOUT_PARAGRAPHS, TRUST_ICONS, WHY_CHOOSE_US } from "@/lib/siteContent";

export default function AboutPage() {
  return (
    <div>
      <Section>
        <SectionHead eyebrow="About Us" title="Cooked like it's for our own table" center={false} />
        <div className="mt-8 grid items-start gap-10 md:grid-cols-2">
          <div className="space-y-4 text-ink-soft">
            {ABOUT_PARAGRAPHS.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
          </div>
          <MealImage
            src="/images/hero-tiffin.svg"
            alt="The kitchen"
            className="w-full rounded-2xl border border-brand-100 object-cover shadow-card"
          />
        </div>

        <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {TRUST_ICONS.map((t) => (
            <TrustIcon key={t.label} {...t} />
          ))}
        </div>
      </Section>

      <div className="bg-cream-50">
        <Section>
          <SectionHead title="How we keep it consistent" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {WHY_CHOOSE_US.map((f) => (
              <div key={f.title} className="card p-5">
                <div className="font-semibold text-brand-800">{f.title}</div>
                <p className="mt-1 text-sm text-ink-soft">{f.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <ChatButton className="btn-primary" />
          </div>
        </Section>
      </div>
    </div>
  );
}
