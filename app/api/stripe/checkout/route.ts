import { Plan } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import {
  STRIPE_PRICE_IDS,
  decideAccessForStatus,
  getAppUrl,
  getCustomerId,
  getStripeClient,
  isKnownPriceId,
} from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import Stripe from "stripe";

type CheckoutBody = {
  priceId?: unknown;
};

function error(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: message, ...(code ? { code } : {}) },
    { status },
  );
}

/** 8 random lowercase letters for Stripe's integration_identifier. */
function randomSuffix(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += letters[b % letters.length];
  return out;
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch {
    return error("Unauthorized", 401, "UNAUTHORIZED");
  }

  // Malformed JSON body.
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return error("Invalid request body.", 400, "INVALID_BODY");
  }

  // Whitelist the price id — never trust a raw client-supplied Stripe id.
  const priceKey =
    typeof body.priceId === "string" ? body.priceId : null;
  if (!priceKey) {
    return error("Price ID is required.", 400, "PRICE_REQUIRED");
  }
  const stripePriceId =
    STRIPE_PRICE_IDS[priceKey as keyof typeof STRIPE_PRICE_IDS];
  if (!stripePriceId || !isKnownPriceId(stripePriceId)) {
    return error("Invalid price ID.", 400, "INVALID_PRICE");
  }

  const appUrl = getAppUrl();
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
  if (!user.email) {
    return error(
      "Your account has no email address. Add one before subscribing.",
      400,
      "EMAIL_REQUIRED",
    );
  }

  try {
    // Resolve (or recover) the Stripe customer. A stored id may be stale
    // if the customer was deleted in the Stripe dashboard.
    let customerId = user.stripeCustomerId;
    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId);
        if (existing.deleted) {
          customerId = null;
        } else if (
          typeof existing !== "string" &&
          existing.email !== user.email
        ) {
          // Keep Stripe in sync when the user changed their email.
          await stripe.customers.update(customerId, { email: user.email });
        }
      } catch (err) {
        if (
          err instanceof Stripe.errors.StripeError &&
          err.code === "resource_missing"
        ) {
          customerId = null;
        } else {
          throw err;
        }
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // If we already track a subscription, check its live status so a stale
    // DB row can't permanently block re-subscribing (e.g. webhook delayed
    // or missed). Anything but a terminal state blocks a second checkout —
    // the user should fix the existing subscription via the portal.
    if (user.stripeSubscriptionId) {
      try {
        const current = await stripe.subscriptions.retrieve(
          user.stripeSubscriptionId,
        );
        if (getCustomerId(current.customer) !== customerId) {
          // Subscription belongs to a different (orphaned) customer record;
          // fall through and let checkout create a fresh subscription.
        } else {
          const decision = decideAccessForStatus(current.status);
          if (decision === "grant") {
            return error(
              "You already have an active subscription. Manage it from billing.",
              409,
              "ALREADY_SUBSCRIBED",
            );
          }
          if (decision === "keep") {
            return error(
              `Your subscription needs attention (${current.status}). ` +
                `Manage it from billing instead of starting a new one.`,
              409,
              "SUBSCRIPTION_ATTENTION",
            );
          }
          // Terminal state: Stripe says it's over. Heal the local record so
          // the user can subscribe again instead of being stuck.
          await db.user.update({
            where: { id: user.id },
            data: {
              plan: Plan.FREE,
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
            },
          });
        }
      } catch (err) {
        // Deleted on Stripe's side — clear the reference and continue.
        if (
          err instanceof Stripe.errors.StripeError &&
          err.code === "resource_missing"
        ) {
          await db.user.update({
            where: { id: user.id },
            data: {
              plan: Plan.FREE,
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
            },
          });
        } else {
          throw err;
        }
      }
    } else if (user.plan === Plan.PREMIUM) {
      // No subscription id but flag says premium — inconsistent state.
      // Heal it rather than dead-ending the user.
      await db.user.update({
        where: { id: user.id },
        data: { plan: Plan.FREE },
      });
    }

    // Idempotency: one key per attempt. Checkout sessions are single-use
    // and expire, so a day-bucketed key would replay stale URLs — generate
    // a fresh key so every checkout attempt gets a usable session.
    // (Double-clicks are already suppressed client-side via the pending state.)
    const idempotencyKey = `checkout:${user.id}:${stripePriceId}:${randomUUID()}`;

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: "subscription",
        // Never set payment_method_types: omitting it enables Stripe's
        // dynamic payment methods (best conversion, managed from Dashboard).
        // https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods.md
        client_reference_id: user.id,
        integration_identifier: `better-auth-billing-${randomSuffix()}`,
        customer_update: { address: "auto" },
        billing_address_collection: "auto",
        allow_promotion_codes: true,
        line_items: [{ price: stripePriceId, quantity: 1 }],
        subscription_data: {
          metadata: { userId: user.id, priceId: stripePriceId },
        },
        metadata: { userId: user.id, priceId: stripePriceId },
        success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/pricing?canceled=1`,
      },
      { idempotencyKey },
    );

    if (!checkoutSession.url) {
      return error(
        "Could not create a checkout session. Try again.",
        502,
        "NO_CHECKOUT_URL",
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Stripe Checkout Error:", err);

    if (err instanceof Stripe.errors.StripeError) {
      if (err.type === "StripeCardError") {
        return error(err.message, 402, "CARD_ERROR");
      }
      if (err.type === "StripeRateLimitError") {
        return error(
          "Too many requests. Try again in a moment.",
          503,
          "RATE_LIMITED",
        );
      }
      if (err.type === "StripeInvalidRequestError") {
        return error(
          "Invalid payment request. Contact support if this persists.",
          400,
          "INVALID_REQUEST",
        );
      }
      if (
        err.type === "StripeConnectionError" ||
        err.type === "StripeAPIError"
      ) {
        return error(
          "Payment provider is unavailable. Try again shortly.",
          502,
          "PROVIDER_UNAVAILABLE",
        );
      }
      return error(err.message, err.statusCode ?? 500, "STRIPE_ERROR");
    }

    return error("Internal Server Error", 500, "INTERNAL_ERROR");
  }
}
