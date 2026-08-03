import Stripe from "stripe";
import { Plan } from "@prisma/client";
import { db } from "@/lib/db";
import { STRIPE_PRICE_IDS, stripeClient } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("Stripe signature verification failed:", error);

    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }

  try {
    console.log(`Stripe event received: ${event.type}`);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const userId = subscription.metadata.userId;
        const priceId = subscription.metadata.priceId;

        if (!userId || !priceId) {
          console.warn(`Missing metadata for subscription ${subscription.id}`);
          break;
        }

        await db.user.update({
          where: {
            id: userId,
          },
          data: {
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer as string,
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: new Date(
              subscription.items.data[0].current_period_end * 1000,
            ),
            plan:
              priceId === STRIPE_PRICE_IDS.premium ? Plan.PREMIUM : Plan.FREE,
          },
        });

        console.log(`Subscription updated for user ${userId}`);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const userId = subscription.metadata.userId;

        if (!userId) {
          console.warn(`Missing metadata for subscription ${subscription.id}`);
          break;
        }

        await db.user.update({
          where: {
            id: userId,
          },
          data: {
            plan: Plan.FREE,
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
          },
        });

        console.log(`Subscription cancelled for user ${userId}`);

        break;
      }

      case "invoice.payment_succeeded": {
        console.log("Invoice payment succeeded");
        break;
      }

      case "invoice.payment_failed": {
        console.warn("Invoice payment failed");
        break;
      }

      default: {
        console.log(`Unhandled event type: ${event.type}`);
        break;
      }
    }
  } catch (error) {
    console.error("Webhook processing failed:", error);

    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
