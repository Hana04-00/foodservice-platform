"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChatButton,
  MealCard,
  PlanCard,
  Section,
  SectionHead,
  TrustIcon,
} from "@/components/site/SiteBits";
import { Icon, MealImage } from "@/components/ui";
import { api } from "@/lib/api";
import {
  ABOUT_PARAGRAPHS,
  MENU_PREVIEW_SLUGS,
  TESTIMONIALS,
  TESTIMONIAL_VIDEOS,
  TRUST_ICONS,
  WHY_CHOOSE_US,
} from "@/lib/siteContent";
import type { MenuItem, Plan, ServiceArea } from "@/lib/types";

export default function HomePage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [areas, setAreas] = useState<ServiceArea[]>([]);

  useEffect(() => {
    api.get<MenuItem[]>("/menu", false).then(setMenu).catch(() => {});
    api.get<Plan[]>("/plans", false).then(setPlans).catch(() => {});
    api.get<ServiceArea[]>("/service-areas", false).then(setAreas).catch(() => {});
  }, []);

  const popular = MENU_PREVIEW_SLUGS.map((slug) => {
    const m = menu.find((x) => x.image_url.includes(slug));
    return m
      ? { slug, name: m.name, price: m.price }
      : { slug, name: slug.replace(/^(lunch|dinner)-/, "").replace(/-/g, " "), price: 120 };
  });

  return (
    <div>
      {/* -------------------------------------------------- hero */}
      <section className="bg-gradient-to-b from-brand-50 to-cream-100">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div>
            <p className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
              Fresh · Home-style · Delivered daily
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-brand-800 md:text-5xl">
              Food Dose Tiffin Service
              <br />
              <span className="text-brand-600">on time, every day.</span>
            </h1>
            <p className="mt-4 max-w-md text-ink-soft">
              A hot, balanced tiffin cooked in small batches and delivered on the weekdays you
              choose. Cancel before the cutoff and the value carries forward — no meal wasted.
            </p>

            <div className="mt-7 grid max-w-md grid-cols-2 gap-4">
              {TRUST_ICONS.map((t) => (
                <TrustIcon key={t.label} {...t} />
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/menu" className="btn-primary">
                View Menu
              </Link>
              <ChatButton className="btn-ghost" />
            </div>
          </div>

          <div className="relative">
            <MealImage
              src="/images/hero-tiffin.svg"
              alt="A freshly packed home-style tiffin"
              className="w-full rounded-3xl border border-brand-100 object-cover shadow-card"
            />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- about */}
      <Section id="about">
        <SectionHead eyebrow="About Us" title="A home kitchen that grew up" center={false} />
        <div className="mt-6 grid gap-4 text-ink-soft md:grid-cols-3">
          {ABOUT_PARAGRAPHS.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------- popular meals */}
      <div className="bg-cream-50">
        <Section>
          <SectionHead
            eyebrow="Popular Meals"
            title="This week from the kitchen"
            sub="A rotating menu of homestyle thalis. The full list lives on the Menu page."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((m) => (
              <MealCard key={m.slug} {...m} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/menu" className="btn-ghost">
              View Full Menu
            </Link>
          </div>
        </Section>
      </div>

      {/* -------------------------------------------------- why choose us */}
      <Section>
        <SectionHead eyebrow="Why Choose Us" title="Built around one honest rule" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_CHOOSE_US.map((f) => (
            <div key={f.title} className="card p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Icon name="check" className="h-6 w-6" />
              </div>
              <div className="mt-3 font-semibold text-brand-800">{f.title}</div>
              <p className="mt-1 text-sm text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------- plans */}
      <div className="bg-brand-50">
        <Section id="plans">
          <SectionHead
            eyebrow="Plans & Pricing"
            title="Pick a plan that fits your week"
            sub="Every plan is billed monthly for the meals actually served. Skipped meals become carry-forward credit."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/plans" className="btn-ghost">
              View All Plans
            </Link>
          </div>
        </Section>
      </div>

      {/* -------------------------------------------------- testimonials */}
      <Section>
        <SectionHead eyebrow="Customer Testimonials" title="What subscribers say" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="card p-6">
              <blockquote className="text-ink-soft">“{t.quote}”</blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-brand-800">
                {t.name}
                <span className="font-normal text-ink-faint"> · {t.area}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------- testimonial videos */}
      <div className="bg-cream-50">
        <Section>
          <SectionHead eyebrow="Testimonial Videos" title="Hear it from them" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {TESTIMONIAL_VIDEOS.map((v) => (
              <div key={v.title} className="card overflow-hidden">
                <video
                  controls
                  preload="none"
                  poster={v.poster}
                  className="aspect-video w-full bg-brand-900 object-cover"
                >
                  <source src={v.src} type="video/mp4" />
                </video>
                <div className="p-4 text-sm font-semibold text-brand-800">{v.title}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* -------------------------------------------------- areas */}
      <Section id="areas">
        <SectionHead
          eyebrow="Operating Locations"
          title="Areas we serve"
          sub="We deliver a fresh tiffin to these neighbourhoods every working day."
        />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {areas.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-800"
            >
              <Icon name="area" className="h-4 w-4 text-brand-500" />
              {a.name}
              {a.pincode && <span className="text-ink-faint">{a.pincode}</span>}
            </span>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/areas" className="text-sm font-semibold text-brand-600 hover:underline">
            Check your area →
          </Link>
        </div>
      </Section>

      {/* -------------------------------------------------- closing CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-brand-800 md:grid-cols-2">
          <div className="p-8 sm:p-12">
            <h2 className="text-3xl font-bold text-white">Ready for a home-cooked lunch tomorrow?</h2>
            <p className="mt-3 text-brand-100">
              Message us on WhatsApp with your area and preferred meal. We&apos;ll set up your plan
              and your first tiffin can go out the next working day.
            </p>
            <div className="mt-6">
              <ChatButton className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-50" />
            </div>
          </div>
          <MealImage
            src="/images/dinner-sunday.svg"
            alt="A home-style thali"
            className="h-full min-h-[220px] w-full object-cover"
          />
        </div>
      </section>
    </div>
  );
}
