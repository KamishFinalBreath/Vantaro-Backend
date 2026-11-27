import { Router } from 'express';
import { getProductHandler, listProductsHandler } from '../controllers/products.controller.js';

const router = Router();

// Public storefront catalog.
router.get('/', listProductsHandler);
router.get('/:id', getProductHandler);

export default router;