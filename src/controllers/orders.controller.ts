import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import {
  getOrderForUser,
  listOrdersForUser,
} from '../services/order.service.js';

export const listOrdersHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.vantaroUser) throw ApiError.unauthorized();
    const orders = await listOrdersForUser(req.vantaroUser.id);
    res.json({ items: orders });
  },
);

export const getOrderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.vantaroUser) throw ApiError.unauthorized();
    const order = await getOrderForUser(req.params.id, req.vantaroUser.id);
    res.json(order);
  },
);