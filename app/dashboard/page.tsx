import { ManageBillingButton } from "@/components/ManageBillingButton";
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
    <div className="min-h-screen bg-neutral-950 px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <p className="mt-2 text-neutral-400">
          Signed in as {user.name} ({user.email})
        </p>

        <div className="mt-8 rounded-3xl border border-neutral-800 bg-neutral-900 p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Subscription</h2>
            <span
              className={`rounded-full px-4 py-1 text-sm font-medium ${
                isPremium
                  ? "bg-orange-500/10 text-orange-400"
                  : "bg-neutral-800 text-neutral-300"
              }`}
            >
              {user.plan}
            </span>
          </div>

          {isPremium ? (
            <div className="mt-4 space-y-1 text-sm text-neutral-400">
              {status ? <p>Status: {status}</p> : null}
              {periodEnd ? (
                <p>
                  Renews:{" "}
                  {periodEnd.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              ) : null}
              {cancelAtPeriodEnd ? (
                <p className="text-yellow-400">
                  Cancels at the end of the billing period.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-neutral-400">
              You&apos;re on the Free plan. Upgrade for unlimited usage and
              priority support.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-4">
            {user.stripeCustomerId ? (
              <ManageBillingButton />
            ) : (
              <Link
                href="/pricing"
                className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Upgrade to Premium
              </Link>
            )}
            {!isPremium && user.stripeCustomerId ? (
              <Link
                href="/pricing"
                className="rounded-xl border border-neutral-700 bg-neutral-800 px-6 py-3 text-sm font-semibold text-white hover:border-orange-500"
              >
                View plans
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
