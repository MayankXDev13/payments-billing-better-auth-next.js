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
      if (data.code === "ALREADY_SUBSCRIBED") {
        setAlreadySubscribed(true);
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

      <div className="grid gap-8 md:grid-cols-2">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`group relative overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_25px_80px_rgba(249,115,22,0.15)]
            ${
              tier.isPopular
                ? "border-orange-500 bg-linear-to-b from-neutral-900 to-black"
                : "border-neutral-800 bg-neutral-900"
            }`}
          >
            {/* Orange Glow */}
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              <div className="absolute left-1/2 top-0 h-52 w-52 -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl" />
            </div>

            {/* Popular Badge */}
            {tier.isPopular && (
              <div className="absolute right-5 top-5 z-20 flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5" />
                Most Popular
              </div>
            )}

            <div className="relative z-10 p-8">
              <h3 className="text-3xl font-bold text-white">{tier.name}</h3>

              <div className="mt-8 flex items-end">
                <span className="text-6xl font-extrabold text-white">
                  ${tier.price}
                </span>

                <span className="mb-2 ml-2 text-neutral-400">
                  /{tier.interval}
                </span>
              </div>

              <div className="my-8 h-px bg-neutral-800" />

              <ul className="space-y-5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/15">
                      <Check className="h-4 w-4 text-orange-400" />
                    </div>

                    <span className="text-neutral-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(tier)}
                disabled={pendingId !== null}
                className={`mt-10 w-full rounded-xl py-3 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                  tier.isPopular
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "border border-neutral-700 bg-neutral-800 text-white hover:border-orange-500 hover:bg-neutral-950"
                }`}
              >
                {tier.price === 0
                  ? "Get Started"
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
