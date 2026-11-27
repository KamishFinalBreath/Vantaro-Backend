import { Router } from 'express';
import {
  requireSupabaseAuth,
  syncSupabaseUser,
} from '../middleware/auth.js';
import { getOrderHandler, listOrdersHandler } from '../controllers/orders.controller.js';

const router = Router();

router.use(requireSupabaseAuth, syncSupabaseUser);

router.get('/', listOrdersHandler);
router.get('/:id', getOrderHandler);

export default router;