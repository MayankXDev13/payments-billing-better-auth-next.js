import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { getStripeClient } from "@/lib/stripe";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-200">
      <SiteHeader />
      <main className="px-6 py-20">{children}</main>
    </div>
  );
}

/** A receipt, not a modal: perforation, mono reference, one serif verdict. */
function Receipt({
  stamp,
  stampTone,
  title,
  body,
  hint,
}: {
  stamp: string;
  stampTone: "paid" | "warn" | "muted";
  title: string;
  body: string;
  hint?: string;
}) {
  const tone =
    stampTone === "paid"
      ? "border-orange-500/60 text-orange-300"
      : stampTone === "warn"
        ? "border-yellow-500/50 text-yellow-200"
        : "border-white/15 text-neutral-400";
  return (
    <div className="rise mx-auto max-w-md rounded-3xl border border-white/8 bg-[#131316] p-10 text-center">
      <p
        className={`inline-block -rotate-3 rounded-lg border-2 px-4 py-1 font-mono text-xs tracking-[0.25em] ${tone}`}
      >
        {stamp}
      </p>
      <h1 className="mt-6 font-display text-4xl italic text-[#F5F1E8]">
        {title}
      </h1>
      <p className="mt-4 leading-relaxed text-neutral-400">{body}</p>
      <div className="my-8 border-t border-dashed border-white/15" />
      {hint ? (
        <p className="font-mono text-xs leading-relaxed break-all text-neutral-600">
          {hint}
        </p>
      ) : null}
      <div className="mt-8 flex justify-center gap-4">
        <Link
          href="/dashboard"
          className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          Go to dashboard
        </Link>
        <Link
          href="/pricing"
          className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-neutral-200 transition hover:border-orange-500/60 hover:text-white"
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
      <Frame>
        <Receipt
          title="Missing checkout reference"
          body="We couldn't find a checkout session. If you just paid, your webhook confirmation may still be on its way."
          hint="CHECK THE DASHBOARD — YOUR PLAN UPDATES ONCE PAYMENT CONFIRMS"
          stamp="NO REFERENCE"
          stampTone="muted"
        />
      </Frame>
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
      <Frame>
        <Receipt
          title="Couldn't verify payment"
          body="This checkout reference looks invalid or expired. If money left your account, contact support."
          hint={`REF ${sessionId}`}
          stamp="UNVERIFIED"
          stampTone="muted"
        />
      </Frame>
    );
  }

  // Guard: don't leak one user's receipt to another logged-in account.
  const ownerId =
    checkout.client_reference_id ?? checkout.metadata?.userId ?? null;
  if (ownerId && ownerId !== session.user.id) {
    return (
      <Frame>
        <Receipt
          title="Wrong account"
          body="You're signed in with a different account than the one that checked out. Sign in with the purchasing account to see your plan."
          stamp="MISMATCH"
          stampTone="warn"
        />
      </Frame>
    );
  }

  if (
    checkout.payment_status === "paid" ||
    checkout.payment_status === "no_payment_required"
  ) {
    return (
      <Frame>
        <Receipt
          title="You're on Premium"
          body="Payment confirmed. Your subscription is active — if the dashboard doesn't show it yet, give it a few seconds and refresh."
          hint={`REF ${checkout.id}`}
          stamp="PAID"
          stampTone="paid"
        />
      </Frame>
    );
  }

  if (checkout.status === "expired") {
    return (
      <Frame>
        <Receipt
          title="Checkout expired"
          body="This checkout session expired before payment completed. No charge was made — start a new checkout to subscribe."
          stamp="EXPIRED"
          stampTone="muted"
        />
      </Frame>
    );
  }

  // Open / unpaid: payment may still be processing (e.g. async methods).
  return (
    <Frame>
      <Receipt
        title="Payment processing"
        body="Your payment hasn't confirmed yet. You'll get Premium automatically once it clears — no need to pay twice."
        hint={`${checkout.payment_status.toUpperCase()} · REF ${checkout.id}`}
        stamp="PENDING"
        stampTone="warn"
      />
    </Frame>
  );
}
