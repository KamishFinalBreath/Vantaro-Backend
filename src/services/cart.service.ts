import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { CartLineInput, PricedCart, PricedCartLine } from '../types/cart.js';

/**
 * Validates cart input lines against the database, resolves the matching
 * product variants, and computes authoritative prices/totals server-side.
 * Never trust client-provided prices.
 */
export async function priceCart(rawLines: CartLineInput[]): Promise<PricedCart> {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw ApiError.badRequest('Cart must contain at least one item');
  }

  // Merge duplicate variant lines and validate quantities.
  const qtyByVariant = new Map<string, number>();
  for (const line of rawLines) {
    if (!line?.variantId || typeof line.variantId !== 'string') {
      throw ApiError.badRequest('Each cart item requires a variantId');
    }
    const qty = Number(line.quantity);
    if (!Number.isInteger(qty) || qty <= 0 || qty > 100) {
      throw ApiError.badRequest(
        `Invalid quantity for variant ${line.variantId}`,
      );
    }
    qtyByVariant.set(line.variantId, (qtyByVariant.get(line.variantId) ?? 0) + qty);
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: [...qtyByVariant.keys()] },
      isAvailable: true,
      product: { isActive: true },
    },
    include: { product: true },
  });

  if (variants.length !== qtyByVariant.size) {
    const foundIds = new Set(variants.map((v) => v.id));
    const missing = [...qtyByVariant.keys()].filter((id) => !foundIds.has(id));
    throw ApiError.badRequest(`Unavailable or unknown variants: ${missing.join(', ')}`);
  }

  const lines: PricedCartLine[] = variants.map((v) => ({
    variantId: v.id,
    productId: v.productId,
    printifyVariantId: v.printifyVariantId,
    title: v.title,
    sku: v.sku,
    quantity: qtyByVariant.get(v.id)!,
    unitPriceCents: v.priceCents,
    currency: v.currency,
  }));

  const currency = lines[0]?.currency ?? 'usd';
  if (lines.some((l) => l.currency !== currency)) {
    throw ApiError.badRequest('Cart contains mixed currencies');
  }

  const totalCents = lines.reduce(
    (sum, l) => sum + l.unitPriceCents * l.quantity,
    0,
  );

  return { lines, totalCents, currency };
}