import { Plan } from "@prisma/client";
import Stripe from "stripe";

let cachedClient: Stripe | null = null;

/**
 * Lazily creates the Stripe client so a missing env var fails at request
 * time with a clear error instead of crashing the build at import time.
 */
export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Add it to your environment.",
    );
  }

  cachedClient = new Stripe(secretKey);
  return cachedClient;
}

/** Backwards-compatible eager client. Prefer getStripeClient(). */
export const stripeClient = new Proxy({} as Stripe, {
  get(_target, prop) {
    return Reflect.get(getStripeClient(), prop);
  },
});

export const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export const STRIPE_PRICE_IDS = {
  premium:
    process.env.STRIPE_PREMIUM_PRICE_ID ??
    "price_1U0JKJK2Sg4YIzRxwYJWJshc",
} as const;

export type KnownPriceKey = keyof typeof STRIPE_PRICE_IDS;

export function isKnownPriceId(priceId: string): boolean {
  return (Object.values(STRIPE_PRICE_IDS) as string[]).includes(priceId);
}

export function isPremiumPriceId(priceId: string | null | undefined): boolean {
  return priceId === STRIPE_PRICE_IDS.premium;
}

/** Resolves the app plan for a Stripe price id. Unknown prices map to FREE. */
export function getPlanForPriceId(
  priceId: string | null | undefined,
): Plan {
  return isPremiumPriceId(priceId) ? Plan.PREMIUM : Plan.FREE;
}

export function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if ("deleted" in customer && customer.deleted) return null;
  return customer.id;
}

type SubscriptionLike = Pick<
  Stripe.Subscription,
  "items" | "trial_end" | "status"
>;

/**
 * Extracts the current period end from a subscription.
 * Prefers the first item's period end; falls back to trial_end.
 * Returns null when the data is unavailable (caller should re-fetch
 * the subscription with `expand: ["items"]` in that case).
 */
export function getSubscriptionPeriodEnd(
  subscription: SubscriptionLike,
): Date | null {
  const itemEnd = subscription.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === "number" && Number.isFinite(itemEnd)) {
    return new Date(itemEnd * 1000);
  }
  if (
    subscription.status === "trialing" &&
    typeof subscription.trial_end === "number"
  ) {
    return new Date(subscription.trial_end * 1000);
  }
  return null;
}

/** Subscription statuses that grant premium access. */
const GRANTS_ACCESS: ReadonlySet<Stripe.Subscription.Status> = new Set([
  "active",
  "trialing",
]);

/** Terminal statuses after which access must be revoked. */
const TERMINAL: ReadonlySet<Stripe.Subscription.Status> = new Set([
  "canceled",
  "incomplete_expired",
  "unpaid",
]);

export type AccessDecision = "grant" | "revoke" | "keep";

/**
 * Maps a Stripe subscription status to an access decision:
 * - active/trialing -> grant PREMIUM
 * - canceled/incomplete_expired/unpaid -> revoke to FREE
 * - past_due/incomplete/paused -> keep current plan (payment may still
 *   succeed on retry; don't flap the user's plan on transient states)
 */
export function decideAccessForStatus(
  status: Stripe.Subscription.Status,
): AccessDecision {
  if (GRANTS_ACCESS.has(status)) return "grant";
  if (TERMINAL.has(status)) return "revoke";
  return "keep";
}
