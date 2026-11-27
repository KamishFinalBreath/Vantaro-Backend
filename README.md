# Vantaro Backend

E-commerce backend for the Vantaro store. Node.js + Express (TypeScript), modular
`routes / controllers / services / config` structure, deployed as a Vercel
serverless function.

## Stack

- **Node.js + Express (TypeScript)** — `tsx` for dev, `tsc` for build
- **Auth** — Supabase Auth (access-token verification + user syncing to DB)
- **Database** — Supabase Postgres via **Prisma** (`users`, `products`,
  `product_variants`, `orders`, `order_items`)
- **Payments** — Stripe Checkout Sessions + signed webhooks (idempotent order creation)
- **Fulfillment** — Printify API wrapper; orders auto-created on successful payment,
  status synced via Printify webhooks
- **Hosting** — Vercel serverless (`api/index.ts` + `vercel.json`)

## Project structure

```
api/
  index.ts                # Vercel serverless entry (exports Express app)
src/
  app.ts                  # Express app factory (middleware, routes)
  server.ts               # Local dev server
  config/
    env.ts                # Env validation (zod)
    prisma.ts             # Prisma client singleton
    supabase.ts           # Supabase client + access-token verification
  middleware/
    auth.ts               # requireSupabaseAuth + syncSupabaseUser
    error.ts              # Not found + global error handler
  routes/                 # products, cart, checkout, orders, webhooks
  controllers/            # request handlers (incl. Stripe/Printify webhooks)
  services/               # supabase user sync, cart pricing, orders, checkout,
                          #   stripe, printify, printify-order
  types/                  # shared types + express augmentation
  utils/                  # ApiError, asyncHandler
prisma/
  schema.prisma           # Datamodel
prisma.config.ts
vercel.json
.env.example
```

## Configuration

Copy `.env.example` to `.env` and fill in real values. **Never commit `.env`.**

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `PORT` | Local dev port (default `4000`) |
| `PUBLIC_BASE_URL` | Storefront URL for Stripe success/cancel redirects |
| `SUPABASE_URL` | Supabase project URL (Auth + Postgres) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key (verifies user access tokens) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (optional; not required by Prisma) |
| `DATABASE_URL` | Postgres connection string used by Prisma |
| `STRIPE_SECRET_KEY` | Stripe secret key (test or live) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `PRINTIFY_API_KEY` | Printify API token |
| `PRINTIFY_SHOP_ID` | Printify shop id |
| `PRINTIFY_SHIPPING_METHOD` | Numeric Printify shipping method id (default `1`) |
| `PRINTIFY_WEBHOOK_SECRET` | Optional shared secret for Printify webhooks |

## Setup

> **Deploying on Vercel only?** You can skip this whole section — Vercel installs
> dependencies and builds for you, and the database is created in the Supabase
> SQL Editor (see *Deploy to Vercel → Step 2*). The commands below are only for
> running the backend **locally**.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env      # then edit .env with real values

# 3. Create the database schema (Supabase Postgres)
npm run prisma:push       # or: npm run prisma:migrate

