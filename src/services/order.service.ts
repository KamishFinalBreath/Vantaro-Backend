import type { Order, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { PricedCart } from '../types/cart.js';

export interface CreateOrderParams {
  userId: string;
  idempotencyKey: string;
  cart: PricedCart;
  shippingAddress?: unknown;
}

/**
 * Creates a PENDING order + its items atomically, guarded by a unique
 * idempotencyKey. Replays of the same key return the existing order instead
 * of creating a duplicate (Stripe webhook / retried checkouts are safe).
 */
export async function createIdempotentOrder(
  params: CreateOrderParams,
): Promise<{ order: Order; created: boolean }> {
  const { userId, idempotencyKey, cart } = params;

  const existing = await prisma.order.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (existing.userId !== userId) {
      throw ApiError.conflict('Idempotency key already used by another user');
    }
    return { order: existing, created: false };
  }

  const itemsData: Prisma.OrderItemCreateManyOrderInput[] = cart.lines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    printifyVariantId: l.printifyVariantId,
    title: l.title,
    sku: l.sku,
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    currency: l.currency,
  }));

  try {
    const order = await prisma.order.create({
      data: {
        userId,
        idempotencyKey,
        status: 'PENDING',
        totalCents: cart.totalCents,
        currency: cart.currency,
        shippingAddress: (params.shippingAddress ?? undefined) as Prisma.InputJsonValue | undefined,
        items: { createMany: { data: itemsData } },
      },
      include: { items: true },
    });
    return { order, created: true };
  } catch (err) {
    // Concurrent request created the order first — fetch and return it.
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
      const order = await prisma.order.findUnique({ where: { idempotencyKey } });
      if (order && order.userId === userId) {
        return { order, created: false };
      }
    }
    throw err;
  }
}

export async function getOrderForUser(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

export async function listOrdersForUser(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
}

export async function getOrderByStripeCheckoutId(stripeCheckoutId: string) {
  return prisma.order.findUnique({
    where: { stripeCheckoutId },
    include: { items: true },
  });
}

export async function getOrderById(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
}