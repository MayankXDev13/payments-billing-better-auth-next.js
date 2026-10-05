# Payments + Billing with Better Auth (Next.js)

Subscription billing with [Stripe](https://stripe.com) + [Better Auth](https://www.better-auth.com) on Next.js 16, Prisma 7, and PostgreSQL (Neon). Users sign in, subscribe to Premium via Stripe Checkout, manage the subscription in the Billing Portal, and the app stays in sync through webhooks.

## Features

- **Auth** — email/password plus Google and GitHub OAuth via Better Auth (Prisma adapter). Session-guarded pages (`AuthGuard`, server-side redirects).
- **Pricing page** (`/pricing`) — Free vs Premium cards with loading, error, already-subscribed, and canceled-checkout states.
- **Checkout** (`POST /api/stripe/checkout`) — authenticated Checkout Session creation with price whitelist, orphaned-customer recovery, Stripe email sync, live duplicate-subscription guard (stale rows healed), per-attempt idempotency keys, promo codes, and dynamic payment methods.
- **Webhooks** (`POST /api/stripe/webhook`) — signature-verified handler for `checkout.session.completed`, `checkout.session.async_payment_succeeded` / `async_payment_failed`, `customer.subscription.created` / `updated` / `deleted`, and `invoice.paid` / `payment_failed`. Subscription status maps to access (`active`/`trialing` → PREMIUM, terminal states → FREE, transient states keep the current plan without flapping). Users resolve via the Stripe Customer object with metadata as fallback; unknown users are ACKed so Stripe stops retrying poison events.
- **Billing Portal** (`POST /api/stripe/portal`) — self-service card updates, invoices, cancellation, and resume.
- **Subscription status** (`GET /api/stripe/subscription`) — read-only view preferring live Stripe state with DB fallback.
- **Success page** (`/billing/success`) — server-side Checkout Session verification (paid / processing / expired / wrong-account states). Fulfillment itself lives in the webhook, never on this page.
- **Dashboard** (`/dashboard`) — plan card with live status, renewal date, cancel-at-period-end notice, and billing management.

Built per the official `stripe-best-practices` skill (dynamic payment methods, async payment events, `integration_identifier`, current SDK).

## Stack

Next.js 16 · React 19 · Better Auth · Prisma 7 (`@prisma/adapter-pg` + `pg` pool) · Stripe · Tailwind CSS 4 · shadcn/ui · pnpm

## Getting started

```bash
pnpm install
cp .env.example .env   # then fill in the values below
```

### 1. Database (Neon)

Create a Postgres database at [neon.tech](https://neon.tech). You need **two** URLs:

| Var | Which one | Used by |
|---|---|---|
| `DATABASE_URL` | Pooled (…`-pooler`…, `channel_binding=require`) | App runtime |
| `DIRECT_URL` | Direct (no `-pooler`) | Prisma CLI migrations |

Neon compute cold-starts can exceed Prisma's default timeout — both URLs include `connect_timeout=30`.

```bash
npx prisma migrate deploy   # apply migrations (uses DIRECT_URL)
npx prisma generate         # generate the client
```

### 2. Stripe

Test-mode keys from [Dashboard → Developers → API keys](https://dashboard.stripe.com/test/apikeys):

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`
- `STRIPE_PREMIUM_PRICE_ID` — the monthly Premium price (create one under Product Catalog if needed)
- `STRIPE_WEBHOOK_SECRET` — for local dev, run the CLI below and use its secret:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 3. Auth

- `BETTER_AUTH_SECRET` — long random string (`openssl rand -base64 32`)
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` locally
- GitHub/Google OAuth client id + secret (optional; empty disables that provider)

### 4. Run

```bash
pnpm dev        # http://localhost:3000
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm build      # production build
```

## Test the billing flow

1. Start dev + `stripe listen` (above).
2. Sign up, go to `/pricing`, subscribe with `4242 4242 4242 4242` (any future expiry, any CVC).
3. `/billing/success` confirms; `/dashboard` shows PREMIUM once the webhook lands.
4. **Manage billing** → Billing Portal: update card, cancel (stays PREMIUM until period end).
5. Failure path: pay with `4000 0000 0000 0341` — the plan doesn't flap; the terminal subscription event decides access.
6. Fire events manually: `stripe trigger checkout.session.completed`.

## Project structure

```
app/
  api/auth/[...all]/route.ts   Better Auth handler
  api/stripe/
    checkout/route.ts          create Checkout Session (auth)
    webhook/route.ts           Stripe events (signature-verified)
    portal/route.ts            Billing Portal session (auth)
    subscription/route.ts      read-only status (auth)
  billing/success/page.tsx     payment verification page
  dashboard/page.tsx           plan + billing management
  pricing/page.tsx             plans (auth-guarded)
  login/page.tsx               sign in/up
lib/
  auth.ts / auth-client.ts     Better Auth server + client
  auth-guard.ts                requireAuth for API routes
  db.ts                        Prisma client (pg pool adapter)
  stripe.ts                    lazy client, price map, status→plan mapping
prisma/
  schema.prisma                User/Session/Account/Verification + Plan enum
  migrations/                  applied with `prisma migrate deploy`
components/
  PricingCards.tsx             subscribe buttons + states
  ManageBillingButton.tsx      portal redirect button
```

## Deploy notes

- Set all `.env.example` vars in the host (Vercel: use **sensitive** env vars for secrets).
- Point a live Stripe webhook endpoint at `/api/stripe/webhook` and use its signing secret.
- This repo uses the shared test-mode sandbox. For a new integration, Stripe recommends isolated [sandboxes](https://docs.stripe.com/sandboxes.md) per environment.
- If charging US/EU customers, consider [Stripe Tax](https://docs.stripe.com/billing/taxes/collect-taxes.md) — `automatic_tax` collects nothing without an active registration.
- Prefer a least-privilege restricted key (`rk_`) over the raw secret key before going live.
