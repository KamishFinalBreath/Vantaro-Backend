import { Router } from 'express';
import {
  requireClerkAuth,
  syncClerkUser,
} from '../middleware/auth.js';
import { createCheckoutHandler } from '../controllers/checkout.controller.js';

const router = Router();

// All checkout routes require a valid Clerk session + synced user.
router.use(requireClerkAuth, syncClerkUser);

router.post('/', createCheckoutHandler);

export default router;