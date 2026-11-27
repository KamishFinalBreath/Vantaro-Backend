import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getProduct, listProducts } from '../services/product.service.js';

export const listProductsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const skip = req.query.skip ? Number(req.query.skip) : undefined;
    const take = req.query.take ? Number(req.query.take) : undefined;

    const result = await listProducts({ search, skip, take });
    res.json(result);
  },
);

export const getProductHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const product = await getProduct(req.params.id);
    res.json(product);
  },
);