"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Sparkles } from "lucide-react";

type PricingTier = {
  id: string;
  name: string;
  price: number;
  priceId: string | null;
  currency: string;
  interval: string;
  features: string[];
  isPopular: boolean;
};

interface PricingCardsProps {
  tiers: PricingTier[];
}

function CanceledNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get("canceled") !== "1") return null;
  return (
    <div className="mb-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-6 py-4 text-center text-sm text-yellow-300">
      Checkout was canceled — no charge was made. Pick a plan whenever
      you&apos;re ready.
    </div>
  );
}

function Cards({ tiers }: PricingCardsProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  const handleSubscribe = async (tier: PricingTier) => {
    if (!tier.priceId || pendingId) return;
    setPendingId(tier.id);
    setError(null);
    setAlreadySubscribed(false);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: tier.priceId }),
      });
      const data = (await response.json()) as {
        url?: string;
        error?: string;
        code?: string;
      };

      if (response.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (
        data.code === "ALREADY_SUBSCRIBED" ||
        data.code === "SUBSCRIPTION_ATTENTION"
      ) {
        setAlreadySubscribed(true);
        if (data.code === "SUBSCRIPTION_ATTENTION" && data.error) {
          setError(data.error);
        }
        return;
      }
      setError(data.error ?? "Failed to create checkout session.");
    } catch (err) {
      console.error(err);
      setError("Network error. Check your connection and try again.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div>
      <CanceledNotice />

      {error ? (
        <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-center text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {alreadySubscribed ? (
        <div className="mb-8 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-6 py-4 text-center text-sm text-orange-300">
          You already have an active subscription.{" "}
          <a href="/dashboard" className="font-semibold underline">
            Manage it from the dashboard
          </a>
          .
        </div>
      ) : null}

      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        {tiers.map((tier, i) => (
          <div
            key={tier.id}
            style={{ animationDelay: `${i * 120}ms` }}
            className={`rise group relative overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1.5
            ${
              tier.isPopular
                ? "border-orange-500/70 bg-[#131316] shadow-[0_25px_80px_rgba(249,115,22,0.12)]"
                : "border-white/8 bg-[#101013]"
            }`}
          >
            {/* Popular Badge */}
            {tier.isPopular && (
              <div className="absolute right-5 top-5 z-20 flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5" />
                Most popular
              </div>
            )}

            <div className="relative z-10 p-8">
              <p className="font-mono text-[11px] tracking-[0.25em] text-neutral-500">
                {tier.isPopular ? "PAID · MONTHLY" : "FREE · FOREVER"}
              </p>
              <h3 className="mt-3 font-display text-4xl italic text-[#F5F1E8]">
                {tier.name}
              </h3>

              <div className="mt-6 flex items-end gap-2">
                <span className="font-mono text-6xl tabular-nums tracking-tight text-[#F5F1E8]">
                  ${tier.price}
                </span>
                <span className="mb-2 font-mono text-sm text-neutral-500">
                  /{tier.interval}
                </span>
              </div>

              <div className="my-8 h-px bg-white/8" />

              <ul className="space-y-4">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="h-4 w-4 shrink-0 text-orange-400" />
                    <span className="text-[15px] text-neutral-300">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(tier)}
                disabled={pendingId !== null}
                className={`mt-10 w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                  tier.isPopular
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "border border-white/10 bg-white/5 text-neutral-200 hover:border-orange-500/60 hover:text-white"
                }`}
              >
                {tier.price === 0
                  ? "Get started"
                  : pendingId === tier.id
                    ? "Redirecting…"
                    : "Subscribe"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PricingCards({ tiers }: PricingCardsProps) {
  return (
    <Suspense>
      <Cards tiers={tiers} />
    </Suspense>
  );
}
