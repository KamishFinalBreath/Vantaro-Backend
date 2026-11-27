import { randomUUID } from 'node:crypto';
import type { Order } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { stripe } from './stripe.service.js';
import { priceCart } from './cart.service.js';
import { createIdempotentOrder } from './order.service.js';
import { ApiError } from '../utils/ApiError.js';

const addressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  country: z.string().min(2),
  region: z.string().optional().nullable(),
  address1: z.string().min(1),
  address2: z.string().optional().nullable(),
  city: z.string().min(1),
  zip: z.string().min(1),
});

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().positive().max(100),
      }),
    )
    .min(1),
  idempotencyKey: z.string().min(1).optional(),
  shippingAddress: addressSchema,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export interface CheckoutResult {
  orderId: string;
  sessionId: string;
  url: string | null;
  created: boolean;
}

export async function createCheckoutSession(
  userId: string,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const data = checkoutSchema.parse(input);
  const idempotencyKey = data.idempotencyKey ?? `checkout_${randomUUID()}`;

  const cart = await priceCart(data.items);
  const { order, created } = await createIdempotentOrder({
    userId,
    idempotencyKey,
    cart,
    shippingAddress: data.shippingAddress,
  });

  return buildStripeSession(order, created);
}

/**
 * Creates (or reuses) a Stripe Checkout Session for an existing order.
 * Called by the controller with the authenticated user identity and by
 * the idempotent path above.
 */
export async function buildStripeSession(
  order: Order,
  created: boolean,
): Promise<CheckoutResult> {
  // Reuse an existing session if the order already has one.
  if (order.stripeCheckoutId) {
    const existing = await stripe.checkout.sessions.retrieve(order.stripeCheckoutId);
    if (existing.url && existing.payment_status !== 'paid') {
      return {
        orderId: order.id,
        sessionId: existing.id,
        url: existing.url,
        created,
      };
    }
  }

  const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: items.map((it) => ({
        quantity: it.quantity,
        price_data: {
          currency: it.currency,
          unit_amount: it.unitPriceCents,
          product_data: {
            name: it.title,
            ...(it.sku ? { metadata: { sku: it.sku } } : {}),
          },
        },
      })),
      metadata: {
        orderId: order.id,
        userId: order.userId,
        idempotencyKey: order.idempotencyKey,
      },
      payment_intent_data: {
        metadata: { orderId: order.id, userId: order.userId },
      },
      success_url: `${env.PUBLIC_BASE_URL}/checkout/success?order_id=${order.id}`,
      cancel_url: `${env.PUBLIC_BASE_URL}/checkout/cancel?order_id=${order.id}`,
    },
    { idempotencyKey: `stripe_${order.idempotencyKey}` },
  );

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeCheckoutId: session.id },
  });

  if (!session.url) {
    throw new ApiError(502, 'Stripe did not return a checkout URL');
  }

  return {
    orderId: order.id,
    sessionId: session.id,
    url: session.url,
    created,
  };
}