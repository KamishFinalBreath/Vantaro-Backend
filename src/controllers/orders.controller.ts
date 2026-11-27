import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import {
  getOrderForClerk,
  listOrdersForClerk,
} from '../services/order.service.js';

export const listOrdersHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.clerkUser) throw ApiError.unauthorized();
    const orders = await listOrdersForClerk(req.clerkUser.id);
    res.json({ items: orders });
  },
);

export const getOrderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.clerkUser) throw ApiError.unauthorized();
    const order = await getOrderForClerk(req.params.id, req.clerkUser.id);
    res.json(order);
  },
);