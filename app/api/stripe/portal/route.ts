import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { getAppUrl, getStripeClient } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function error(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: message, ...(code ? { code } : {}) },
    { status },
  );
}

/**
 * Creates a Stripe Billing Portal session so customers can update payment
 * methods, view invoices, cancel, or resume their subscription.
 */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch {
    return error("Unauthorized", 401, "UNAUTHORIZED");
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (err) {
    console.error("Stripe misconfigured:", err);
    return error("Payments are not configured.", 500, "STRIPE_MISCONFIGURED");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) return error("User not found.", 404, "USER_NOT_FOUND");

  if (!user.stripeCustomerId) {
    // No Stripe customer yet — nothing to manage. The client should send
    // the user through checkout instead.
    return error(
      "No billing account yet. Subscribe first.",
      400,
      "NO_CUSTOMER",
    );
  }

  // The stored customer may have been deleted in the Stripe dashboard.
  try {
    const customer = await stripe.customers.retrieve(user.stripeCustomerId);
    if (typeof customer === "string" || customer.deleted) {
      await db.user.update({
        where: { id: user.id },
        data: {
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          stripeCurrentPeriodEnd: null,
        },
      });
      return error(
        "Billing account not found. Subscribe again.",
        400,
        "CUSTOMER_DELETED",
      );
    }
  } catch (err) {
    if (
      err instanceof Stripe.errors.StripeError &&
      err.code === "resource_missing"
    ) {
      await db.user.update({
        where: { id: user.id },
        data: {
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          stripeCurrentPeriodEnd: null,
        },
      });
      return error(
        "Billing account not found. Subscribe again.",
        400,
        "CUSTOMER_DELETED",
      );
    }
    console.error("Stripe customer lookup failed:", err);
    return error(
      "Payment provider is unavailable. Try again shortly.",
      502,
      "PROVIDER_UNAVAILABLE",
    );
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${getAppUrl()}/dashboard`,
    });
    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("Stripe Portal Error:", err);
    if (err instanceof Stripe.errors.StripeError) {
      return error(err.message, err.statusCode ?? 500, "STRIPE_ERROR");
    }
    return error("Internal Server Error", 500, "INTERNAL_ERROR");
  }
}
