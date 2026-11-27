import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createCheckoutSession } from '../services/checkout.service.js';

/**
 * POST /api/checkout
 * Creates a Stripe Checkout Session for the authenticated user's cart and
 * returns the hosted checkout URL. Idempotent via idempotencyKey.
 */
export const createCheckoutHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.vantaroUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await createCheckoutSession(req.vantaroUser.id, req.body);

    res.status(result.created ? 201 : 200).json(result);
  },
);