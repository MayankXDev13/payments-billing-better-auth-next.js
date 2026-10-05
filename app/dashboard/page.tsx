import { ManageBillingButton } from "@/components/ManageBillingButton";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeClient, getSubscriptionPeriodEnd } from "@/lib/stripe";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  // Prefer live Stripe state; fall back to the DB row when Stripe is
  // unreachable so the dashboard still renders.
  let status: Stripe.Subscription.Status | null = null;
  let cancelAtPeriodEnd: boolean | null = null;
  let periodEnd: Date | null = user.stripeCurrentPeriodEnd;

  if (user.stripeSubscriptionId) {
    try {
      const subscription = await getStripeClient().subscriptions.retrieve(
        user.stripeSubscriptionId,
        { expand: ["items"] },
      );
      status = subscription.status;
      cancelAtPeriodEnd = subscription.cancel_at_period_end;
      periodEnd = getSubscriptionPeriodEnd(subscription) ?? periodEnd;
    } catch (err) {
      console.error("Dashboard subscription lookup failed:", err);
    }
  }

  const isPremium = user.plan === "PREMIUM";

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-200">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="rise">
          <p className="font-mono text-xs tracking-[0.25em] text-orange-400/90">
            ACCOUNT LEDGER
          </p>
          <h1 className="mt-4 font-display text-5xl text-[#F5F1E8]">
            Hi, <em>{user.name?.split(" ")[0] ?? "there"}</em>.
          </h1>
          <p className="mt-3 font-mono text-sm text-neutral-500">
            {user.email}
          </p>
        </div>

        <section
          className="rise mt-10 rounded-3xl border border-white/8 bg-[#131316] p-8"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[11px] tracking-[0.25em] text-neutral-500">
              CURRENT PLAN
            </p>
            <span
              className={`rounded-full px-4 py-1 font-mono text-xs tracking-widest ${
                isPremium
                  ? "bg-orange-500/10 text-orange-300"
                  : "bg-white/5 text-neutral-400"
              }`}
            >
              {user.plan}
            </span>
          </div>

          <p className="mt-4 font-display text-4xl italic text-[#F5F1E8]">
            {isPremium ? "Premium" : "Free"}
          </p>

          <div className="my-6 h-px bg-white/8" />

          {isPremium ? (
            <dl className="space-y-4 text-sm">
              {status && (
                <div className="flex justify-between">
                  <dt className="font-mono text-xs tracking-widest text-neutral-500">
                    STATUS
                  </dt>
                  <dd className="font-mono tabular-nums text-neutral-200">
                    {status}
                  </dd>
                </div>
              )}
              {periodEnd && (
                <div className="flex justify-between">
                  <dt className="font-mono text-xs tracking-widest text-neutral-500">
                    {cancelAtPeriodEnd ? "ENDS" : "RENEWS"}
                  </dt>
                  <dd className="font-mono tabular-nums text-neutral-200">
                    {periodEnd.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </dd>
                </div>
              )}
              {cancelAtPeriodEnd && (
                <p className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
                  Cancels at the end of the billing period. Resubscribe from
                  billing to stay on Premium.
                </p>
              )}
            </dl>
          ) : (
            <p className="text-[15px] leading-relaxed text-neutral-400">
              Free covers the basics. Premium removes the limits for $10 a
              month — cancel anytime, keep access until the period ends.
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-4">
            {user.stripeCustomerId ? (
              <ManageBillingButton />
            ) : (
              <Link
                href="/pricing"
                className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Upgrade to Premium
              </Link>
            )}
            {!isPremium && user.stripeCustomerId ? (
              <Link
                href="/pricing"
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-neutral-200 transition hover:border-orange-500/60 hover:text-white"
              >
                View plans
              </Link>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