# 4. Generate the Prisma client (also done by `npm run build`)
npm run prisma:generate
```

### Seeding products (optional)

Products and variants live in the DB. Add them from Printify by inserting rows
in the Supabase dashboard → **Table Editor** (no local tooling needed), or with
Prisma Studio (`npm run prisma:studio`) if running locally. Each
`ProductVariant.printifyVariantId` must match the Printify variant id used at
order creation.

## Run (development)

```bash
npm run dev        # tsx watch -> http://localhost:PORT
```

## Build & run (production)

```bash
npm run build      # prisma generate + tsc -> dist/
npm start          # node dist/server.js
```

## API overview

All routes are under `/api`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | no | Health check |
| GET | `/api/products` | no | List products (`?search=&skip=&take=`) |
| GET | `/api/products/:id` | no | Get product with variants |
| POST | `/api/cart/price` | no | Validate cart + authoritative pricing |
| POST | `/api/checkout` | Supabase | Create Stripe Checkout Session (idempotent) |
| GET | `/api/orders` | Supabase | List current user's orders |
| GET | `/api/orders/:id` | Supabase | Get one of the user's orders |
| POST | `/api/webhooks/stripe` | signature | Stripe events (raw body) |
| POST | `/api/webhooks/printify` | secret | Printify order status updates |

Protected routes require a Supabase Auth access token
(`Authorization: Bearer <access_token>`). The Supabase user is synced to the
local `users` table (keyed by the Supabase user id) on each authenticated request.

### Checkout request body

```jsonc
{
  "items": [{ "variantId": "<local variant id>", "quantity": 2 }],
  "idempotencyKey": "optional-unique-key",        // generated if omitted
  "shippingAddress": {
    "firstName": "Ada", "lastName": "Lovelace", "email": "ada@example.com",
    "country": "US", "address1": "1 Analytical Way", "city": "London", "zip": "12345"
  }
}
```

Response: `{ orderId, sessionId, url, created }`. Redirect the customer to `url`.

## Payment & fulfillment flow

1. `POST /api/checkout` prices the cart server-side, creates a `PENDING` order
   (guarded by a unique `idempotencyKey`), and creates a Stripe Checkout Session.
2. Stripe sends `checkout.session.completed` / `payment_intent.succeeded` to
   `POST /api/webhooks/stripe`. The raw body is verified against
   `STRIPE_WEBHOOK_SECRET`.
3. On first `PAID` transition the order is marked `PAID` and a Printify order is
   created automatically (idempotent — replays won't duplicate).
4. Printify status webhooks (`POST /api/webhooks/printify`) update
   `printifyOrderStatus` and mark the order `FULFILLED` on shipped/delivered.

## Webhooks

Webhooks are how Stripe and Printify tell the backend that a payment happened or
an order shipped. There are two endpoints (both mounted with a **raw body** so
signatures can be verified):

- `POST /api/webhooks/stripe` — payment events
- `POST /api/webhooks/printify` — order status events

You register these once per provider, using your Vercel URL
(`https://<your-project>.vercel.app`). No domain needed.

### Stripe webhook

1. **Get the endpoint URL**: `https://<your-project>.vercel.app/api/webhooks/stripe`.
2. Go to <https://dashboard.stripe.com> → **Developers → Webhooks** (or
   <https://dashboard.stripe.com/test/webhooks> for test mode) → **Add endpoint**.
3. **Endpoint URL**: paste the URL above. **Description**: `Vantaro`.
4. **Select events** — add exactly these:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.expired`
5. Click **Add endpoint**. On the endpoint page, click **Reveal** under
   *Signing secret* and copy the `whsec_...` value.
6. In **Vercel → Settings → Environment Variables**, set
   `STRIPE_WEBHOOK_SECRET` to that `whsec_...` value (Production), then
   **redeploy**.
7. **Test it**: <https://dashboard.stripe.com/test/webhooks> → your endpoint →
   **Send test event** → choose `checkout.session.completed`. Or run a real test
   checkout from your frontend with Stripe test cards (e.g. `4242 4242 4242 4242`).
   A `PENDING` order should flip to `PAID` and a Printify order is created.

> Use **test mode** keys/secret while testing (`sk_test_...`, `whsec_...` from the
> test dashboard). Switch to live keys + a live-mode endpoint when going to prod.

### Printify webhook

1. **Get the endpoint URL**: `https://<your-project>.vercel.app/api/webhooks/printify`.
2. Go to <https://printify.com/app> → open your **shop** → **Settings →
   Webhooks** (or **Add webhook**).
3. **Webhook URL**: paste the URL above.
4. **Events**: subscribe to the order events you care about — at minimum
   `order:updated` (and optionally `order:created`, `order:shipped`,
   `order:delivered`, `order:cancelled`).
5. Save. Printify will start POSTing status changes; the backend maps them to
   `printifyOrderStatus` and marks the order `FULFILLED` on shipped/delivered.
6. **Optional security**: set a `PRINTIFY_WEBHOOK_SECRET` env var in Vercel and
   configure the same secret on the Printify webhook. If set, requests without a
   matching `x-printify-secret` header are rejected with `401`.

### Which env vars the webhooks need

| Variable | Used by | Where to get it |
| --- | --- | --- |
| `STRIPE_WEBHOOK_SECRET` | Stripe endpoint | Stripe → Developers → Webhooks → endpoint → Signing secret (`whsec_...`) |
| `PRINTIFY_WEBHOOK_SECRET` | Printify endpoint (optional) | any string you choose; must match the Printify webhook config |

### Troubleshooting webhooks

- **Stripe returns 4xx / "signature verification failed"** → the raw body isn't
  reaching the handler, or `STRIPE_WEBHOOK_SECRET` is the wrong/old secret.
  Confirm you redeployed after setting it, and that the endpoint URL is
  `.../api/webhooks/stripe` (not `/api/checkout`).
- **No order created after payment** → the order has no `shippingAddress`
  (required to create the Printify order) or Printify rejected the request; check
  Vercel **Logs** for `[printify]` lines.
