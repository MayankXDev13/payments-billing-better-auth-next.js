import { Plan } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { STRIPE_PRICE_IDS, stripeClient } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    const { priceId } = await request.json();

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID is required" },
        { status: 400 },
      );
    }

    const stripePriceId =
      STRIPE_PRICE_IDS[priceId as keyof typeof STRIPE_PRICE_IDS];

    if (!stripePriceId) {
      return NextResponse.json(
        { error: "Invalid price ID" },
        { status: 400 },
      );
    }

    const user = await db.user.findUnique({
      where: {
        id: session.user.id,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 },
      );
    }

    if (user.plan === Plan.PREMIUM) {
      return NextResponse.json(
        { error: "You already have an active subscription." },
        { status: 400 },
      );
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });

      customerId = customer.id;

      await db.user.update({
        where: {
          id: user.id,
        },
        data: {
          stripeCustomerId: customerId,
        },
      });
    }

    const checkoutSession = await stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      client_reference_id: user.id,

      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],

      subscription_data: {
        metadata: {
          userId: user.id,
          priceId: stripePriceId,
        },
      },

      metadata: {
        userId: user.id,
        priceId: stripePriceId,
      },

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,

      expand: ["subscription"]
    });

    return NextResponse.json({
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("Stripe Checkout Error:", error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: error.statusCode ?? 500,
        },
      );
    }

    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
          {
            error: "Unauthorized",
          },
          {
            status: 401,
          },
        );
      }

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      {
        status: 500,
      },
    );
  }
}