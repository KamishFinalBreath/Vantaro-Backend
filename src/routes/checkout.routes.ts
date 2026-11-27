import { Router } from 'express';
import {
  requireSupabaseAuth,
  syncSupabaseUser,
} from '../middleware/auth.js';
import { createCheckoutHandler } from '../controllers/checkout.controller.js';

const router = Router();

// All checkout routes require a valid Supabase access token + synced user.
router.use(requireSupabaseAuth, syncSupabaseUser);

router.post('/', createCheckoutHandler);

export default router;