- **Printify 401** → `PRINTIFY_WEBHOOK_SECRET` is set in Vercel but the header
  doesn't match; align them or remove the var.
- **Testing locally instead of Vercel** (optional): `stripe listen --forward-to
  localhost:4000/api/webhooks/stripe` prints a local `whsec_...` to use in
  `.env`, then `stripe trigger checkout.session.completed`.

## Deploy to Vercel (no custom domain needed)

Everything is hosted on Vercel. Vercel gives every project a free
`https://<your-project>.vercel.app` URL — you do **not** need to buy a domain.
Use that URL everywhere below (webhooks, `PUBLIC_BASE_URL`, etc.).

You do the one-time setup **entirely in the browser** — the **Vercel**
dashboard (hosting + env vars) and the **Supabase** dashboard (database). No
commands run on your own machine. After that, Vercel runs the backend 24/7.

### Step 1 — Push to GitHub (done)
This repo is already on GitHub (`origin/main`). Vercel deploys from it.

### Step 2 — Create the Supabase database (no local commands)
1. Create a free project at <https://supabase.com>.
2. Open the Supabase dashboard → **SQL Editor** → **New query**.
3. Open `prisma/schema.sql` from this repo, copy the **entire** file, paste it
   into the editor, and click **Run**. This creates all tables, enums, and
   indexes. (Equivalent to `npm run prisma:push`, but done entirely in the
   browser — nothing runs on your machine.)
4. In **Project Settings → Database → Connection string**, copy the **URI**
   (the `postgresql://...` line). Use the **connection pooler / port `6543`**
   string for `DATABASE_URL` (see the serverless note below).

### Step 3 — Import the project in Vercel (dashboard)
1. Go to <https://vercel.com/new> → **Import** the `Vantaro-Backend` repo.
2. Framework preset: **Other**. Build command: `npm run build`
   (Vercel reads `vercel.json`; no changes needed). Leave output dir default.
3. Click **Deploy**. Wait for it to finish.

### Step 4 — Add environment variables (Vercel dashboard)
Open **Project → Settings → Environment Variables** and add **all** keys from
`.env.example` for **Production** (and Preview if you want). Values come from:
- **Supabase** → Project Settings → **API** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  and optionally `SUPABASE_SERVICE_ROLE_KEY`) and **Database** (`DATABASE_URL`,
  the pooler URI). The same Supabase project provides both Auth and Postgres.
- **Stripe** → <https://dashboard.stripe.com/test/apikeys> (`STRIPE_SECRET_KEY`).
  `STRIPE_WEBHOOK_SECRET` is filled in Step 6.
- **Printify** → <https://printify.com/app/api> (`PRINTIFY_API_KEY`,
  `PRINTIFY_SHOP_ID`).
- `PUBLIC_BASE_URL` → your Vercel URL, e.g. `https://vantaro-backend.vercel.app`
  (the frontend storefront URL if you already have it deployed).

After saving, **redeploy** (Deployments → ⋯ → Redeploy) so the new vars apply.

### Step 5 — Get your Vercel URL
On the project's **Overview / Deployments** page, copy the production URL like
`https://vantaro-backend.vercel.app`. This is your backend base URL — no domain
purchase required. (You can rename the project in Settings to change the slug.)

### Step 6 — Register webhooks (dashboards)
Set up the Stripe and Printify webhooks using your Vercel URL — full
instructions, events to select, and which secret goes where are in the
**[Webhooks](#webhooks)** section above. In short:
- Stripe endpoint: `https://<your-project>.vercel.app/api/webhooks/stripe`
  → copy its `whsec_...` into `STRIPE_WEBHOOK_SECRET` → redeploy.
- Printify endpoint: `https://<your-project>.vercel.app/api/webhooks/printify`
  → subscribe to order events.

### Step 7 — Verify
Visit `https://<your-project>.vercel.app/api/health` — you should get
`{"status":"ok",...}`. Then run a test checkout from your frontend.

> **Redeploy after env changes:** Vercel only picks up new environment variables
> on a new deployment. Every time you change a var, redeploy.

> **Serverless note:** always use the Supabase **connection pooler** URL
> (host `...pooler.supabase.com`, port `6543`, `pgbouncer=true`) for
> `DATABASE_URL` in production so serverless functions don't exhaust Postgres
> connections. A single `PrismaClient` is reused across warm invocations.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | `prisma generate` + `tsc` |
| `npm start` | Run compiled server |
| `npm run typecheck` | Type-check without emitting |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:push` | Push schema to DB |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:studio` | Open Prisma Studio |