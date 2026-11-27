import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

type PrintifyStatus =
  | 'PENDING'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

interface PrintifyWebhookBody {
  event?: string;
  order?: {
    id?: number;
    external_id?: string;
    status?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Map Printify order statuses to our internal enum.
function mapStatus(raw?: string): PrintifyStatus {
  switch ((raw ?? '').toLowerCase()) {
    case 'shipped':
    case 'in_transit':
      return 'SHIPPED';
    case 'delivered':
      return 'DELIVERED';
    case 'cancelled':
    case 'canceled':
      return 'CANCELLED';
    case 'failed':
      return 'FAILED';
    case 'paid':
      return 'PAID';
    case 'pending':
    default:
      return 'PENDING';
  }
}

/**
 * Handles Printify order status webhooks. The Printify order's `external_id`
 * is our Vantaro order id (set at creation time).
 */
export async function printifyWebhook(req: Request, res: Response) {
  // Optional shared-secret verification (header-based).
  if (env.PRINTIFY_WEBHOOK_SECRET) {
    const provided =
      (req.headers['x-printify-secret'] as string | undefined) ??
      (req.headers['x-webhook-secret'] as string | undefined);
    if (provided !== env.PRINTIFY_WEBHOOK_SECRET) {
      res.status(401).json({ error: 'Invalid Printify webhook secret' });
      return;
    }
  }

  const raw = req.body;
  let body: PrintifyWebhookBody;
  try {
    body = (Buffer.isBuffer(raw)
      ? JSON.parse(raw.toString('utf8'))
      : raw) as PrintifyWebhookBody;
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const externalId = body?.order?.external_id;
  const printifyOrderId = body?.order?.id;

  if (!externalId && !printifyOrderId) {
    // Acknowledge but nothing to update.
    res.json({ received: true, ignored: true });
    return;
  }

  const status = mapStatus(body?.order?.status);

  try {
    const where: Prisma.OrderWhereInput = externalId
      ? { id: String(externalId) }
      : { printifyOrderId: String(printifyOrderId) };

    await prisma.order.updateMany({
      where,
      data: {
        printifyOrderStatus: status,
        // When Printify reports shipped/delivered, reflect fulfillment locally.
        ...(status === 'SHIPPED' || status === 'DELIVERED'
          ? { status: 'FULFILLED' as const }
          : {}),
      },
    });

    res.json({ received: true });
  } catch (err) {
    console.error('[printify webhook] handler error', err);
    res.status(500).json({ error: 'Printify webhook handler failed' });
  }
}