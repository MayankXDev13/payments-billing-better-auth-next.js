"use client";

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

export function PricingCards({ tiers }: PricingCardsProps) {


  const handleSubscribe = async (priceId: string | null) => {
    if (!priceId) {
      return
    }


    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priceId })
      })

      const { url } = await response.json()
      if (url) {
        window.location.href = url;  // redirect to stripe checkout page
      } else {
        console.log('Failed to create checkout session')
      }

    } catch (error) {
      console.log(error)
    }

  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {tiers.map((tier) => (
        <div
          key={tier.id}
          className={`group relative overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_25px_80px_rgba(249,115,22,0.15)]
            ${tier.isPopular
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
              onClick={() => handleSubscribe(tier.priceId)}
              className={`mt-10 w-full rounded-xl py-3 text-sm font-semibold transition-all duration-300 ${tier.isPopular
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "border border-neutral-700 bg-neutral-800 text-white hover:border-orange-500 hover:bg-neutral-950"
                }`}
            >
              {tier.price === 0 ? "Get Started" : "Subscribe"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}