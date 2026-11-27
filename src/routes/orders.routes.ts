import { Router } from 'express';
import {
  requireClerkAuth,
  syncClerkUser,
} from '../middleware/auth.js';
import { getOrderHandler, listOrdersHandler } from '../controllers/orders.controller.js';

const router = Router();

router.use(requireClerkAuth, syncClerkUser);

router.get('/', listOrdersHandler);
router.get('/:id', getOrderHandler);

export default router;