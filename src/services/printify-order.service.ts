import type { Order, OrderItem } from '@prisma/client';
import { env } from '../config/env.js';
import { printify } from './printify.service.js';

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  country: string;
  region?: string | null;
  address1: string;
  address2?: string | null;
  city: string;
  zip: string;
}

/**
 * Builds and submits a Printify order for a paid Vantaro order.
 * `line_items` reference Printify variant ids, quantities are summed per variant.
 */
export async function createPrintifyOrderForOrder(
  order: Order & { items: OrderItem[] },
  address: ShippingAddress,
): Promise<number> {
  // Aggregate quantities by Printify variant id (defensive against dupes).
  const qtyByVariant = new Map<number, number>();
  for (const item of order.items) {
    const pid = Number(item.printifyVariantId);
    if (!Number.isFinite(pid)) {
      throw new Error(`Invalid printifyVariantId on order item ${item.id}`);
    }
    qtyByVariant.set(pid, (qtyByVariant.get(pid) ?? 0) + item.quantity);
  }

  const line_items = [...qtyByVariant.entries()].map(
    ([printify_variant_id, quantity]) => ({ printify_variant_id, quantity }),
  );

  const { order: created } = await printify.createOrder({
    external_id: order.id,
    label: `Vantaro order ${order.id}`,
    line_items,
    shipping_method: env.PRINTIFY_SHIPPING_METHOD,
    send_shipping_notification: true,
    address: {
      first_name: address.firstName,
      last_name: address.lastName,
      email: address.email,
      phone: address.phone ?? '',
      country: address.country,
      region: address.region ?? '',
      address1: address.address1,
      address2: address.address2 ?? '',
      city: address.city,
      zip: address.zip,
    },
  });

  return created.id;
}