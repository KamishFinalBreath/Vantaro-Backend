import { Router } from 'express';
import { priceCartHandler } from '../controllers/cart.controller.js';

const router = Router();

// Server-side cart validation / pricing.
router.post('/price', priceCartHandler);

export default router;