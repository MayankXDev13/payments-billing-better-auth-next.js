import { Plan } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  decideAccessForStatus,
  getCustomerId,
  getPlanForPriceId,
  getStripeClient,
  getSubscriptionPeriodEnd,
  isPremiumPriceId,
} from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Webhook updates are idempotent (same event data -> same row state), so
 *  Stripe redeliveries are safe to process more than once. */

async function findUserByCustomerId(customerId: string) {
  return db.user.findFirst({ where: { stripeCustomerId: customerId } });
}

type SyncOptions = {
  /** Set for `customer.subscription.deleted`: clears the subscription id. */
  cleared?: boolean;
};

/**
 * Reconciles one Stripe subscription into our user row.
 * Returns normally for every outcome — including "user unknown" — so the
 * route can ACK (2xx) and stop Stripe from retrying poison events.
 */
async function syncSubscription(
  stripe: Stripe,
  subscriptionId: string,
  fallback?: { userId?: string | null; priceId?: string | null },
  options?: SyncOptions,
): Promise<void> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items"],
  });

  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    console.warn(`Subscription ${subscription.id} has no customer; skipping.`);
    return;
  }

  const userIdFromMetadata =
    subscription.metadata?.userId ?? fallback?.userId ?? null;

  // Resolve through Stripe's object graph first (the Customer is the
  // first-class ownership boundary); metadata is only an explicit fallback.
  // https://docs.stripe.com/billing/subscriptions/webhooks.md#refund-events
  const user =
    (customerId ? await findUserByCustomerId(customerId) : null) ??
    (userIdFromMetadata
      ? await db.user.findUnique({ where: { id: userIdFromMetadata } })
      : null);

  if (!user) {
    console.warn(
      `No user for subscription ${subscription.id} (customer ${customerId}); skipping.`,
    );
    return;
  }

  const itemPriceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const priceId =
    itemPriceId ??
    subscription.metadata?.priceId ??
    fallback?.priceId ??
    null;

  if (priceId && !isPremiumPriceId(priceId)) {
    console.warn(
      `Unknown price ${priceId} on subscription ${subscription.id}; ` +
        `known plan mapping: ${getPlanForPriceId(priceId)}. ` +
        `Access still follows subscription status.`,
    );
  }

  const periodEnd = getSubscriptionPeriodEnd(subscription);

  if (options?.cleared || subscription.status === "canceled") {
    await db.user.update({
      where: { id: user.id },
      data: {
        plan: Plan.FREE,
        stripeSubscriptionId: options?.cleared ? null : subscription.id,
        stripeCustomerId: customerId,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      },
    });
    console.log(
      `Subscription ${subscription.status} for user ${user.id}; downgraded to FREE.`,
    );
    return;
  }

  const decision = decideAccessForStatus(subscription.status);

  if (decision === "grant") {
    await db.user.update({
      where: { id: user.id },
      data: {
        plan: Plan.PREMIUM,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        ...(periodEnd ? { stripeCurrentPeriodEnd: periodEnd } : {}),
      },
    });
    console.log(
      `Subscription ${subscription.status} for user ${user.id}; set PREMIUM.`,
    );
    return;
  }

  if (decision === "revoke") {
    await db.user.update({
      where: { id: user.id },
      data: {
        plan: Plan.FREE,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      },
    });
    console.log(
      `Subscription ${subscription.status} for user ${user.id}; downgraded to FREE.`,
    );
    return;
  }

  // Transient state (past_due / incomplete / paused / trial edge): refresh
  // identifiers and period end, but never flap the plan — the next
  // terminal event or a recovered payment decides access.
  await db.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      ...(priceId ? { stripePriceId: priceId } : {}),
      ...(periodEnd ? { stripeCurrentPeriodEnd: periodEnd } : {}),
    },
  });
  console.log(
    `Subscription ${subscription.status} for user ${user.id}; plan kept (${user.plan}).`,
  );
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSub === "string") return parentSub;
  if (parentSub && typeof parentSub === "object" && "id" in parentSub) {
    return parentSub.id;
  }
  const legacy = (
    invoice as unknown as {
      subscription?: string | Stripe.Subscription | null;
    }
  ).subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object") return legacy.id;
  return null;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured.");
    return error("Webhook not configured.", 500);
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (err) {
    console.error("Stripe misconfigured:", err);
    return error("Payments are not configured.", 500);
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return error("Missing Stripe signature.", 400);
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return error("Invalid webhook signature.", 400);
  }

  try {
    console.log(`Stripe event received: ${event.type} (${event.id})`);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;

        if (checkoutSession.mode !== "subscription") break;

        // Fulfill only when the session isn't unpaid: with delayed-notification
        // payment methods, `completed` arrives while still unpaid, and the
        // async event carries the final outcome.
        if (checkoutSession.payment_status === "unpaid") {
          console.warn(
            `Checkout ${checkoutSession.id} is unpaid (${event.type}); ` +
              `waiting for the async outcome.`,
          );
          break;
        }

        const subscriptionId =
          typeof checkoutSession.subscription === "string"
            ? checkoutSession.subscription
            : checkoutSession.subscription?.id ?? null;

        if (!subscriptionId) {
          console.warn(
            `Checkout ${checkoutSession.id} has no subscription; skipping.`,
          );
          break;
        }

        await syncSubscription(stripe, subscriptionId, {
          userId:
            checkoutSession.client_reference_id ??
            checkoutSession.metadata?.userId ??
            null,
          priceId: checkoutSession.metadata?.priceId ?? null,
        });
        break;
      }

      case "checkout.session.async_payment_failed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        console.warn(
          `Checkout async payment failed: ${checkoutSession.id}. ` +
            `No access granted; user can retry checkout.`,
        );
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(stripe, subscription.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        try {
          await syncSubscription(stripe, subscription.id, undefined, {
            cleared: true,
          });
        } catch (err) {
          // The subscription is gone — reconcile from the event payload.
          if (
            err instanceof Stripe.errors.StripeError &&
            err.code === "resource_missing"
          ) {
            const customerId = getCustomerId(subscription.customer);
            const userId = subscription.metadata?.userId ?? null;
            const user = userId
              ? await db.user.findUnique({ where: { id: userId } })
              : customerId
                ? await findUserByCustomerId(customerId)
                : null;
            if (!user) {
              console.warn(
                `Deleted subscription ${subscription.id} matches no user; skipping.`,
              );
              break;
            }
            await db.user.update({
              where: { id: user.id },
              data: {
                plan: Plan.FREE,
                stripeSubscriptionId: null,
                stripePriceId: null,
                stripeCurrentPeriodEnd: null,
              },
            });
            console.log(
              `Subscription deleted for user ${user.id}; downgraded to FREE.`,
            );
          } else {
            throw err;
          }
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);
        if (!subscriptionId) break; // One-off invoice; nothing to sync.
        await syncSubscription(stripe, subscriptionId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(
          `Invoice payment failed: ${invoice.id} ` +
            `(customer ${getCustomerId(invoice.customer) ?? "unknown"}). ` +
            `Plan unchanged — Stripe will retry; the subscription's ` +
            `terminal event decides access.`,
        );
        break;
      }

      default: {
        console.log(`Unhandled event type: ${event.type}`);
        break;
      }
    }
  } catch (err) {
    // Unknown user rows must not trigger Stripe retries forever.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      console.warn("Webhook referenced a deleted user; acknowledging.", err);
      return NextResponse.json({ received: true });
    }

    console.error("Webhook processing failed:", err);
    return error("Webhook processing failed.", 500);
  }

  return NextResponse.json({ received: true });
}
