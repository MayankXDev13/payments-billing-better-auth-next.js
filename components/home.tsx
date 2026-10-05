"use client";

import { authClient } from "@/lib/auth-client";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";

const flow = [
  {
    label: "AUTH",
    title: "Sign in once",
    body: "Better Auth keeps the session. Email and password, Google, or GitHub — every billing action checks it first.",
  },
  {
    label: "CHECKOUT",
    title: "Pay on Stripe",
    body: "One hosted Checkout Session per plan. No card numbers touch this app, and double-clicks can't double-charge.",
  },
  {
    label: "LEDGER",
    title: "Webhooks keep score",
    body: "Renewals, failed payments, and cancellations land as events. Your plan follows the subscription, not the other way around.",
  },
];

const HomeView = () => {
  const { data: session, isPending } = authClient.useSession();

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-200">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero — the thesis: billing that reads like a ledger. */}
        <section className="grid gap-12 py-20 md:grid-cols-[1.2fr_0.8fr] md:py-28">
          <div className="rise">
            <p className="font-mono text-xs tracking-[0.25em] text-orange-400/90">
              SUBSCRIPTIONS · STRIPE · BETTER AUTH
            </p>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] text-[#F5F1E8] md:text-7xl">
              Billing that reads like a{" "}
              <em className="text-orange-400">ledger.</em>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-neutral-400">
              One plan, one price, one source of truth. Sign in, subscribe,
              and every renewal writes itself into your account.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/pricing"
                className="rounded-xl bg-orange-500 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                See pricing
              </Link>
              <Link
                href="/dashboard"
                className="rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold text-neutral-200 transition hover:border-orange-500/60 hover:text-white"
              >
                Open dashboard
              </Link>
            </div>
          </div>

          {/* Signature: a standing ledger entry for the plan itself. */}
          <div
            className="rise rounded-3xl border border-white/8 bg-[#131316] p-8"
            style={{ animationDelay: "120ms" }}
          >
            <p className="font-mono text-[11px] tracking-[0.2em] text-neutral-500">
              STANDING ENTRY
            </p>
            <p className="mt-4 font-display text-4xl italic text-[#F5F1E8]">
              Premium
            </p>
            <div className="my-6 h-px bg-white/8" />
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between">
                <dt className="font-mono text-xs tracking-widest text-neutral-500">
                  PRICE
                </dt>
                <dd className="font-mono tabular-nums text-neutral-200">
                  $10.00 / mo
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-mono text-xs tracking-widest text-neutral-500">
                  BILLING
                </dt>
                <dd className="font-mono tabular-nums text-neutral-200">
                  Monthly
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-mono text-xs tracking-widest text-neutral-500">
                  CANCEL
                </dt>
                <dd className="font-mono tabular-nums text-neutral-200">
                  Anytime
                </dd>
              </div>
            </dl>
            <div className="my-6 border-t border-dashed border-white/15" />
            <p className="text-sm text-neutral-500">
              {isPending
                ? "Checking your account…"
                : session
                  ? `Signed in as ${session.user.name}.`
                  : "Sign in to write your first entry."}
            </p>
          </div>
        </section>

        {/* The money flow, in order — numbering earns its place here. */}
        <section className="grid gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/8 md:grid-cols-3">
          {flow.map((step, i) => (
            <div
              key={step.label}
              className="rise bg-[#0e0e11] p-8"
              style={{ animationDelay: `${200 + i * 100}ms` }}
            >
              <p className="font-mono text-xs tracking-[0.25em] text-orange-400/90">
                {step.label}
              </p>
              <h2 className="mt-4 font-display text-2xl text-[#F5F1E8]">
                {step.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                {step.body}
              </p>
            </div>
          ))}
        </section>

        <footer className="flex items-center justify-between border-t border-white/8 py-8 text-sm text-neutral-600">
          <p className="font-mono text-xs tracking-widest">
            EMBER BILLING · TEST MODE
          </p>
          <p>No real charges. Ever.</p>
        </footer>
      </main>
    </div>
  );
};

export default HomeView;
