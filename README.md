# Vantaro Backend

E-commerce backend for the Vantaro store. Node.js + Express (TypeScript), modular
`routes / controllers / services / config` structure, deployed as a Vercel
serverless function.

## Stack

- **Node.js + Express (TypeScript)** — `tsx` for dev, `tsc` for build
- **Auth** — Clerk (session token verification + user syncing to DB)
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
  middleware/
    auth.ts               # Clerk requireClerkAuth + syncClerkUser
    error.ts              # Not found + global error handler
  routes/                 # products, cart, checkout, orders, webhooks
  controllers/            # request handlers (incl. Stripe/Printify webhooks)
  services/               # clerk user sync, cart pricing, orders, checkout,
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
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key (required by Clerk middleware) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `DATABASE_URL` | Postgres connection string used by Prisma |
| `STRIPE_SECRET_KEY` | Stripe secret key (test or live) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `PRINTIFY_API_KEY` | Printify API token |
| `PRINTIFY_SHOP_ID` | Printify shop id |
| `PRINTIFY_SHIPPING_METHOD` | Numeric Printify shipping method id (default `1`) |
| `PRINTIFY_WEBHOOK_SECRET` | Optional shared secret for Printify webhooks |

## Setup

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

Products and variants live in the DB. Populate them from Printify by inserting
rows (Studio: `npm run prisma:studio`) or via a seed script of your choice. Each
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
| POST | `/api/checkout` | Clerk | Create Stripe Checkout Session (idempotent) |
| GET | `/api/orders` | Clerk | List current user's orders |
| GET | `/api/orders/:id` | Clerk | Get one of the user's orders |
| POST | `/api/webhooks/stripe` | signature | Stripe events (raw body) |
| POST | `/api/webhooks/printify` | secret | Printify order status updates |

Protected routes require a Clerk session token (`Authorization: Bearer <token>`).
The Clerk user is synced to the local `users` table on each authenticated request.

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

## Webhooks (local development)

```bash
# Stripe — forward to local server, prints a whsec_... to put in .env
stripe listen --forward-to localhost:4000/api/webhooks/stripe

# Trigger a test event
stripe trigger checkout.session.completed
```

Point Printify's webhook at your public URL + `/api/webhooks/printify`.

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add every variable from `.env.example` in **Project → Settings → Environment
   Variables** (Production/Preview). Do **not** commit `.env`.
3. Set `PUBLIC_BASE_URL` to the deployed storefront URL.
4. `vercel.json` rewrites all requests to the `api/index.ts` serverless function.
   No extra build command is required (Vercel builds with `npm run build`).
5. After deploy, register webhook endpoints:
   - Stripe: `https://<your-domain>/api/webhooks/stripe`
   - Printify: `https://<your-domain>/api/webhooks/printify`
6. `npm run prisma:push` (or migrate) against the production `DATABASE_URL`
   before first use.

> **Serverless note:** use the Supabase **connection pooler** URL (port `6543`,
   `pgbouncer=true`) for `DATABASE_URL` in production to avoid exhausting
   Postgres connections. A single `PrismaClient` is reused across warm invocations.

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