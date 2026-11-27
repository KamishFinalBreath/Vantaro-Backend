import type { Order, OrderItem } from '@prisma/client';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { stripe } from '../services/stripe.service.js';
import { createPrintifyOrderForOrder } from '../services/printify-order.service.js';
import type { ShippingAddress } from '../services/printify-order.service.js';

type OrderWithItems = Order & { items: OrderItem[] };

/**
 * Stripe requires the raw request body to verify the webhook signature.
 * The route is mounted with express.raw({ type: 'application/json' }).
 */
export async function stripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf8')
    : (req.body as unknown as string);
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig as string,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', err);
    res.status(400).json({ error: `Webhook signature verification failed` });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(pi);
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await markOrderFailed(pi.metadata?.orderId);
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrderCancelled(session.metadata?.orderId);
        break;
      }
      default:
        // Acknowledge unhandled events so Stripe stops retrying.
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[stripe webhook] handler error', err);
    // Non-2xx triggers Stripe retries.
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function markPaidAndFulfill(orderId: string, paymentIntentId?: string | null) {
  // Idempotent: only the first transition PENDING -> PAID triggers fulfillment.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return;

  if (order.status === 'PAID' || order.status === 'FULFILLED') {
    // Already processed; ensure printify order exists if needed.
    if (!order.printifyOrderId) {
      await fulfillWithPrintify(order);
    }
    return;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'PAID',
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
    include: { items: true },
  });

  await fulfillWithPrintify(updated);
}

async function fulfillWithPrintify(order: OrderWithItems | null) {
  if (!order || order.printifyOrderId) return;
  if (order.status !== 'PAID' && order.status !== 'FULFILLED') return;

  const address = order.shippingAddress as ShippingAddress | null;
  if (!address) {
    console.error(`[printify] order ${order.id} has no shipping address; skipping`);
    return;
  }

  try {
    const printifyOrderId = await createPrintifyOrderForOrder(order, address);
    await prisma.order.update({
      where: { id: order.id },
      data: { printifyOrderId: String(printifyOrderId) },
    });
  } catch (err) {
    console.error(`[printify] failed to create order for ${order.id}`, err);
    // Leave status PAID; a retry/replay of the webhook will try again.
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  await markPaidAndFulfill(orderId, paymentIntentId);
}

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata?.orderId;
  if (!orderId) return;
  await markPaidAndFulfill(orderId, pi.id);
}

async function markOrderFailed(orderId?: string) {
  if (!orderId) return;
  await prisma.order.updateMany({
    where: { id: orderId, status: 'PENDING' },
    data: { status: 'FAILED' },
  });
}

async function markOrderCancelled(orderId?: string) {
  if (!orderId) return;
  await prisma.order.updateMany({
    where: { id: orderId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
}