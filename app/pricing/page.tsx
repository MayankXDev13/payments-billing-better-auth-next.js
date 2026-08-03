import { AuthGuard } from "@/components/AuthGuard";
import { PricingCards } from "@/components/PricingCards";

const pricingTiers = [
  {
    id: "free",
    name: "Free",
    price: 0,
    priceId: null,
    currency: "USD",
    interval: "month",
    features: [
      "Access to basic features",
      "Limited usage",
      "Community support",
    ],
    isPopular: false,
  },
  {
    id: "premium",
    name: "Premium",
    price: 10,
    priceId: "premium",
    currency: "USD",
    interval: "month",
    features: [
      "All Free features",
      "Unlimited usage",
      "Priority support",
      "Access to premium content",
    ],
    isPopular: true,
  },
];

export default async function PricingPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-neutral-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1 text-sm font-medium text-orange-400">
              Pricing
            </span>

            <h1 className="mt-6 text-5xl font-bold tracking-tight">
              Simple, Transparent Pricing
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-400">
              Choose the perfect plan for your workflow. Upgrade anytime.
            </p>
          </div>

          <PricingCards tiers={pricingTiers} />
        </div>
      </div>
    </AuthGuard>
  );
}