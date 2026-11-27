import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const PRINTIFY_BASE = 'https://api.printify.com/v1';

export interface PrintifyVariant {
  id: number;
  sku?: string | null;
  title?: string;
  price?: number | string;
  is_available?: boolean;
  [key: string]: unknown;
}

export interface PrintifyProduct {
  id: number;
  title: string;
  description?: string | null;
  tags?: string[];
  variants?: PrintifyVariant[];
  images?: Array<{ src: string; alt?: string | null }>;
  [key: string]: unknown;
}

export interface PrintifyOrderLineItem {
  printify_variant_id: number;
  quantity: number;
}

export interface CreatePrintifyOrderInput {
  external_id: string;
  label?: string;
  line_items: PrintifyOrderLineItem[];
  shipping_method: number;
  send_shipping_notification?: boolean;
  address?: PrintifyAddress;
}

export interface PrintifyAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  country: string;
  region?: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
}

export interface PrintifyOrder {
  id: number;
  order_number?: number;
  external_id?: string;
  status: string;
  shipping_method?: number;
  line_items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

async function printifyFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${PRINTIFY_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.PRINTIFY_API_KEY}`,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(
      res.status >= 400 && res.status < 500 ? 502 : 502,
      `Printify API error (${res.status})`,
      text.slice(0, 500),
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const printify = {
  shopId: env.PRINTIFY_SHOP_ID,

  listProducts: () =>
    printifyFetch<{ data: PrintifyProduct[]; current_page: number; last_page: number }>(
      `/shops/${env.PRINTIFY_SHOP_ID}/products.json`,
    ),

  getProduct: (productId: string) =>
    printifyFetch<{ product: PrintifyProduct }>(
      `/shops/${env.PRINTIFY_SHOP_ID}/products/${productId}.json`,
    ),

  getOrder: (orderId: string) =>
    printifyFetch<{ order: PrintifyOrder }>(
      `/shops/${env.PRINTIFY_SHOP_ID}/orders/${orderId}.json`,
    ),

  listOrders: () =>
    printifyFetch<{ data: PrintifyOrder[]; current_page: number; last_page: number }>(
      `/shops/${env.PRINTIFY_SHOP_ID}/orders.json`,
    ),

  createOrder: (input: CreatePrintifyOrderInput) =>
    printifyFetch<{ order: PrintifyOrder }>(
      `/shops/${env.PRINTIFY_SHOP_ID}/orders.json`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),

  sendOrderToProduction: (orderId: string) =>
    printifyFetch<{ order: PrintifyOrder }>(
      `/shops/${env.PRINTIFY_SHOP_ID}/orders/${orderId}/send_to_production.json`,
      { method: 'POST' },
    ),
};

export default printify;