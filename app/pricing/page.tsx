import { AuthGuard } from "@/components/AuthGuard";
import { PricingCards } from "@/components/PricingCards";
import { SiteHeader } from "@/components/SiteHeader";

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
      <div className="min-h-screen bg-[#09090b] text-neutral-200">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="rise mb-16 text-center">
            <p className="font-mono text-xs tracking-[0.25em] text-orange-400/90">
              PLANS
            </p>
            <h1 className="mx-auto mt-6 max-w-2xl font-display text-5xl leading-tight text-[#F5F1E8] md:text-6xl">
              Two entries. <em className="text-orange-400">Pick one.</em>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-400">
              Free forever, or Premium for the price of two coffees. Cancel
              anytime from the dashboard.
            </p>
          </div>

          <PricingCards tiers={pricingTiers} />

          <p className="mt-12 text-center font-mono text-xs tracking-widest text-neutral-600">
            TEST MODE · NO REAL CHARGES · CANCEL ANYTIME
          </p>
        </div>
      </div>
    </AuthGuard>
  );
}
