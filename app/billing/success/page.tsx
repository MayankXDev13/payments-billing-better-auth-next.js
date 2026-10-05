import { auth } from "@/lib/auth";
import { getStripeClient } from "@/lib/stripe";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

function Card({
  title,
  body,
  hint,
}: {
  title: string;
  body: string;
  hint?: string;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-neutral-800 bg-neutral-900 p-10 text-center">
      <h1 className="text-3xl font-bold text-white">{title}</h1>
      <p className="mt-4 text-neutral-400">{body}</p>
      {hint ? <p className="mt-2 text-sm text-neutral-500">{hint}</p> : null}
      <div className="mt-8 flex justify-center gap-4">
        <Link
          href="/dashboard"
          className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Go to dashboard
        </Link>
        <Link
          href="/pricing"
          className="rounded-xl border border-neutral-700 bg-neutral-800 px-6 py-3 text-sm font-semibold text-white hover:border-orange-500"
        >
          View plans
        </Link>
      </div>
    </div>
  );
}

export default async function BillingSuccessPage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { session_id: sessionId } = await searchParams;
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-neutral-950 px-6 py-20">
        <Card
          title="Missing checkout reference"
          body="We couldn't find a checkout session. If you just paid, your webhook confirmation may still be on its way."
          hint="Check the dashboard — your plan updates automatically once payment confirms."
        />
      </div>
    );
  }

  let checkout: Stripe.Checkout.Session;
  try {
    checkout = await getStripeClient().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
  } catch (err) {
    console.error("Success page session lookup failed:", err);
    return (
      <div className="min-h-screen bg-neutral-950 px-6 py-20">
        <Card
          title="Couldn't verify payment"
          body="This checkout reference looks invalid or expired. If money left your account, contact support."
          hint={`Reference: ${sessionId}`}
        />
      </div>
    );
  }

  // Guard: don't leak one user's receipt to another logged-in account.
  const ownerId =
    checkout.client_reference_id ?? checkout.metadata?.userId ?? null;
  if (ownerId && ownerId !== session.user.id) {
    return (
      <div className="min-h-screen bg-neutral-950 px-6 py-20">
        <Card
          title="Checkout belongs to another account"
          body="You're signed in with a different account than the one that checked out. Sign in with the purchasing account to see your plan."
        />
      </div>
    );
  }

  if (
    checkout.payment_status === "paid" ||
    checkout.payment_status === "no_payment_required"
  ) {
    return (
      <div className="min-h-screen bg-neutral-950 px-6 py-20">
        <Card
          title="You're on Premium 🎉"
          body="Payment confirmed. Your subscription is active — if the dashboard doesn't show it yet, give it a few seconds and refresh."
          hint={`Reference: ${checkout.id}`}
        />
      </div>
    );
  }

  if (checkout.status === "expired") {
    return (
      <div className="min-h-screen bg-neutral-950 px-6 py-20">
        <Card
          title="Checkout expired"
          body="This checkout session expired before payment completed. No charge was made — start a new checkout to subscribe."
        />
      </div>
    );
  }

  // Open / unpaid: payment may still be processing (e.g. async methods).
  return (
    <div className="min-h-screen bg-neutral-950 px-6 py-20">
      <Card
        title="Payment processing"
        body="Your payment hasn't confirmed yet. You'll get Premium automatically once it clears — no need to pay twice."
        hint={`Status: ${checkout.payment_status}. Reference: ${checkout.id}`}
      />
    </div>
  );
}
