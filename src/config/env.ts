import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  // Supabase (Auth + Postgres via Prisma)
  SUPABASE_URL: z.string().url('SUPABASE_URL is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),

  // Printify
  PRINTIFY_API_KEY: z.string().min(1, 'PRINTIFY_API_KEY is required'),
  PRINTIFY_SHOP_ID: z.string().min(1, 'PRINTIFY_SHOP_ID is required'),
  // Numeric Printify shipping method id for the shop (defaults to 1 = Standard).
  PRINTIFY_SHIPPING_METHOD: z.coerce.number().default(1),
  // Optional shared secret to verify Printify webhook calls.
  PRINTIFY_WEBHOOK_SECRET: z.string().optional(),

  // Optional public base URL used to build Stripe success/cancel redirects
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;