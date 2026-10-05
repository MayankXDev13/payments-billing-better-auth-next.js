import { Plan } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { getStripeClient, getSubscriptionPeriodEnd } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * Read-only view of the caller's subscription. Prefers live Stripe state
 * when a subscription id is stored (so a delayed webhook can't lie to the
 * UI), and falls back to the DB row when Stripe is unreachable.
 */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) {
    return NextResponse.json(
      { error: "User not found.", code: "USER_NOT_FOUND" },
      { status: 404 },
    );
  }

  const base = {
    plan: user.plan,
    status: null as Stripe.Subscription.Status | null,
    stripePriceId: user.stripePriceId,
    currentPeriodEnd: user.stripeCurrentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: null as boolean | null,
    hasCustomer: Boolean(user.stripeCustomerId),
  };

  if (!user.stripeSubscriptionId) {
    return NextResponse.json(base);
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (err) {
    console.error("Stripe misconfigured:", err);
    return NextResponse.json(base);
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
      { expand: ["items"] },
    );
    return NextResponse.json({
      ...base,
      status: subscription.status,
      currentPeriodEnd:
        getSubscriptionPeriodEnd(subscription)?.toISOString() ??
        base.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch (err) {
    if (
      err instanceof Stripe.errors.StripeError &&
      err.code === "resource_missing"
    ) {
      // Subscription deleted on Stripe's side; report effective state.
      return NextResponse.json({
        ...base,
        plan: Plan.FREE,
        status: "canceled" as const,
      });
    }
    console.error("Subscription lookup failed; falling back to DB:", err);
    return NextResponse.json(base);
  }
}
