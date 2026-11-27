import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { priceCart } from '../services/cart.service.js';

const cartSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().positive().max(100),
      }),
    )
    .min(1),
});

/**
 * Validates a cart and returns authoritative server-side pricing.
 * The client cart stays in local state; this endpoint is the source of truth
 * for totals before checkout.
 */
export const priceCartHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { items } = cartSchema.parse(req.body);
    const priced = await priceCart(items);
    res.json(priced);
  },
);